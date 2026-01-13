/**
 * @fileoverview GameScene flow helpers (init, mulligan, discard, end)
 *
 * @module scenes/game/GameSceneFlow
 */

import type { Card, PlayerColor } from '../../managers/GameStateManager';
import { DECK_SIZE, INITIAL_DRAW_COUNT } from '../../managers/DeckManager';
import { MAX_HAND_SIZE } from './GameConstants';
import { calculateLayout } from './GameLayout';
import { createImageButton } from './GameUIHelpers';
import { hex } from '../../utils/colors';
import type { GameScene } from '../GameScene';

const INTERACTION_BLOCKER_ALPHA = 0.3;
const INTERACTION_BLOCKER_DEPTH = 90;

/**
 * Initializes the game state
 * Requirement 3.1: Initialize and shuffle deck at game start
 *
 * Algorithm:
 * 1. Initialize and shuffle deck
 * 2. Set deck in game state
 * 3. Draw initial hand (7 cards)
 * 4. Initialize opponent UI counts
 * 5. Show mulligan UI
 */
export function initializeGame(this: GameScene): void {
  // Initialize and shuffle deck (Requirement 3.1)
  this.localDeckManager.initializeDeck();
  this.localDeckManager.shuffle();

  // Set deck in game state
  this.gameStateManager.setDeck(this.localColor, this.localDeckManager.getDeck());

  // Draw initial hand (7 cards)
  this.gameStateManager.drawCards(this.localColor, 7, false);

  // Initialize opponent counts for UI
  this.opponentDeckCount = DECK_SIZE - INITIAL_DRAW_COUNT;
  this.opponentDiscardCount = 0;
  this.opponentHandCount = INITIAL_DRAW_COUNT;
  this.opponentClockTime = 600;
  this.opponentStopwatchTime = 0;
  this.opponentDiscardCards = [];

  // Update hand display
  this.updateHandDisplay();

  // Show mulligan UI
  this.showMulliganUI();

  // Log game start
  this.logEvent('system', 'Game started');
  this.logEvent(this.localColor, 'Drew 7 cards');

  this.updateUIFromState();
}

/**
 * Updates the card hand display from game state
 */
export function updateHandDisplay(this: GameScene): void {
  const hand = this.gameStateManager.getHand(this.localColor);
  this.cardHand.setCards(hand);
  this.updateCardCount();
}

/**
 * Updates the card count indicator text
 * Changes color based on hand size (red if over limit)
 */
export function updateCardCount(this: GameScene): void {
  const count = this.cardHand.getCardCount();
  this.cardCountText.setText(`Hand: ${count} / ${MAX_HAND_SIZE}`);

  if (count > MAX_HAND_SIZE) {
    this.cardCountText.setColor('#ff6666');
  } else if (count === MAX_HAND_SIZE) {
    this.cardCountText.setColor('#ffff66');
  } else {
    this.cardCountText.setColor('#ffffff');
  }
}

/**
 * Refreshes interaction blockers to cover everything except the event log
 */
export function refreshInteractionBlockers(this: GameScene): void {
  if (!this.interactionBlockersActive || !this.eventLog) return;

  const { width, height } = this.scale;
  const bounds = this.eventLog.getContainer().getBounds();
  const left = Math.max(0, Math.min(width, bounds.x));
  const right = Math.max(0, Math.min(width, bounds.x + bounds.width));
  const top = Math.max(0, Math.min(height, bounds.y));
  const bottom = Math.max(0, Math.min(height, bounds.y + bounds.height));
  const middleHeight = Math.max(0, bottom - top);

  this.interactionBlockers.forEach(rect => rect.destroy());
  this.interactionBlockers = [];

  const addBlocker = (x: number, y: number, w: number, h: number): void => {
    if (w <= 0 || h <= 0) return;
    const rect = this.add.rectangle(x, y, w, h, hex('#000000'), INTERACTION_BLOCKER_ALPHA);
    rect.setDepth(INTERACTION_BLOCKER_DEPTH);
    rect.setInteractive();
    this.interactionBlockers.push(rect);
  };

  addBlocker(width / 2, top / 2, width, top);
  addBlocker(width / 2, bottom + (height - bottom) / 2, width, height - bottom);
  if (middleHeight > 0) {
    addBlocker(left / 2, top + middleHeight / 2, left, middleHeight);
    addBlocker(right + (width - right) / 2, top + middleHeight / 2, width - right, middleHeight);
  }
}

