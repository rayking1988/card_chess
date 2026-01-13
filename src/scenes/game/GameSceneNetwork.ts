/**
 * @fileoverview GameScene network helpers
 *
 * @module scenes/game/GameSceneNetwork
 */

import { Square, Color, PieceSymbol } from 'chess.js';
import type { GameAction } from '../../managers/NetworkManager';
import { DECK_SIZE } from '../../managers/DeckManager';
import type { GameScene } from '../GameScene';

/**
 * Sets up callbacks for network events
 * Handles peer join/leave, actions, state sync, and errors
 */
export function setupNetworkCallbacks(this: GameScene): void {
  if (!this.networkManager) return;

  this.networkManager.onAction((action, _peerId) => {
    this.handleNetworkAction(action);
  });

  this.networkManager.onStateSync((state) => {
    this.gameStateManager.importState(state);
    this.updateUIFromState({ sendStats: false });
  });

  this.networkManager.onPeerJoined((_peerId) => {
    this.hideConnectionOverlay();
    this.networkManager?.sendPlayerName(this.playerName);
  });

  this.networkManager.onPeerLeft((_peerId) => {
    this.logEvent('system', 'Opponent disconnected');
    this.showConnectionOverlay('Opponent disconnected. Waiting to reconnect...');
  });

  this.networkManager.onConnectionStateChange((state) => {
    if (state === 'connected') {
      this.hideConnectionOverlay();
    } else if (state === 'waiting') {
      this.showConnectionOverlay('Waiting for opponent to reconnect...');
    } else if (state === 'disconnected') {
      this.showConnectionOverlay('Connection lost. Please return to menu.');
    }
  });

  this.networkManager.onError((_error) => {
    this.showConnectionOverlay('Network error. Please return to menu.');
  });

  if (this.networkManager.getPeerId()) {
    this.networkManager.sendPlayerName(this.playerName);
  }
}

/**
 * Handles incoming network actions from opponent
 * Routes actions to appropriate handlers
 *
 * @param action - Network action received
 */
export function handleNetworkAction(this: GameScene, action: GameAction): void {
  switch (action.type) {
    case 'PLAY_CARD':
      this.handleOpponentPlayCard(action.cardId, action.cardName, action.target, action.pieceType, action.effectAction);
      break;
    case 'MOVE_PIECE':
      this.handleOpponentMovePiece(action.from, action.to, action.promotion);
      break;
    case 'MULLIGAN':
      this.handleOpponentMulligan();
      break;
    case 'READY':
      this.handleOpponentReady();
      break;
    case 'END_TURN':
      // Opponent ended their turn, now it's our turn
      // Apply disturb effect if opponent sent a disturb amount
      const disturbAmount = action.disturbAmount ?? 0;
      if (disturbAmount > 0) {
        // Add disturb tags to local player
        const localPlayer = this.gameStateManager.getPlayer(this.localColor);
        localPlayer.disturbTags += disturbAmount;
      }
      // Skip mode processing since we just handled it above
      this.gameStateManager.endTurn(true);
      this.updateUIFromState();
      break;
    case 'PLAYER_NAME':
      this.opponentName = action.name || 'Opponent';
      this.refreshNameDisplays();
      this.logEvent('system', `${this.opponentName} joined`);
      this.updateUIFromState({ sendStats: false });
      break;
    case 'REMATCH_REQUEST':
    case 'REMATCH_ACCEPT':
      this.handleRematchReceived();
      break;
    case 'REMATCH_DECLINE':
      this.handleRematchDeclined();
      break;
    case 'CHAT_MESSAGE':
      this.eventLog.addEntry(action.senderColor, action.message, action.senderName);
      break;
    case 'PLAYER_STATS_SYNC':
      this.handleOpponentStatsSync(
        action.clock,
        action.stopwatch,
        action.mode,
        action.deckCount,
        action.discardCount,
        action.energy,
        action.energyCap,
        action.disturb
      );
      break;
  }
}

/**
 * Handle opponent stats sync (clock, stopwatch, mode)
 */
export function handleOpponentStatsSync(
  this: GameScene,
  clock: number,
  stopwatch: number,
  mode: 'focus' | 'disturb',
  deckCount: number,
  discardCount: number,
  energy: number,
  energyCap: number,
  disturb: number
): void {
  this.opponentClockTime = clock;
  this.opponentStopwatchTime = stopwatch;
  this.opponentMode = mode;
  this.opponentDeckCount = deckCount;
  this.opponentEnergy = energy;
  this.opponentEnergyCap = energyCap;
  this.opponentDisturbTags = disturb;

  const opponentColor = this.localColor === 'white' ? 'black' : 'white';
  const opponentState = this.gameStateManager.getPlayer(opponentColor);
  opponentState.clock = clock;
  opponentState.stopwatch = stopwatch;
  opponentState.mode = mode;
  opponentState.energy = energy;
  opponentState.energyCap = energyCap;
  opponentState.disturbTags = disturb;

  // If animation is in progress, store pending count to apply later
  // Otherwise update immediately
  if (this.suppressOpponentDiscardTop > 0) {
    this.pendingOpponentDiscardCount = discardCount;
  } else {
    this.opponentDiscardCount = discardCount;
  }

  this.opponentHandCount = Math.max(0, DECK_SIZE - deckCount - discardCount);
  // Don't add null values for unknown cards - only track cards we've seen via PLAY_CARD
  // If we have more cards than the sync says, trim the array
  if (this.opponentDiscardCards.length > discardCount) {
    this.opponentDiscardCards = this.opponentDiscardCards.slice(0, discardCount);
  }

  this.updateUIFromState({ sendStats: false });
}

