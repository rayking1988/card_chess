/**
 * @fileoverview GameScene initialization helpers
 *
 * @module scenes/game/GameSceneInit
 */

import { DECK_SIZE, INITIAL_DRAW_COUNT } from '../../managers/DeckManager';
import { MAX_HAND_SIZE } from './GameConstants';
import type { GameScene } from '../GameScene';
import { CLOCK } from '../../config';

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
  this.opponentClockTime = CLOCK.INITIAL_SECONDS;
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