/**
 * Clears interaction blockers
 */
export function clearInteractionBlockers(this: GameScene): void {
  this.interactionBlockers.forEach(rect => rect.destroy());
  this.interactionBlockers = [];
  this.interactionBlockersActive = false;
}

/**
 * Shows the mulligan phase UI
 * Displays overlay with mulligan and ready buttons
 */
export function showMulliganUI(this: GameScene): void {
  const { width, height } = this.scale;
  const layout = this.currentLayout ?? calculateLayout(width, height);
  const scale = layout.panelScale;

  this.isMobileEventLogVisible = true;
  this.positionEventLog(layout);
  this.interactionBlockersActive = true;
  this.refreshInteractionBlockers();
  this.cardHand.disableInteraction();

  const overlayWidth = layout.boardSize;
  const overlayHeight = this.boardSquareSize * 2;
  const overlayX = this.boardTopLeft.x + overlayWidth / 2;
  const overlayY = this.boardTopLeft.y + this.boardSquareSize * 3 + overlayHeight / 2;

  if (!this.mulliganBannerRect) {
    this.mulliganBannerRect = this.add.rectangle(overlayX, overlayY, overlayWidth, overlayHeight, hex('#ff9a2a'), 0.9);
    this.mulliganBannerRect.setDepth(120);
  } else {
    this.mulliganBannerRect.setPosition(overlayX, overlayY);
    this.mulliganBannerRect.setSize(overlayWidth, overlayHeight);
  }

  if (!this.mulliganTitleText) {
    this.mulliganTitleText = this.add.text(overlayX, overlayY - overlayHeight * 0.18, 'Mulligan?', {
      fontSize: `${28 * scale}px`,
      fontFamily: 'BoldPixels, Arial',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(121);
  } else {
    this.mulliganTitleText.setPosition(overlayX, overlayY - overlayHeight * 0.18);
    this.mulliganTitleText.setFontSize(28 * scale);
    this.mulliganTitleText.setText('Mulligan?');
  }

  const buttonScale = scale * 0.8;
  const buttonY = overlayY + overlayHeight * 0.18;
  const buttonOffset = 160 * scale;

  if (!this.mulliganButton) {
    this.mulliganButton = createImageButton(
      this,
      overlayX - buttonOffset,
      buttonY,
      'Mulligan (-10)',
      'yellow_button',
      'yellow_button_pressed',
      () => this.handleMulligan()
    );
    this.mulliganButton.setDepth(122);
  } else {
    this.mulliganButton.setPosition(overlayX - buttonOffset, buttonY);
  }
  this.mulliganButton.setData('baseScale', buttonScale);
  this.mulliganButton.setScale(buttonScale);

  if (!this.readyButton) {
    this.readyButton = createImageButton(
      this,
      overlayX + buttonOffset,
      buttonY,
      'Keep Hand',
      'blue_button',
      'blue_button_pressed',
      () => this.handleReady()
    );
    this.readyButton.setDepth(122);
  } else {
    this.readyButton.setPosition(overlayX + buttonOffset, buttonY);
  }
  this.readyButton.setData('baseScale', buttonScale);
  this.readyButton.setScale(buttonScale);
}

/**
 * Handles mulligan button click
 * Returns hand to deck, reshuffles, and draws new hand
 * Deducts 10 seconds from clock
 */
export function handleMulligan(this: GameScene): void {
  // Deduct mulligan time cost (Requirement 3.2)
  this.gameStateManager.deductMulliganTimeCost(this.localColor);

  // Return hand to deck and reshuffle
  const hand = this.gameStateManager.getHand(this.localColor);
  const deck = this.gameStateManager.getDeck(this.localColor);

  // Put hand back in deck
  const newDeck = [...deck, ...hand];
  this.gameStateManager.setDeck(this.localColor, newDeck);

  // Clear hand in state (manually update player state)
  const state = this.gameStateManager.getState();
  state.players[this.localColor].hand = [];
  this.gameStateManager.importState(state);

  // Shuffle and draw new hand
  this.gameStateManager.shuffleDeck(this.localColor);
  this.gameStateManager.drawCards(this.localColor, 7, false);

  // Update display
  this.updateHandDisplay();

  this.logEvent(this.localColor, 'Mulligan (-10s)');

  // Send to network
  this.networkManager?.sendMulligan();

  this.updateUIFromState();
}

/**
 * Handles ready button click
 * Marks local player as ready and checks if game can start
 */
export function handleReady(this: GameScene): void {
  // Mark local player as ready
  this.localPlayerReady = true;

  // Hide mulligan UI
  this.hideMulliganUI();

  this.logEvent('system', 'Ready to play');

  // Send to network
  this.networkManager?.sendReady();

  // Check if both players are ready (or single player mode)
  this.checkGameStart();

  this.updateUIFromState();
}

/**
 * Hides the mulligan UI elements
 */
export function hideMulliganUI(this: GameScene): void {
  if (this.mulliganButton) {
    this.mulliganButton.destroy();
    this.mulliganButton = null;
  }
  if (this.readyButton) {
    this.readyButton.destroy();
    this.readyButton = null;
  }
  if (this.mulliganBannerRect) {
    this.mulliganBannerRect.destroy();
    this.mulliganBannerRect = null;
  }
  if (this.mulliganTitleText) {
    this.mulliganTitleText.destroy();
    this.mulliganTitleText = null;
  }
  if (this.mulliganInstructionText) {
    this.mulliganInstructionText.destroy();
    this.mulliganInstructionText = null;
  }
  this.clearInteractionBlockers();
  this.cardHand.enableInteraction();
}

/**
 * Checks if both players are ready to start the game
 * In single-player mode, starts immediately when local player is ready
 */
export function checkGameStart(this: GameScene): void {
  // In single player mode (no network), start immediately when local player is ready
  if (!this.networkManager && this.localPlayerReady) {
    this.gameStateManager.startGame();
    this.logEvent('system', 'Game started!');
    // Reset lastTurnOverlayTurn to force the turn overlay to show
    this.lastTurnOverlayTurn = undefined;
    this.updateUIFromState();
    return;
  }

  // In multiplayer, wait for both players to be ready
  if (this.localPlayerReady && this.opponentPlayerReady) {
    this.gameStateManager.startGame();
    this.logEvent('system', 'Both players ready - Game started!');
    // Reset lastTurnOverlayTurn to force the turn overlay to show
    this.lastTurnOverlayTurn = undefined;
    this.updateUIFromState();
  }
}

/**
 * Enters discard mode when hand exceeds maximum size
 * Shows overlay prompting player to discard cards
 */
export function enterDiscardMode(this: GameScene): void {
  this.isDiscardMode = true;
  const { width, height } = this.scale;
  const layout = this.currentLayout ?? calculateLayout(width, height);
  const scale = layout.panelScale;

  // Semi-transparent overlay (using Rectangle for better performance)
  this.discardOverlay = this.add.rectangle(width / 2, height / 2, width, height, hex('#000000'), 0.3);
  this.discardOverlay.setDepth(45);

  // Prompt text
  const handSize = this.gameStateManager.getHandSize(this.localColor);
  const toDiscard = handSize - MAX_HAND_SIZE;

  this.discardPromptText = this.add.text(
    width / 2, height / 2 - 150 * scale,
    `Discard ${toDiscard} card(s) to continue`,
    {
      fontSize: `${24 * scale}px`,
      fontFamily: 'BoldPixels, Arial',
      color: '#ff6666'
    }
  ).setOrigin(0.5).setDepth(46);

  this.logEvent('system', `Hand size exceeds 7. Discard ${toDiscard} card(s).`);
}

/**
 * Discards a card from hand
 * Called when clicking a card in discard mode
 *
 * @param card - Card to discard
 */
export function discardCard(this: GameScene, card: Card): void {
  // Remove card from hand and add to discard
  const state = this.gameStateManager.getState();
  const playerState = state.players[this.localColor];

  const cardIndex = playerState.hand.findIndex(c => c.id === card.id);
  if (cardIndex !== -1) {
    const [discardedCard] = playerState.hand.splice(cardIndex, 1);
    playerState.discard.push(discardedCard);
    this.gameStateManager.importState(state);

    this.logEvent(this.localColor, `Discarded ${card.name}`);
    this.animateCardDiscard('local', 1);

    // Update hand display
    this.updateHandDisplay();

    // Check if we're done discarding
    if (playerState.hand.length <= MAX_HAND_SIZE) {
      this.exitDiscardMode();

      // Calculate disturb to add to opponent BEFORE endTurn clears energy
      const localPlayer = this.gameStateManager.getPlayer(this.localColor);
      const disturbToAdd = localPlayer.mode === 'disturb' ? localPlayer.energy : 0;
      
      // Send local player stats before ending turn (includes energy before conversion)
      this.sendLocalPlayerStats();
      
      // Now end the turn - this processes mode effects and adds disturb to opponent
      this.gameStateManager.endTurn();
      
      // Send END_TURN to opponent with the disturb amount
      if (this.networkManager) {
        this.networkManager.sendEndTurn(disturbToAdd);
      }
    } else {
      // Update prompt
      const toDiscard = playerState.hand.length - MAX_HAND_SIZE;
      if (this.discardPromptText) {
        this.discardPromptText.setText(`Discard ${toDiscard} card(s) to continue`);
      }
    }
  }

  this.updateUIFromState();
}

/**
 * Exits discard mode
 * Cleans up overlay elements
 */
export function exitDiscardMode(this: GameScene): void {
  this.isDiscardMode = false;

  if (this.discardOverlay) {
    this.discardOverlay.destroy();
    this.discardOverlay = null;
  }
  if (this.discardPromptText) {
    this.discardPromptText.destroy();
    this.discardPromptText = null;
  }
}

/**
 * Checks for game-ending conditions
 * - Checkmate (Requirement 3.8)
 * - Stalemate (Requirement 3.8)
 * - Clock timeout (Requirement 4.5)
 */
export function checkGameEndConditions(this: GameScene): void {
  const wrapper = this.chessBoard.getWrapper();

  // Check for checkmate (Requirement 3.8)
  if (wrapper.isCheckmate()) {
    const winner = wrapper.getTurn() === 'w' ? 'black' : 'white';
    this.handleGameEnd(winner as PlayerColor, 'Checkmate!');
    return;
  }

  // Check for stalemate (Requirement 3.8)
  if (wrapper.isStalemate()) {
    this.handleGameEnd(null, 'Stalemate - Draw!');
    return;
  }

  // Check for clock timeout (Requirement 4.5)
  // In multiplayer, only check local player's clock - opponent handles their own timeout
  // In single player, check both clocks
  const localClock = this.gameStateManager.getPlayer(this.localColor).clock;

  if (this.networkManager) {
    // Multiplayer: only check local player's clock
    if (localClock <= 0) {
      const winner = this.localColor === 'white' ? 'black' : 'white';
      this.handleGameEnd(winner as PlayerColor, `${this.localColor === 'white' ? 'White' : 'Black'} ran out of time!`);
      return;
    }
  } else {
    // Single player: check both clocks
    const opponentColor = this.localColor === 'white' ? 'black' : 'white';
    const opponentClock = this.gameStateManager.getPlayer(opponentColor).clock;
    const whiteClock = this.localColor === 'white' ? localClock : opponentClock;
    const blackClock = this.localColor === 'black' ? localClock : opponentClock;

    if (whiteClock <= 0) {
      this.handleGameEnd('black', 'White ran out of time!');
      return;
    }
    if (blackClock <= 0) {
      this.handleGameEnd('white', 'Black ran out of time!');
      return;
    }
  }
}

/**
 * Handles game end
 * Logs result and shows end-game overlay
 *
 * @param winner - Winning player color (null for draw)
 * @param reason - Text description of how game ended
 */
export function handleGameEnd(this: GameScene, winner: PlayerColor | null, reason: string): void {
  if (this.gameStateManager.getPhase() === 'ended') return;

  this.gameStateManager.endGame();

  this.logEvent('system', reason);

  if (winner) {
    const isLocalWin = winner === this.localColor;
    this.logEvent('system', isLocalWin ? 'You win!' : 'You lose!');
  }

  const layout = this.currentLayout ?? calculateLayout(this.scale.width, this.scale.height);
  this.isMobileEventLogVisible = true;
  this.positionEventLog(layout);
  this.interactionBlockersActive = true;
  this.refreshInteractionBlockers();
  this.cardHand.disableInteraction();

  const overlayWidth = layout.boardSize;
  const overlayHeight = this.boardSquareSize * 2;
  const overlayX = this.boardTopLeft.x + overlayWidth / 2;
  const overlayY = this.boardTopLeft.y + this.boardSquareSize * 3 + overlayHeight / 2;

  const isLocalWin = winner === this.localColor;
  const bannerText = winner === null ? 'Draw' : isLocalWin ? 'You win!' : 'You lose';
  const bannerColor = winner === null ? '#777777' : isLocalWin ? '#2e6bff' : '#cc3333';

  if (!this.gameEndBannerRect) {
    this.gameEndBannerRect = this.add.rectangle(overlayX, overlayY, overlayWidth, overlayHeight, hex(bannerColor), 0.9);
    this.gameEndBannerRect.setDepth(140);
  } else {
    this.gameEndBannerRect.setPosition(overlayX, overlayY);
    this.gameEndBannerRect.setSize(overlayWidth, overlayHeight);
    this.gameEndBannerRect.setFillStyle(hex(bannerColor), 0.9);
  }

  if (!this.gameEndBannerText) {
    this.gameEndBannerText = this.add.text(overlayX, overlayY - overlayHeight * 0.18, bannerText, {
      fontSize: `${30 * layout.panelScale}px`,
      fontFamily: 'BoldPixels, Arial',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(141);
  } else {
    this.gameEndBannerText.setPosition(overlayX, overlayY - overlayHeight * 0.18);
    this.gameEndBannerText.setFontSize(30 * layout.panelScale);
    this.gameEndBannerText.setText(bannerText);
  }

  this.localRematchRequested = false;
  this.opponentRematchRequested = false;

  const buttonScale = layout.panelScale * 0.8;
  const buttonY = overlayY + overlayHeight * 0.18;
  const buttonOffset = 180 * layout.panelScale;

  if (!this.gameEndRematchButton) {
    this.gameEndRematchButton = createImageButton(
      this,
      overlayX - buttonOffset,
      buttonY,
      'Rematch',
      'blue_button',
      'blue_button_pressed',
      () => this.handleRematchRequest()
    );
    this.gameEndRematchButton.setDepth(142);
  } else {
    this.gameEndRematchButton.setPosition(overlayX - buttonOffset, buttonY);
  }
  this.gameEndRematchButton.setData('baseScale', buttonScale);
  this.gameEndRematchButton.setScale(buttonScale);
  this.gameEndRematchButton.setInteractive({ useHandCursor: true });
  this.gameEndRematchButton.setAlpha(1);

  if (!this.gameEndMenuButton) {
    this.gameEndMenuButton = createImageButton(
      this,
      overlayX + buttonOffset,
      buttonY,
      'Back to Main Menu',
      'brown_button',
      'brown_button_pressed',
      () => this.handleReturnToMenu()
    );
    this.gameEndMenuButton.setDepth(142);
  } else {
    this.gameEndMenuButton.setPosition(overlayX + buttonOffset, buttonY);
  }
  this.gameEndMenuButton.setData('baseScale', buttonScale);
  this.gameEndMenuButton.setScale(buttonScale);
}

/**
 * Handles rematch button click
 */
export function handleRematchRequest(this: GameScene): void {
  if (!this.networkManager) {
    this.startRematch();
    return;
  }
  if (this.localRematchRequested) return;
  this.localRematchRequested = true;

  if (this.gameEndRematchButton) {
    this.gameEndRematchButton.disableInteractive();
    this.gameEndRematchButton.setAlpha(0.7);
  }

  this.logEvent('system', 'Rematch requested');
  this.networkManager?.sendRematchRequest();

  if (this.opponentRematchRequested) {
    this.startRematch();
  }
}

/**
 * Handles receiving a rematch request
 */
export function handleRematchReceived(this: GameScene): void {
  if (this.opponentRematchRequested) return;
  this.opponentRematchRequested = true;
  this.logEvent('system', `${this.opponentName} wants a rematch`);

  if (this.localRematchRequested) {
    this.startRematch();
  }
}

/**
 * Handles opponent declining rematch
 */
export function handleRematchDeclined(this: GameScene): void {
  this.localRematchRequested = false;
  this.opponentRematchRequested = false;
  this.logEvent('system', 'Opponent declined rematch');
  if (this.gameEndRematchButton) {
    this.gameEndRematchButton.setInteractive({ useHandCursor: true });
    this.gameEndRematchButton.setAlpha(1);
  }
}

/**
 * Starts rematch with swapped colors
 */
export function startRematch(this: GameScene): void {
  this.clearInteractionBlockers();
  const newLocalColor: PlayerColor = this.localColor === 'white' ? 'black' : 'white';
  this.time.delayedCall(300, () => {
    this.scene.start('GameScene', {
      playerName: this.playerName,
      localColor: newLocalColor,
      networkManager: this.networkManager,
      opponentName: this.opponentName
    });
  });
}

/**
 * Returns to main menu and disconnects
 */
export function handleReturnToMenu(this: GameScene): void {
  this.networkManager?.sendRematchDecline();
  this.networkManager?.leaveRoom();
  this.scene.start('MenuScene');
}
