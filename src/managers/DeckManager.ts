/**
 * @fileoverview DeckManager - Manages deck operations for Card Chess
 * 
 * This module handles all deck-related operations including:
 * - Deck initialization with 60 cards
 * - Shuffling using Fisher-Yates algorithm
 * - Drawing cards to hand
 * - Discarding cards
 * - State import/export for synchronization
 * 
 * Requirements addressed:
 * - 3.1: Shuffle both players' decks at game start, each player draws 7 cards
 * - 11.2: Support "Shuffle the deck" action
 * - 11.3: Support "Draw x cards" action (ignoring hand cap)
 * - 11.4: Support "Draw 1 card, up to max handsize" action
 * - 11.5: Support "Discard cards to max handsize" action
 * 
 * @module managers/DeckManager
 * @requires ./GameStateManager
 * @requires ../data/cards
 */

import { Card } from './GameStateManager';
import { createDeck, resetCardIdCounter } from '../data/cards';

/* ============================================
 * CONSTANTS
 * ============================================
 */

/** Total number of cards in a deck */
export const DECK_SIZE = 60;

/** Maximum number of cards allowed in hand */
export const MAX_HAND_SIZE = 7;

/** Number of cards drawn at game start */
export const INITIAL_DRAW_COUNT = 7;

/* ============================================
 * DECK MANAGER CLASS
 * ============================================
 */

/**
 * DeckManager - Manages deck, hand, and discard pile operations
 * 
 * This class maintains three card zones:
 * - Deck: Face-down draw pile
 * - Hand: Cards available to play
 * - Discard: Used/discarded cards
 * 
 * Card Flow:
 * - Deck -> Hand: Drawing cards
 * - Hand -> Discard: Playing or discarding cards
 * - Discard -> Deck: Reshuffling (when deck is empty)
 * 
 * @example
 * const deckManager = new DeckManager();
 * deckManager.initializeDeck();
 * deckManager.shuffle();
 * deckManager.drawInitialHand(); // Draws 7 cards
 * 
 * // During gameplay
 * const card = deckManager.getCardFromHand(cardId);
 * deckManager.removeFromHand(cardId);
 * deckManager.addToDiscard(card);
 * 
 * Used by: GameScene for local player's deck management
 */
export class DeckManager {
  /** Cards remaining in the draw pile */
  private deck: Card[] = [];
  
  /** Cards currently in hand */
  private hand: Card[] = [];
  
  /** Cards that have been played or discarded */
  private discard: Card[] = [];

  /**
   * Creates a new DeckManager instance
   * 
   * Starts with empty deck, hand, and discard.
   * Call initializeDeck() to populate with cards.
   * 
   * Used by: GameScene.create()
   */
  constructor() {
    // Initialize with empty state
  }

  /* ============================================
   * INITIALIZATION
   * ============================================
   */

  /**
   * Initializes a new deck with all 60 cards
   * 
   * Algorithm:
   * 1. Reset the card ID counter for consistent IDs
   * 2. Create a new deck using card definitions
   * 3. Clear hand and discard piles
   * 
   * Note: Deck is NOT shuffled - call shuffle() separately.
   * 
   * Used by: GameScene.initializeGame()
   */
  initializeDeck(): void {
    resetCardIdCounter();
    this.deck = createDeck();
    this.hand = [];
    this.discard = [];
  }

  /* ============================================
   * SHUFFLING
   * ============================================
   */

