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
 * Shows the mulligan phase UI
 * Displays overlay with mulligan and ready buttons
 */
export function showMulliganUI(this: GameScene): void {
  const { width, height } = this.scale;
  const layout = this.currentLayout ?? calculateLayout(width, height);
  const scale = layout.panelScale;

  // Semi-transparent overlay (using Rectangle for better performance)
  this.mulliganOverlay = this.add.rectangle(width / 2, height / 2, width, height, hex('#000000'), 0.5);
  this.mulliganOverlay.setDepth(50);

  // Instructions - title
  this.mulliganTitleText = this.add.text(width / 2, height / 2 - 180, 'Mulligan Phase', {
    fontSize: `${32 * scale}px`,
    fontFamily: 'BoldPixels, Arial',
    color: '#ffffff'
  }).setOrigin(0.5).setDepth(51);

  // Instructions - subtitle (more space from buttons)
  this.mulliganInstructionText = this.add.text(width / 2, height / 2 - 130, 'Mulligan costs 10 seconds. Click Done when ready.', {
    fontSize: `${16 * scale}px`,
    fontFamily: 'BoldPixels, Arial',
    color: '#cccccc'
  }).setOrigin(0.5).setDepth(51);

  // Mulligan button (red) - more space from text
  this.mulliganButton = createImageButton(this,
    width / 2 - 140 * scale, height / 2 - 40 * scale,
    'MULLIGAN (-10s)',
    'red_button',
    'red_button_pressed',
    () => this.handleMulligan()
  );
  this.mulliganButton.setDepth(51);
  this.mulliganButton.setData('baseScale', scale);
  this.mulliganButton.setScale(scale);

  // Ready button (blue)
  this.readyButton = createImageButton(this,
    width / 2 + 140 * scale, height / 2 - 40 * scale,
    'DONE',
    'blue_button',
    'blue_button_pressed',
    () => this.handleReady()
  );
  this.readyButton.setDepth(51);
  this.readyButton.setData('baseScale', scale);
  this.readyButton.setScale(scale);
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
  if (this.mulliganOverlay) {
    this.mulliganOverlay.destroy();
    this.mulliganOverlay = null;
  }
  if (this.mulliganButton) {
    this.mulliganButton.destroy();
    this.mulliganButton = null;
  }
  if (this.readyButton) {
    this.readyButton.destroy();
    this.readyButton = null;
  }
  if (this.mulliganTitleText) {
    this.mulliganTitleText.destroy();
    this.mulliganTitleText = null;
  }
  if (this.mulliganInstructionText) {
    this.mulliganInstructionText.destroy();
    this.mulliganInstructionText = null;
  }
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
    this.showTurnBanner(this.gameStateManager.getCurrentTurn());
    this.updateUIFromState();
    return;
  }

  // In multiplayer, wait for both players to be ready
  if (this.localPlayerReady && this.opponentPlayerReady) {
    this.gameStateManager.startGame();
    this.logEvent('system', 'Both players ready - Game started!');
    this.showTurnBanner(this.gameStateManager.getCurrentTurn());
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

      // Now end the turn
      this.sendLocalPlayerStats();
      this.gameStateManager.endTurn();
      if (this.networkManager) {
        const opponentColor = this.localColor === 'white' ? 'black' : 'white';
        this.opponentDisturbTags = this.gameStateManager.getPlayer(opponentColor).disturbTags;
      }
      this.networkManager?.sendEndTurn();
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
 * Logs result and transitions to EndScene
 *
 * @param winner - Winning player color (null for draw)
 * @param reason - Text description of how game ended
 */
export function handleGameEnd(this: GameScene, winner: PlayerColor | null, reason: string): void {
  this.gameStateManager.endGame();

  this.logEvent('system', reason);

  if (winner) {
    const isLocalWin = winner === this.localColor;
    this.logEvent('system', isLocalWin ? 'You win!' : 'You lose!');
  }

  // Transition to EndScene with network manager for rematch flow
  const finalStats = {
    turnNumber: this.gameStateManager.getState().turnNumber,
    localClock: this.playerClock.getTime(),
    opponentClock: this.opponentClock.getTime()
  };

  this.time.delayedCall(2000, () => {
    this.scene.start('EndScene', {
      winner,
      reason,
      localColor: this.localColor,
      playerName: this.playerName,
      opponentName: this.opponentName,
      finalStats,
      networkManager: this.networkManager
    });
  });
}