/**
 * Send local player stats to opponent
 */
export function sendLocalPlayerStats(this: GameScene): void {
  if (!this.networkManager) return;

  const localPlayer = this.gameStateManager.getPlayer(this.localColor);
  this.networkManager.sendPlayerStats(
    localPlayer.clock,
    localPlayer.stopwatch,
    localPlayer.mode,
    localPlayer.deck.length,
    localPlayer.discard.length,
    localPlayer.energy,
    localPlayer.energyCap,
    localPlayer.disturbTags
  );
}

/**
 * Handles opponent playing a card
 * Updates local state and triggers animations
 *
 * @param _cardId - Card ID (unused, for logging)
 * @param cardName - Name of the card played
 * @param target - Target square (if applicable)
 * @param pieceType - Piece type for deployment cards
 * @param effectAction - Card effect action type
 */
export function handleOpponentPlayCard(
  this: GameScene,
  _cardId: string,
  cardName: string,
  target?: string,
  pieceType?: string,
  effectAction?: string
): void {
  const opponentColor = this.localColor === 'white' ? 'black' : 'white';
  const cardData = this.getCardDataByName(cardName);

  this.logEvent(opponentColor, `Played ${cardName}`);

  if (this.networkManager) {
    this.suppressOpponentHandAnimation++;
    this.opponentHandCount = Math.max(0, this.opponentHandCount - 1);
    // Don't update discard count/cards yet - will be done after animation
  }

  // Pass cardData to animation, which will add to discard after animation completes
  this.animateCardPlay(cardData, 'opponent', target as Square | undefined, () => {
    // Add card to discard after animation completes
    if (this.networkManager && cardData) {
      this.opponentDiscardCount = Math.min(DECK_SIZE, this.opponentDiscardCount + 1);
      this.opponentDiscardCards.push(cardData);
    }
  });

  // Handle piece deployment/destruction on board
  if (effectAction === 'DEPLOY_PIECE' && target && pieceType) {
    const color: Color = opponentColor === 'white' ? 'w' : 'b';
    this.chessBoard.placePiece(target as Square, pieceType as PieceSymbol, color);
    this.gameStateManager.setBoardFEN(this.chessBoard.getPosition());
    this.animatePieceDeploy(target as Square);
  } else if (effectAction === 'DESTROY_PIECE' && target) {
    const targetPiece = this.chessBoard.getWrapper().getPiece(target as Square);
    this.chessBoard.removePiece(target as Square);
    this.gameStateManager.setBoardFEN(this.chessBoard.getPosition());
    if (targetPiece) {
      this.animatePieceDestroy(targetPiece, target as Square);
    }
  }

  if (cardData?.timeCost) {
    this.opponentClockTime = Math.max(0, this.opponentClockTime - cardData.timeCost);
    this.opponentStopwatchTime += cardData.timeCost;
    // Deduct time through GameStateManager to trigger stopwatch threshold check
    this.gameStateManager.deductTime(opponentColor, cardData.timeCost);
  }

  this.checkGameEndConditions();
  this.updateUIFromState();
}

/**
 * Handles opponent moving a piece
 * Validates move, updates board, and checks game end conditions
 *
 * @param from - Source square
 * @param to - Destination square
 */
export function handleOpponentMovePiece(this: GameScene, from: string, to: string, promotion?: string): void {
  const opponentColor = this.localColor === 'white' ? 'black' : 'white';
  const movingPiece = this.chessBoard.getWrapper().getPiece(from as Square);
  const capturedPiece = this.chessBoard.getWrapper().getPiece(to as Square);
  const result = this.chessBoard.makeMove(from as Square, to as Square, promotion as PieceSymbol | undefined);

  if (result.success) {
    if (movingPiece) {
      this.animatePieceMove(from as Square, to as Square, movingPiece, capturedPiece);
    }
    this.gameStateManager.setBoardFEN(this.chessBoard.getPosition());
    this.gameStateManager.deductMoveTimeCost(opponentColor);
    this.gameStateManager.resolveDisturbTagsOnMove(opponentColor);

    this.opponentClockTime = Math.max(0, this.opponentClockTime - 3);
    this.opponentStopwatchTime += 3;

    this.logEvent(opponentColor, `Moved ${from} to ${to}`);

    // Check for king capture (Requirement 3.7)
    if (result.isKingCapture) {
      this.handleGameEnd(opponentColor, 'King captured!');
      return;
    }

    // Check for checkmate/stalemate after opponent move (Requirement 3.8)
    this.checkGameEndConditions();

    // Note: Turn ending is handled by the END_TURN network action
    // Don't call endTurn() here to avoid double turn switch
  }

  this.updateUIFromState();
}

/**
 * Handles opponent performing a mulligan
 * Deducts time cost and logs event
 */
export function handleOpponentMulligan(this: GameScene): void {
  const opponentColor = this.localColor === 'white' ? 'black' : 'white';
  this.gameStateManager.deductMulliganTimeCost(opponentColor);
  this.logEvent(opponentColor, 'Mulligan');
  this.opponentClockTime = Math.max(0, this.opponentClockTime - 10);
  this.updateUIFromState();
}

/**
 * Handles opponent signaling ready
 * Checks if both players are ready to start
 */
export function handleOpponentReady(this: GameScene): void {
  this.opponentPlayerReady = true;
  this.logEvent('system', 'Opponent is ready');
  // Check if both players are ready to start
  this.checkGameStart();
}
