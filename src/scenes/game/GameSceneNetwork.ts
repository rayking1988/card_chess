/**
 * @fileoverview GameScene network helpers
 *
 * @module scenes/game/GameSceneNetwork
 */

import { Square, Color, PieceSymbol } from 'chess.js';
import type { GameAction } from '../../managers/NetworkManager';
import { DECK_SIZE } from '../../managers/DeckManager';
import { mergeEventLogs } from '../../managers/network/stateSync';
import { effectRequiresTarget, normalizeCardEffects } from '../../managers/GameStateManager';
import type { GameScene } from '../GameScene';

/**
 * Sends the local player's name and initial state/event log sync if host.
 */
function sendInitialSync(scene: GameScene): void {
  const network = scene.networkManager;
  if (!network) return;

  network.sendPlayerName(scene.playerName);
  if (network.getIsHost()) {
    network.sendStateSync(scene.gameStateManager.getState());
    if (scene.eventLog) {
      const gameEntries = scene.eventLog.getEntries().filter(e => e.player !== 'chat') as any[];
      network.sendEventLogSync(gameEntries);
    }
  }
}

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
    // Preserve local player's deck/hand/discard when importing state from network
    // Each player manages their own cards locally, so we shouldn't overwrite them
    const localPlayerState = this.gameStateManager.getPlayer(this.localColor);
    const preservedLocalState = {
      deck: [...localPlayerState.deck],
      hand: [...localPlayerState.hand],
      discard: [...localPlayerState.discard]
    };
    
    // Also preserve the localPlayer field - it should always be this client's color
    const preservedLocalPlayer = this.gameStateManager.getState().localPlayer;
    
    this.gameStateManager.importState(state);
    
    // Restore local player's deck/hand/discard and localPlayer field
    const importedState = this.gameStateManager.getState();
    importedState.localPlayer = preservedLocalPlayer;
    importedState.players[this.localColor].deck = preservedLocalState.deck;
    importedState.players[this.localColor].hand = preservedLocalState.hand;
    importedState.players[this.localColor].discard = preservedLocalState.discard;
    this.gameStateManager.importState(importedState);
    
    this.updateUIFromState({ sendStats: false });
  });

  this.networkManager.onEventLogSync((entries) => {
    if (!this.eventLog) return;
    // Filter out chat entries (they're local only, not synced)
    const gameEntries = this.eventLog.getEntries().filter(e => e.player !== 'chat') as any[];
    const merged = mergeEventLogs(gameEntries, entries);
    this.eventLog.importEntries(merged);
  });

  this.networkManager.onPeerJoined((_peerId) => {
    this.hideConnectionOverlay();
    sendInitialSync(this);
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
    sendInitialSync(this);
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
      this.handleOpponentPlayCard(
        action.cardId,
        action.cardName,
        action.target,
        action.pieceType,
        action.effectAction,
        action.targets,
        action.pieceTypes,
        action.effectActions
      );
      break;
    case 'MOVE_PIECE':
      this.handleOpponentMovePiece(action.from, action.to, action.promotion);
      break;
    case 'MULLIGAN':
      this.handleOpponentMulligan(action.time_cost);
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
      const opponentColor = this.localColor === 'white' ? 'black' : 'white';
      const newTurn = this.gameStateManager.getCurrentTurn();
      
      // Update opponent hand count: they drew 1 card at turn start (except white's first turn)
      const isWhiteVeryFirstTurn = newTurn === 'white' && this.gameStateManager.getState().turnNumber === 1;
      if (!isWhiteVeryFirstTurn) {
        this.opponentHandCount = Math.min(this.opponentHandCount + 1, 7); // Max hand size is 7
      }
      
      this.logEvent('system', `Ending ${opponentColor}'s turn...`);
      this.logEvent('system', `Now ${newTurn}'s turn`);
      this.updateUIFromState();
      break;
    case 'DISCARD_CARDS': {
      const opponentColor = this.localColor === 'white' ? 'black' : 'white';
      const count = Math.max(1, action.count);
      const label = count === 1 ? 'card' : 'cards';
      this.logEvent(opponentColor, `Discarded ${count} ${label}`);
      break;
    }
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
    case 'OFFER_DRAW':
      this.handleOpponentOfferDraw();
      break;
    case 'ACCEPT_DRAW':
      this.handleOpponentAcceptDraw();
      break;
    case 'RESIGN':
      this.handleOpponentResign();
      break;
    case 'CHAT_MESSAGE':
      this.eventLog.addEntry('chat', action.message, action.senderName);
      break;
    case 'PLAYER_STATS_SYNC':
      this.handleOpponentStatsSync(
        action.clock,
        action.stopwatch,
        action.mode,
        action.deckCount,
        action.discardCount,
        action.handCount,
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
  handCount: number,
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

  // Use the received handCount directly instead of calculating it
  // This prevents false draw animations when stats sync arrives with stale deck/discard counts
  this.opponentHandCount = Math.max(0, handCount);
  // Don't add null values for unknown cards - only track cards we've seen via PLAY_CARD
  // If we have more cards than the sync says, trim the array
  if (this.opponentDiscardCards.length > discardCount) {
    this.opponentDiscardCards = this.opponentDiscardCards.slice(0, discardCount);
  }

  this.updateUIFromState({ sendStats: false });
}

/**
 * Send local player stats to opponent (throttled to reduce bandwidth)
 * Only sends if values changed or 500ms elapsed since last send
 */
export function sendLocalPlayerStats(this: GameScene): void {
  if (!this.networkManager) return;

  const localPlayer = this.gameStateManager.getPlayer(this.localColor);
  const now = Date.now();
  
  // Throttle: only send if 500ms elapsed since last send
  const STATS_THROTTLE_MS = 500;
  if (this.lastStatsSendTime && (now - this.lastStatsSendTime) < STATS_THROTTLE_MS) {
    // Check if any values actually changed
    const lastStats = this.lastSentStats;
    if (lastStats &&
        lastStats.clock === localPlayer.clock &&
        lastStats.stopwatch === localPlayer.stopwatch &&
        lastStats.mode === localPlayer.mode &&
        lastStats.deckCount === localPlayer.deck.length &&
        lastStats.discardCount === localPlayer.discard.length &&
        lastStats.handCount === localPlayer.hand.length &&
        lastStats.energy === localPlayer.energy &&
        lastStats.energyCap === localPlayer.energyCap &&
        lastStats.disturb === localPlayer.disturbTags) {
      return; // No changes, skip send
    }
  }
  
  this.lastStatsSendTime = now;
  this.lastSentStats = {
    clock: localPlayer.clock,
    stopwatch: localPlayer.stopwatch,
    mode: localPlayer.mode,
    deckCount: localPlayer.deck.length,
    discardCount: localPlayer.discard.length,
    handCount: localPlayer.hand.length,
    energy: localPlayer.energy,
    energyCap: localPlayer.energyCap,
    disturb: localPlayer.disturbTags
  };
  
  this.networkManager.sendPlayerStats(
    localPlayer.clock,
    localPlayer.stopwatch,
    localPlayer.mode,
    localPlayer.deck.length,
    localPlayer.discard.length,
    localPlayer.hand.length,
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
  effectAction?: string,
  targets?: string[],
  pieceTypes?: Array<string | null>,
  effectActions?: string[]
): void {
  const opponentColor = this.localColor === 'white' ? 'black' : 'white';
  const cardData = this.getCardDataByName(cardName);

  this.logEvent(opponentColor, `Played ${cardName}`);

  if (this.networkManager) {
    // Decrement hand count but don't trigger UI update yet - animation will handle it
    this.opponentHandCount = Math.max(0, this.opponentHandCount - 1);
  }

  // Pass cardData to animation, which will add to discard after animation completes
  const targetsList = targets ?? (target ? [target] : []);
  const actionList = effectActions ?? (effectAction ? [effectAction] : []);
  const pieceList = pieceTypes ?? (pieceType ? [pieceType] : []);
  const derivedTargetEffects = cardData
    ? normalizeCardEffects(cardData.effect).filter(
        effect => effect.action === 'DEPLOY_PIECE' || effect.action === 'DESTROY_PIECE' || effectRequiresTarget(effect)
      )
    : [];
  const derivedActions = actionList.length > 0
    ? actionList
    : derivedTargetEffects.map(effect => effect.action);
  const animateTarget = targetsList.length > 0 ? (targetsList[targetsList.length - 1] as Square) : (target as Square | undefined);

  this.animateCardPlay(cardData, 'opponent', animateTarget, () => {
    // Add card to discard after animation completes
    if (this.networkManager && cardData) {
      this.opponentDiscardCount = Math.min(DECK_SIZE, this.opponentDiscardCount + 1);
      this.opponentDiscardCards.push(cardData);
    }
    // Update UI after animation completes to show correct hand count
    this.updateUIFromState();
  });

  // Handle piece deployment/destruction on board
  let boardModified = false;
  for (let i = 0; i < targetsList.length; i++) {
    const targetSquare = targetsList[i] as Square;
    const action = derivedActions[i];
    if (!action) continue;

    if (action === 'DEPLOY_PIECE') {
      let deployPiece = pieceList[i] as PieceSymbol | undefined;
      const fallback = derivedTargetEffects[i];
      if (!deployPiece && fallback && fallback.action === 'DEPLOY_PIECE') {
        deployPiece = fallback.piece as PieceSymbol;
      }
      if (!deployPiece) continue;
      const color: Color = opponentColor === 'white' ? 'w' : 'b';
      this.chessBoard.placePiece(targetSquare, deployPiece, color);
      this.gameStateManager.trackDeployedPiece(opponentColor, targetSquare, false);
      this.animatePieceDeploy(targetSquare);
      boardModified = true;
    } else if (action === 'DESTROY_PIECE') {
      const targetPiece = this.chessBoard.getWrapper().getPiece(targetSquare);
      this.chessBoard.removePiece(targetSquare);
      if (targetPiece) {
        this.animatePieceDestroy(targetPiece, targetSquare);
      }
      boardModified = true;
    }
  }

  if (boardModified) {
    this.gameStateManager.setBoardFEN(this.chessBoard.getPosition());
  }

  if (cardData) {
    // Apply disturb tag penalty/time before card cost (matches local play order)
    // Note: We don't call deductTime here because the opponent's stopwatch
    // is already synced via PLAYER_STATS_SYNC. Calling deductTime would add
    // the time cost twice.
    this.gameStateManager.resolveDisturbTagsOnCardPlay(opponentColor, cardData);
  }

  // Update local tracking of opponent's state from their synced values
  if (cardData) {
    const opponentState = this.gameStateManager.getPlayer(opponentColor);
    this.opponentClockTime = opponentState.clock;
    this.opponentStopwatchTime = opponentState.stopwatch;
    this.opponentDisturbTags = opponentState.disturbTags;
  }
  
  // Check stopwatch threshold for opponent - if reached, local player draws
  // The opponent's stopwatch value comes from their stats sync
  const cardsDrawn = this.gameStateManager.checkStopwatchThreshold(opponentColor);
  if (cardsDrawn > 0) {
    this.logEvent('system', `You drew ${cardsDrawn} card(s) (opponent stopwatch threshold)`);
    this.updateHandDisplay();
  }

  this.checkCardPlayEndConditions();
  // Don't call updateUIFromState here - let the animation callback handle it
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
    // Note: We don't call deductMoveTimeCost here because the opponent's stopwatch
    // is already synced via PLAYER_STATS_SYNC. Calling it would add time twice.
    this.gameStateManager.resolveDisturbTagsOnMove(opponentColor);
    const opponentState = this.gameStateManager.getPlayer(opponentColor);
    this.opponentClockTime = opponentState.clock;
    this.opponentStopwatchTime = opponentState.stopwatch;
    this.opponentDisturbTags = opponentState.disturbTags;

    // Log move with piece type (K=King, Q=Queen, R=Rook, B=Bishop, N=Knight, P=Pawn)
    const pieceSymbol = movingPiece ? movingPiece.type.toUpperCase() : '?';
    this.logEvent(opponentColor, `Moved ${pieceSymbol} ${from} to ${to}`);

    // Check stopwatch threshold for opponent - if reached, local player draws
    const cardsDrawn = this.gameStateManager.checkStopwatchThreshold(opponentColor);
    if (cardsDrawn > 0) {
      this.logEvent('system', `You drew ${cardsDrawn} card(s) (opponent stopwatch threshold)`);
      this.updateHandDisplay();
    }

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
 * Logs event (time cost is already synced via PLAYER_STATS_SYNC)
 */
export function handleOpponentMulligan(this: GameScene, time_cost: number): void {
  const opponentColor = this.localColor === 'white' ? 'black' : 'white';
  // Note: We don't call deductMulliganTimeCost here because the opponent's stopwatch
  // is already synced via PLAYER_STATS_SYNC. Calling it would add time twice.
  this.logEvent(opponentColor, `Mulligan (-${time_cost}s)`);
  const opponentState = this.gameStateManager.getPlayer(opponentColor);
  this.opponentClockTime = opponentState.clock;
  this.opponentStopwatchTime = opponentState.stopwatch;
  this.updateUIFromState();
}

/**
 * Handles opponent signaling ready
 * Checks if both players are ready to start
 */
export function handleOpponentReady(this: GameScene): void {
  this.opponentPlayerReady = true;
  const opponentColor = this.localColor === 'white' ? 'black' : 'white';
  this.logEvent(opponentColor, 'Finished mulligan');
  // Check if both players are ready to start
  this.checkGameStart();
}