  /**
   * Shuffles the deck using Fisher-Yates algorithm
   * 
   * Algorithm (Fisher-Yates):
   * 1. Start from the last element
   * 2. Pick a random element from 0 to current index
   * 3. Swap current element with the random element
   * 4. Move to the previous element and repeat
   * 
   * Time complexity: O(n)
   * Space complexity: O(1) - in-place shuffle
   * 
   * Used by: GameScene.initializeGame(), card effects
   */
  shuffle(): void {
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  /**
   * Shuffles with a provided random function (for testing)
   * 
   * Allows deterministic shuffling in tests by providing
   * a seeded random number generator.
   * 
   * @param randomFn - Function returning random number 0-1
   * 
   * Used by: Unit tests
   */
  shuffleWithRandom(randomFn: () => number): void {
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(randomFn() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  /* ============================================
   * DRAWING CARDS
   * ============================================
   */

  /**
   * Draws cards from deck to hand
   * 
   * Algorithm:
   * 1. For each card to draw:
   *    a. Check if deck is empty - stop if so
   *    b. If respectCap, check if hand is at max - stop if so
   *    c. Pop card from deck and add to hand
   * 2. Return number of cards actually drawn
   * 
   * @param count - Number of cards to draw
   * @param respectCap - If true, won't draw beyond MAX_HAND_SIZE
   * @returns Number of cards actually drawn
   * 
   * Used by: GameScene for draw effects, turn start draws
   */
  draw(count: number, respectCap: boolean = false): number {
    let drawn = 0;

    for (let i = 0; i < count; i++) {
      // Check if deck is empty
      if (this.deck.length === 0) break;
      
      // Check hand cap if respecting it
      if (respectCap && this.hand.length >= MAX_HAND_SIZE) break;

      const card = this.deck.pop();
      if (card) {
        this.hand.push(card);
        drawn++;
      }
    }

    return drawn;
  }

  /**
   * Draws the initial hand of 7 cards
   * 
   * Called at game start. Does not respect hand cap
   * (always draws exactly 7 if deck has enough cards).
   * 
   * @returns Number of cards drawn (should be 7)
   * 
   * Used by: GameScene.initializeGame()
   */
  drawInitialHand(): number {
    return this.draw(INITIAL_DRAW_COUNT, false);
  }

  /* ============================================
   * DISCARDING
   * ============================================
   */

  /**
   * Discards a specific card from hand
   * 
   * Moves a card from hand to discard pile.
   * 
   * @param cardId - ID of the card to discard
   * @returns The discarded card, or null if not found
   * 
   * Used by: GameScene for discard effects
   */
  discardCard(cardId: string): Card | null {
    const index = this.hand.findIndex(c => c.id === cardId);
    if (index === -1) return null;

    const [card] = this.hand.splice(index, 1);
    this.discard.push(card);
    return card;
  }

  /**
   * Discards cards until hand is at max size
   * 
   * If hand exceeds MAX_HAND_SIZE, removes cards from the end
   * until hand size equals MAX_HAND_SIZE.
   * 
   * @returns Array of discarded cards
   * 
   * Used by: GameScene for forced discard at turn end
   */
  discardToHandSize(): Card[] {
    const discarded: Card[] = [];

    while (this.hand.length > MAX_HAND_SIZE) {
      const card = this.hand.pop();
      if (card) {
        this.discard.push(card);
        discarded.push(card);
      }
    }

    return discarded;
  }

  /* ============================================
   * HAND MANAGEMENT
   * ============================================
   */

  /**
   * Removes a card from hand (when played)
   * 
   * Unlike discardCard, this doesn't add to discard pile.
   * Use when the card will be added to discard separately
   * (e.g., after resolving its effect).
   * 
   * @param cardId - ID of the card to remove
   * @returns The removed card, or null if not found
   * 
   * Used by: GameScene.handleCardPlay()
   */
  removeFromHand(cardId: string): Card | null {
    const index = this.hand.findIndex(c => c.id === cardId);
    if (index === -1) return null;

    const [card] = this.hand.splice(index, 1);
    return card;
  }

  /**
   * Adds a card to the discard pile
   * 
   * Called after a card's effect has been resolved.
   * 
   * @param card - The card to add to discard
   * 
   * Used by: GameScene.handleCardPlay()
   */
  addToDiscard(card: Card): void {
    this.discard.push(card);
  }

  /**
   * Gets a card from hand by ID without removing it
   * 
   * @param cardId - ID of the card to find
   * @returns The card, or null if not found
   * 
   * Used by: GameScene for card validation
   */
  getCardFromHand(cardId: string): Card | null {
    return this.hand.find(c => c.id === cardId) || null;
  }

  /**
   * Shuffles discard pile back into deck
   * 
   * Called when deck is empty and more cards are needed.
   * Moves all cards from discard to deck and shuffles.
   * 
   * Used by: GameScene when deck runs out
   */
  reshuffleDiscard(): void {
    this.deck.push(...this.discard);
    this.discard = [];
    this.shuffle();
  }


  /* ============================================
   * GETTERS
   * ============================================
   * Methods for accessing deck state.
   * All return copies to prevent external mutation.
   */

  /**
   * Gets a copy of the current deck
   * 
   * @returns Array of cards in deck (copy)
   */
  getDeck(): Card[] {
    return [...this.deck];
  }

  /**
   * Gets a copy of the current hand
   * 
   * @returns Array of cards in hand (copy)
   * 
   * Used by: GameScene.updateUI(), CardHandComponent
   */
  getHand(): Card[] {
    return [...this.hand];
  }

  /**
   * Gets a copy of the discard pile
   * 
   * @returns Array of cards in discard (copy)
   * 
   * Used by: GameScene for discard display
   */
  getDiscard(): Card[] {
    return [...this.discard];
  }

  /**
   * Gets the number of cards in deck
   * 
   * @returns Deck size
   * 
   * Used by: GameScene.updateUI()
   */
  getDeckSize(): number {
    return this.deck.length;
  }

  /**
   * Gets the number of cards in hand
   * 
   * @returns Hand size
   * 
   * Used by: GameScene.updateUI()
   */
  getHandSize(): number {
    return this.hand.length;
  }

  /**
   * Gets the number of cards in discard
   * 
   * @returns Discard pile size
   * 
   * Used by: GameScene.updateUI()
   */
  getDiscardSize(): number {
    return this.discard.length;
  }

  /**
   * Checks if hand exceeds maximum size
   * 
   * @returns True if hand.length > MAX_HAND_SIZE
   * 
   * Used by: GameScene to trigger forced discard
   */
  handExceedsMax(): boolean {
    return this.hand.length > MAX_HAND_SIZE;
  }

  /**
   * Checks if deck is empty
   * 
   * @returns True if no cards remain in deck
   * 
   * Used by: GameScene to trigger reshuffle
   */
  isDeckEmpty(): boolean {
    return this.deck.length === 0;
  }

  /* ============================================
   * STATE IMPORT/EXPORT
   * ============================================
   * Methods for synchronizing deck state.
   */

  /**
   * Sets deck directly (for state sync)
   * 
   * @param deck - Array of cards to set as deck
   */
  setDeck(deck: Card[]): void {
    this.deck = [...deck];
  }

  /**
   * Sets hand directly (for state sync)
   * 
   * @param hand - Array of cards to set as hand
   */
  setHand(hand: Card[]): void {
    this.hand = [...hand];
  }

  /**
   * Sets discard pile directly (for state sync)
   * 
   * @param discard - Array of cards to set as discard
   */
  setDiscard(discard: Card[]): void {
    this.discard = [...discard];
  }

  /**
   * Exports full deck state for synchronization
   * 
   * @returns Object containing copies of deck, hand, and discard
   * 
   * Used by: GameStateManager for state export
   */
  exportState(): { deck: Card[]; hand: Card[]; discard: Card[] } {
    return {
      deck: [...this.deck],
      hand: [...this.hand],
      discard: [...this.discard]
    };
  }

  /**
   * Imports full deck state from synchronization
   * 
   * @param state - Object containing deck, hand, and discard arrays
   * 
   * Used by: GameStateManager for state import
   */
  importState(state: { deck: Card[]; hand: Card[]; discard: Card[] }): void {
    this.deck = [...state.deck];
    this.hand = [...state.hand];
    this.discard = [...state.discard];
  }

  /* ============================================
   * INTEGRITY CHECKS
   * ============================================
   * Methods for verifying deck state consistency.
   */

  /**
   * Gets total card count across all zones
   * 
   * Should always equal DECK_SIZE for a valid deck.
   * 
   * @returns Total number of cards (deck + hand + discard)
   * 
   * Used by: Unit tests, debug validation
   */
  getTotalCardCount(): number {
    return this.deck.length + this.hand.length + this.discard.length;
  }

  /**
   * Verifies deck integrity
   * 
   * Checks that total cards equals DECK_SIZE.
   * If false, cards have been lost or duplicated.
   * 
   * @returns True if total cards equals DECK_SIZE
   * 
   * Used by: Unit tests, debug validation
   */
  verifyIntegrity(): boolean {
    return this.getTotalCardCount() === DECK_SIZE;
  }
}
