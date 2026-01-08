/**
 * DeckManager - Manages deck operations for Card Chess
 * 
 * Requirements: 3.1, 11.2, 11.3, 11.4, 11.5
 * - 3.1: Shuffle both players' decks at game start, each player draws 7 cards
 * - 11.2: Support "Shuffle the deck" action
 * - 11.3: Support "Draw x cards" action (ignoring hand cap)
 * - 11.4: Support "Draw 1 card, up to max handsize" action
 * - 11.5: Support "Discard cards to max handsize" action
 */

import { Card } from './GameStateManager';
import { createDeck, resetCardIdCounter } from '../data/cards';

// Constants
export const DECK_SIZE = 60;
export const MAX_HAND_SIZE = 7;
export const INITIAL_DRAW_COUNT = 7;

/**
 * DeckManager class - manages deck, hand, and discard pile operations
 */
export class DeckManager {
  private deck: Card[] = [];
  private hand: Card[] = [];
  private discard: Card[] = [];

  constructor() {
    // Initialize with empty state
  }

  /**
   * Initialize a new deck with all 60 cards
   * Requirement 3.1: Shuffle deck at game start
   */
  initializeDeck(): void {
    resetCardIdCounter();
    this.deck = createDeck();
    this.hand = [];
    this.discard = [];
  }

  /**
   * Shuffle the deck using Fisher-Yates algorithm
   * Requirement 11.2: Support "Shuffle the deck" action
   */
  shuffle(): void {
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  /**
   * Shuffle with a provided random function (for testing)
   */
  shuffleWithRandom(randomFn: () => number): void {
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(randomFn() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  /**
   * Draw cards from deck to hand
   * Requirement 11.3: Support "Draw x cards" action (ignoring hand cap)
   * Requirement 11.4: Support "Draw 1 card, up to max handsize" action
   * 
   * @param count Number of cards to draw
   * @param respectCap If true, won't draw beyond MAX_HAND_SIZE
   * @returns Number of cards actually drawn
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
   * Draw initial hand (7 cards)
   * Requirement 3.1: Each player draws 7 cards at game start
   */
  drawInitialHand(): number {
    return this.draw(INITIAL_DRAW_COUNT, false);
  }

  /**
   * Discard a specific card from hand
   * @param cardId ID of the card to discard
   * @returns The discarded card, or null if not found
   */
  discardCard(cardId: string): Card | null {
    const index = this.hand.findIndex(c => c.id === cardId);
    if (index === -1) return null;

    const [card] = this.hand.splice(index, 1);
    this.discard.push(card);
    return card;
  }

  /**
   * Discard cards to max hand size
   * Requirement 11.5: Support "Discard cards to max handsize" action
   * 
   * @returns Array of discarded cards
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

  /**
   * Remove a card from hand (when played)
   * @param cardId ID of the card to remove
   * @returns The removed card, or null if not found
   */
  removeFromHand(cardId: string): Card | null {
    const index = this.hand.findIndex(c => c.id === cardId);
    if (index === -1) return null;

    const [card] = this.hand.splice(index, 1);
    return card;
  }

  /**
   * Add a card to discard pile (after playing)
   */
  addToDiscard(card: Card): void {
    this.discard.push(card);
  }

  /**
   * Get a card from hand by ID
   */
  getCardFromHand(cardId: string): Card | null {
    return this.hand.find(c => c.id === cardId) || null;
  }

  /**
   * Shuffle discard pile back into deck
   */
  reshuffleDiscard(): void {
    this.deck.push(...this.discard);
    this.discard = [];
    this.shuffle();
  }

  // ============================================
  // Getters
  // ============================================

  /**
   * Get current deck (copy)
   */
  getDeck(): Card[] {
    return [...this.deck];
  }

  /**
   * Get current hand (copy)
   */
  getHand(): Card[] {
    return [...this.hand];
  }

  /**
   * Get current discard pile (copy)
   */
  getDiscard(): Card[] {
    return [...this.discard];
  }

  /**
   * Get deck size
   */
  getDeckSize(): number {
    return this.deck.length;
  }

  /**
   * Get hand size
   */
  getHandSize(): number {
    return this.hand.length;
  }

  /**
   * Get discard pile size
   */
  getDiscardSize(): number {
    return this.discard.length;
  }

  /**
   * Check if hand exceeds max size
   */
  handExceedsMax(): boolean {
    return this.hand.length > MAX_HAND_SIZE;
  }

  /**
   * Check if deck is empty
   */
  isDeckEmpty(): boolean {
    return this.deck.length === 0;
  }

  // ============================================
  // State Import/Export (for GameStateManager integration)
  // ============================================

  /**
   * Set deck directly (for state sync)
   */
  setDeck(deck: Card[]): void {
    this.deck = [...deck];
  }

  /**
   * Set hand directly (for state sync)
   */
  setHand(hand: Card[]): void {
    this.hand = [...hand];
  }

  /**
   * Set discard pile directly (for state sync)
   */
  setDiscard(discard: Card[]): void {
    this.discard = [...discard];
  }

  /**
   * Export full deck state
   */
  exportState(): { deck: Card[]; hand: Card[]; discard: Card[] } {
    return {
      deck: [...this.deck],
      hand: [...this.hand],
      discard: [...this.discard]
    };
  }

  /**
   * Import full deck state
   */
  importState(state: { deck: Card[]; hand: Card[]; discard: Card[] }): void {
    this.deck = [...state.deck];
    this.hand = [...state.hand];
    this.discard = [...state.discard];
  }

  /**
   * Get total card count (deck + hand + discard)
   * Should always equal DECK_SIZE for integrity checks
   */
  getTotalCardCount(): number {
    return this.deck.length + this.hand.length + this.discard.length;
  }

  /**
   * Verify deck integrity (total cards = DECK_SIZE)
   */
  verifyIntegrity(): boolean {
    return this.getTotalCardCount() === DECK_SIZE;
  }
}
