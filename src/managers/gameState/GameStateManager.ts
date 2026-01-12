/**
 * @fileoverview GameStateManager - Central state management for Card Chess
 * 
 * This manager handles all game state including:
 * - Turn flow and phase management
 * - Clock and stopwatch tracking
 * - Energy and energy cap management
 * - Focus/Disturb mode mechanics
 * - Deck, hand, and discard pile operations
 * - Card effect resolution
 * 
 * Requirements addressed:
 * - 3.1, 3.3, 3.5: Turn flow and card play rules
 * - 4.3, 4.5, 4.7: Clock management
 * - 5.3, 5.4: Stopwatch threshold mechanics
 * - 6.3, 6.4, 6.5, 6.6: Energy system
 * - 8.1-8.4: Focus/Disturb mode
 * - 11.6-11.8: Card effect resolution
 * 
 * @module managers/gameState/GameStateManager
 */

import {
  MAX_HAND_SIZE,
  MOVE_TIME_COST,
  MULLIGAN_TIME_COST,
  STOPWATCH_THRESHOLD
} from './constants';
import { resolveCardEffect as resolveCardEffectHelper } from './effects';
import { createInitialGameState } from './factory';
import type { Card, GamePhase, GameState, PieceType, PlayerColor, PlayerState } from './types';
import { wouldDeploymentGiveCheck as wouldDeploymentGiveCheckHelper } from './validation';

/* ============================================
 * GAME STATE MANAGER CLASS
 * ============================================
 */

/**
 * GameStateManager - Central state management for Card Chess
 * 
 * Manages all game state and provides methods for:
 * - Phase and turn management
 * - Clock and stopwatch operations
 * - Energy system
 * - Focus/Disturb mode
 * - Deck operations
 * - Card effect resolution
 * 
 * @example
 * const manager = new GameStateManager('white', 'Player 1', 'Player 2');
 * manager.setOnStateChange((state) => updateUI(state));
 * manager.startGame();
 * 
 * Used by: GameScene (creates and manages game state)
 */
export class GameStateManager {
  /** Current game state */
  private state: GameState;
  
  /** Callback for state changes */
  private onStateChange?: (state: GameState) => void;

  /**
   * Creates a new GameStateManager
   * 
   * @param localPlayer - Which color the local player controls
   * @param whiteName - White player's display name
   * @param blackName - Black player's display name
   * 
   * Used by: GameScene.create()
   */
  constructor(
    localPlayer: PlayerColor = 'white',
    whiteName: string = 'White',
    blackName: string = 'Black'
  ) {
    this.state = createInitialGameState(localPlayer, whiteName, blackName);
  }

  /* ============================================
   * STATE ACCESS METHODS
   * ============================================
   */
  getState(): GameState {
    return { ...this.state };
  }
  setOnStateChange(callback: (state: GameState) => void): void {
    this.onStateChange = callback;
  }

  private notifyStateChange(): void {
    if (this.onStateChange) {
      this.onStateChange(this.getState());
    }
  }

  getCurrentPlayer(): PlayerState {
    return this.state.players[this.state.currentTurn];
  }

  getOpponentPlayer(): PlayerState {
    const opponent = this.state.currentTurn === 'white' ? 'black' : 'white';
    return this.state.players[opponent];
  }

  getPlayer(color: PlayerColor): PlayerState {
    return this.state.players[color];
  }

  /* ============================================
   * PHASE AND TURN MANAGEMENT
   * Requirements: 3.1, 3.3, 3.5
   * ============================================
   */

  /**
   * Starts the game (transition from mulligan to playing)
   * 
   * Used by: GameScene (after mulligan phase)
   */
  startGame(): void {
    if (this.state.phase !== 'mulligan') return;
    this.state.phase = 'playing';
    this.notifyStateChange();
  }

  /**
   * Ends current turn and passes to opponent
   * 
   * Algorithm:
   * 1. Process end-of-turn Focus/Disturb mode effects
   * 2. Process stopwatch threshold (opponent draws if >= 60s)
   * 3. Reset stopwatch and turn-specific flags
   * 4. Switch turn to opponent
   * 5. Refill new player's energy to cap
   * 6. Increment turn number if white's turn
   * 7. Draw card (except white's first turn)
   * 
   * Requirement 3.3: White doesn't draw on first turn
   * Requirement 3.5: Can play any number of cards during turn
   * 
   * Used by: GameScene.endTurn()
   */
  endTurn(): void {
    if (this.state.phase !== 'playing') return;

    const currentPlayer = this.getCurrentPlayer();
    
    // Process end-of-turn Focus/Disturb mode effects
    this.processEndOfTurnMode(this.state.currentTurn);
    
    // Reset stopwatch for next turn
    currentPlayer.stopwatch = 0;
    
    // Reset turn-specific flags
    currentPlayer.energyPlayedThisTurn = false;
    currentPlayer.hasPlayedCardThisTurn = false;
    currentPlayer.deployedPiecesThisTurn = [];

    // Switch turn
    this.state.currentTurn = this.state.currentTurn === 'white' ? 'black' : 'white';
    
    // Refill new player's energy to their energy cap at turn start
    const newPlayer = this.getCurrentPlayer();
    newPlayer.energy = newPlayer.energyCap;
    
    // Increment turn number when white's turn starts again
    if (this.state.currentTurn === 'white') {
      this.state.turnNumber++;
    }

    // Draw card at turn start (except white's very first turn - turn 1, white's turn)
    // Black should draw on their first turn (turn 1, black's turn)
    const isWhiteVeryFirstTurn = this.state.currentTurn === 'white' && this.state.turnNumber === 1;
    if (!isWhiteVeryFirstTurn) {
      this.drawCards(this.state.currentTurn, 1, false);
    }

    this.notifyStateChange();
  }

  /**
   * Gets current game phase
   * 
   * @returns Current phase
   */
  getPhase(): GamePhase {
    return this.state.phase;
  }

  /**
   * Gets current turn color
   * 
   * @returns Color of player whose turn it is
   */
  getCurrentTurn(): PlayerColor {
    return this.state.currentTurn;
  }

  /**
   * Checks if it's the local player's turn
   * 
   * @returns True if local player's turn
   */
  isLocalPlayerTurn(): boolean {
    return this.state.currentTurn === this.state.localPlayer;
  }

  /**
   * Ends the game
   * 
   * Used by: GameScene (when game ends)
   */
  endGame(): void {
    this.state.phase = 'ended';
    this.notifyStateChange();
  }

  /* ============================================
   * CLOCK MANAGEMENT
   * Requirements: 4.3, 4.5, 4.7
   * ============================================
   */

  /**
   * Deducts time from player's clock
   * 
   * Also adds to stopwatch for current turn tracking.
   * 
   * Requirement 4.3: Deduct card's time cost when played
   * Requirement 4.7: Deduct 3 seconds when moving a piece
   * 
   * @param player - Player color
   * @param seconds - Seconds to deduct
   */
  deductTime(player: PlayerColor, seconds: number): void {
    const playerState = this.state.players[player];
    playerState.clock = Math.max(0, playerState.clock - seconds);
    
    // Also add to stopwatch for current turn tracking
    if (player === this.state.currentTurn) {
      playerState.stopwatch += seconds;

      this.processStopwatchThreshold(this.state.currentTurn);
    }
    
    this.notifyStateChange();
  }

  /**
   * Adds time to player's clock
   * 
   * @param player - Player color
   * @param seconds - Seconds to add
   */
  addTime(player: PlayerColor, seconds: number): void {
    const playerState = this.state.players[player];
    playerState.clock += seconds;
    this.notifyStateChange();
  }

  /**
   * Modifies time (can be positive or negative)
   * 
   * @param player - Player color
   * @param seconds - Seconds to modify (positive adds, negative deducts)
   */
  modifyTime(player: PlayerColor, seconds: number): void {
    if (seconds >= 0) {
      this.addTime(player, seconds);
    } else {
      this.deductTime(player, Math.abs(seconds));
    }
  }

  /**
   * Deducts time cost for moving a piece (3 seconds)
   * 
   * Requirement 4.7
   * 
   * @param player - Player color
   */
  deductMoveTimeCost(player: PlayerColor): void {
    this.deductTime(player, MOVE_TIME_COST);
  }

  /**
   * Deducts time cost for mulligan (10 seconds)
   * 
   * @param player - Player color
   */
  deductMulliganTimeCost(player: PlayerColor): void {
    this.deductTime(player, MULLIGAN_TIME_COST);
  }

  /**
   * Checks if player has timed out
   * 
   * Requirement 4.5: Clock reaching 00:00 triggers loss
   * 
   * @param player - Player color
   * @returns True if clock is at 0
   */
  hasTimedOut(player: PlayerColor): boolean {
    return this.state.players[player].clock <= 0;
  }

  /**
   * Gets player's remaining clock time in seconds
   * 
   * @param player - Player color
   * @returns Remaining seconds
   */
  getClockTime(player: PlayerColor): number {
    return this.state.players[player].clock;
  }

  /* ============================================
   * STOPWATCH MANAGEMENT
   * Requirements: 5.3, 5.4
   * ============================================
   */

  /**
   * Processes stopwatch threshold at end of turn
   * 
   * Requirement 5.3: At 60+ seconds, subtract 60 and opponent draws 1 card
   * Requirement 5.4: Reset to 0 when turn ends
   * 
   * @param player - Player color
   * @private
   */
  private processStopwatchThreshold(player: PlayerColor): void {
    const playerState = this.state.players[player];
    const opponent = player === 'white' ? 'black' : 'white';
    
    while (playerState.stopwatch >= STOPWATCH_THRESHOLD) {
      playerState.stopwatch -= STOPWATCH_THRESHOLD;
      // Opponent draws 1 card (up to max hand size)
      this.drawCards(opponent, 1, true);
    }
  }

  /**
   * Gets player's current stopwatch value
   * 
   * @param player - Player color
   * @returns Current stopwatch seconds
   */
  getStopwatch(player: PlayerColor): number {
    return this.state.players[player].stopwatch;
  }

  /* ============================================
   * ENERGY MANAGEMENT
   * Requirements: 6.3, 6.4, 6.5, 6.6
   * ============================================
   */

  /**
   * Adds energy to player (capped at energyCap)
   * 
   * Requirement 6.5: Deduct energy cost when playing non-energy cards
   * 
   * @param player - Player color
   * @param amount - Energy to add
   */
  addEnergy(player: PlayerColor, amount: number): void {
    const playerState = this.state.players[player];
    playerState.energy = Math.min(playerState.energyCap, playerState.energy + amount);
    this.notifyStateChange();
  }

  /**
   * Deducts energy from player
   * 
   * Requirement 6.6: Prevent card play if insufficient energy
   * 
   * @param player - Player color
   * @param amount - Energy to deduct
   * @returns True if successful, false if insufficient
   */
  deductEnergy(player: PlayerColor, amount: number): boolean {
    const playerState = this.state.players[player];
    if (playerState.energy < amount) {
      return false;
    }
    playerState.energy -= amount;
    this.notifyStateChange();
    return true;
  }

  /**
   * Modifies energy (can be positive or negative)
   * 
   * @param player - Player color
   * @param amount - Energy to modify
   * @returns True if successful
   */
  modifyEnergy(player: PlayerColor, amount: number): boolean {
    if (amount >= 0) {
      this.addEnergy(player, amount);
      return true;
    } else {
      return this.deductEnergy(player, Math.abs(amount));
    }
  }

  /**
   * Modifies energy cap
   * 
   * Requirement 6.3: Energy card increases cap by 1, then current by 1
   * 
   * @param player - Player color
   * @param amount - Amount to modify cap
   */
  modifyEnergyCap(player: PlayerColor, amount: number): void {
    const playerState = this.state.players[player];
    playerState.energyCap = Math.max(0, playerState.energyCap + amount);
    this.notifyStateChange();
  }

  /**
   * Plays energy card effect
   * 
   * Requirement 6.3: Increase cap by 1, then current by 1
   * Requirement 6.4: Only 1 energy card per turn
   * 
   * @param player - Player color
   * @returns True if successful
   */
  playEnergyCard(player: PlayerColor): boolean {
    const playerState = this.state.players[player];
    
    if (playerState.energyPlayedThisTurn) {
      return false;
    }
    
    playerState.energyCap += 1;
    playerState.energy = Math.min(playerState.energyCap, playerState.energy + 1);
    playerState.energyPlayedThisTurn = true;
    
    this.notifyStateChange();
    return true;
  }

  /**
   * Checks if player can afford energy cost
   * 
   * @param player - Player color
   * @param cost - Energy cost
   * @returns True if affordable
   */
  canAffordEnergy(player: PlayerColor, cost: number): boolean {
    return this.state.players[player].energy >= cost;
  }

  /**
   * Checks if player can play energy card this turn
   * 
   * @param player - Player color
   * @returns True if energy card not yet played
   */
  canPlayEnergyCard(player: PlayerColor): boolean {
    return !this.state.players[player].energyPlayedThisTurn;
  }

  /**
   * Gets player's current energy
   * 
   * @param player - Player color
   * @returns Current energy
   */
  getEnergy(player: PlayerColor): number {
    return this.state.players[player].energy;
  }

  /**
   * Gets player's energy cap
   * 
   * @param player - Player color
   * @returns Energy cap
   */
  getEnergyCap(player: PlayerColor): number {
    return this.state.players[player].energyCap;
  }

  /* ============================================
   * FOCUS/DISTURB MODE
   * Requirements: 8.1, 8.2, 8.3, 8.4
   * ============================================
   */

  /**
   * Toggles player's mode between Focus and Disturb
   * 
   * @param player - Player color
   */
  toggleMode(player: PlayerColor): void {
    const playerState = this.state.players[player];
    playerState.mode = playerState.mode === 'focus' ? 'disturb' : 'focus';
    this.notifyStateChange();
  }

  /**
   * Sets player's mode
   * 
   * @param player - Player color
   * @param mode - Mode to set
   */
  setMode(player: PlayerColor, mode: 'focus' | 'disturb'): void {
    this.state.players[player].mode = mode;
    this.notifyStateChange();
  }

  /**
   * Gets player's current mode
   * 
   * @param player - Player color
   * @returns Current mode
   */
  getMode(player: PlayerColor): 'focus' | 'disturb' {
    return this.state.players[player].mode;
  }

  /**
   * Processes end-of-turn mode effects
   * 
   * Requirement 8.1: Focus mode converts leftover energy to time (1:1)
   * Requirement 8.2: Disturb mode converts leftover energy to opponent's Disturb tags
   * 
   * @param player - Player color
   * @private
   */
  private processEndOfTurnMode(player: PlayerColor): void {
    const playerState = this.state.players[player];
    const opponent = player === 'white' ? 'black' : 'white';
    const leftoverEnergy = playerState.energy;
    
    if (leftoverEnergy > 0) {
      if (playerState.mode === 'focus') {
        // Convert energy to time (1 energy = 1 second)
        playerState.clock += leftoverEnergy;
      } else {
        // Convert energy to opponent's Disturb tags
        this.state.players[opponent].disturbTags += leftoverEnergy;
      }
      // Reset energy to 0 after conversion
      playerState.energy = 0;
    }
  }

  /**
   * Modifies Disturb tags for a player
   * 
   * @param player - Player color
   * @param amount - Amount to modify
   */
  modifyDisturbTags(player: PlayerColor, amount: number): void {
    const playerState = this.state.players[player];
    playerState.disturbTags = Math.max(0, playerState.disturbTags + amount);
    this.notifyStateChange();
  }

  /**
   * Gets player's Disturb tag count
   * 
   * @param player - Player color
   * @returns Disturb tag count
   */
  getDisturbTags(player: PlayerColor): number {
    return this.state.players[player].disturbTags;
  }

  /**
   * Resolves Disturb tags when playing first card of turn
   * 
   * Requirement 8.3: First card play removes all tags, deducting 1 second per tag
   * 
   * @param player - Player color
   */
  resolveDisturbTagsOnCardPlay(player: PlayerColor): void {
    const playerState = this.state.players[player];
    
    if (!playerState.hasPlayedCardThisTurn && playerState.disturbTags > 0) {
      this.deductTime(player, playerState.disturbTags);
      playerState.disturbTags = 0;
    }
    
    playerState.hasPlayedCardThisTurn = true;
    this.notifyStateChange();
  }

  /**
   * Resolves Disturb tags when moving without playing cards
   * 
   * Requirement 8.4: Moving without cards clears tags without time cost
   * 
   * @param player - Player color
   */
  resolveDisturbTagsOnMove(player: PlayerColor): void {
    const playerState = this.state.players[player];
    
    if (!playerState.hasPlayedCardThisTurn) {
      playerState.disturbTags = 0;
    }
    
    this.notifyStateChange();
  }

  /* ============================================
   * DEPLOYED PIECE TRACKING
   * ============================================
   */

  /**
   * Tracks a deployed piece for this turn
   * 
   * Deployed pieces cannot move on the same turn they are deployed.
   * 
   * @param player - Player color
   * @param square - Square where piece was deployed
   */
  trackDeployedPiece(player: PlayerColor, square: string): void {
    this.state.players[player].deployedPiecesThisTurn.push(square);
    this.notifyStateChange();
  }

  /**
   * Checks if a piece at a square was deployed this turn
   * 
   * @param player - Player color
   * @param square - Square to check
   * @returns True if piece was deployed this turn
   */
  wasDeployedThisTurn(player: PlayerColor, square: string): boolean {
    return this.state.players[player].deployedPiecesThisTurn.includes(square);
  }

  /**
   * Checks if a piece can move from a square
   * 
   * @param player - Player color
   * @param fromSquare - Square to move from
   * @returns Object with canMove flag and reason
   */
  canMovePiece(player: PlayerColor, fromSquare: string): { canMove: boolean; reason: string } {
    if (this.wasDeployedThisTurn(player, fromSquare)) {
      return { canMove: false, reason: 'Piece was deployed this turn and cannot move' };
    }
    return { canMove: true, reason: '' };
  }

  /**
   * Gets list of squares where pieces were deployed this turn
   * 
   * @param player - Player color
   * @returns Array of square notations
   */
  getDeployedPiecesThisTurn(player: PlayerColor): string[] {
    return [...this.state.players[player].deployedPiecesThisTurn];
  }

  /**
   * Checks if deploying a piece would give check to opponent's king
   * 
   * This validation should be called before placing the piece.
   * 
   * @param targetSquare - Square to deploy to
   * @param pieceType - Type of piece to deploy
   * @param playerColor - Color of deploying player
   * @param boardFEN - Current board position
   * @returns True if deployment would give check (invalid)
   */
  wouldDeploymentGiveCheck(
    targetSquare: string,
    pieceType: PieceType,
    playerColor: PlayerColor,
    boardFEN: string
  ): boolean {
    return wouldDeploymentGiveCheckHelper(targetSquare, pieceType, playerColor, boardFEN);
  }

  /* ============================================
   * DECK OPERATIONS
   * ============================================
   */

  /**
   * Sets player's deck
   * 
   * @param player - Player color
   * @param deck - Array of cards
   */
  setDeck(player: PlayerColor, deck: Card[]): void {
    this.state.players[player].deck = [...deck];
    this.notifyStateChange();
  }

  /**
   * Draws cards from deck to hand
   * 
   * @param player - Player color
   * @param count - Number of cards to draw
   * @param respectCap - If true, won't draw beyond MAX_HAND_SIZE
   * @returns Number of cards actually drawn
   */
  drawCards(player: PlayerColor, count: number, respectCap: boolean): number {
    const playerState = this.state.players[player];
    let drawn = 0;
    let appliedEmptyPenalty = false;

    const applyEmptyDeckPenalty = (): void => {
      if (playerState.hand.length > 0) {
        playerState.discard.push(...playerState.hand);
        playerState.hand = [];
      }
      playerState.energy = 0;
      playerState.energyCap = 0;
    };
    
    for (let i = 0; i < count; i++) {
      if (respectCap && playerState.hand.length >= MAX_HAND_SIZE) break;
      if (playerState.deck.length === 0) {
        applyEmptyDeckPenalty();
        appliedEmptyPenalty = true;
        break;
      }
      
      const card = playerState.deck.pop();
      if (card) {
        playerState.hand.push(card);
        drawn++;
      }
    }
    
    if (drawn > 0 || appliedEmptyPenalty || count > 0) {
      this.notifyStateChange();
    }
    return drawn;
  }

  /**
   * Shuffles player's deck
   * 
   * Uses Fisher-Yates shuffle algorithm.
   * 
   * @param player - Player color
   */
  shuffleDeck(player: PlayerColor): void {
    const deck = this.state.players[player].deck;
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    this.notifyStateChange();
  }

  /**
   * Discards cards to max hand size
   * 
   * Requirement 3.6: Force discard to 7 if hand > 7
   * 
   * @param player - Player color
   * @returns Array of discarded cards
   */
  discardToHandSize(player: PlayerColor): Card[] {
    const playerState = this.state.players[player];
    const discarded: Card[] = [];
    
    while (playerState.hand.length > MAX_HAND_SIZE) {
      const card = playerState.hand.pop();
      if (card) {
        playerState.discard.push(card);
        discarded.push(card);
      }
    }
    
    this.notifyStateChange();
    return discarded;
  }

  /**
   * Gets hand size for player
   * 
   * @param player - Player color
   * @returns Number of cards in hand
   */
  getHandSize(player: PlayerColor): number {
    return this.state.players[player].hand.length;
  }

  /**
   * Checks if hand exceeds max size
   * 
   * @param player - Player color
   * @returns True if hand > MAX_HAND_SIZE
   */
  handExceedsMax(player: PlayerColor): boolean {
    return this.state.players[player].hand.length > MAX_HAND_SIZE;
  }

  /* ============================================
   * CARD EFFECT RESOLUTION
   * Requirements: 11.6, 11.7, 11.8
   * ============================================
   */

  /**
   * Checks if a card can be played
   * 
   * Validates energy cost, time cost, and special conditions.
   * 
   * @param card - The card to check
   * @param player - The player attempting to play
   * @returns Object with canPlay flag and reason
   */
  canPlayCard(card: Card, player: PlayerColor): { canPlay: boolean; reason: string } {
    const playerState = this.state.players[player];

    if (this.state.currentTurn !== player) {
      return { canPlay: false, reason: 'Not your turn' };
    }

    if (this.state.phase !== 'playing') {
      return { canPlay: false, reason: 'Game is not in playing phase' };
    }

    // Requirement 6.4: Only one energy card per turn
    if (card.type === 'energy' && playerState.energyPlayedThisTurn) {
      return { canPlay: false, reason: 'Already played an energy card this turn' };
    }

    // Requirement 6.6: Check energy cost
    if (card.energyCost !== null && playerState.energy < card.energyCost) {
      return { canPlay: false, reason: 'Insufficient energy' };
    }

    if (card.timeCost !== null && playerState.clock < card.timeCost) {
      return { canPlay: false, reason: 'Insufficient time' };
    }

    return { canPlay: true, reason: '' };
  }

  /**
   * Plays a card from hand
   * 
   * Algorithm:
   * 1. Find card in hand
   * 2. Validate card can be played
   * 3. Check target requirement
   * 4. Resolve Disturb tags on first card
   * 5. Deduct costs
   * 6. Remove from hand
   * 7. Resolve effect
   * 8. Add to discard
   * 
   * Requirement 11.6: Support "Deploy [piece] at a square you control"
   * Requirement 11.7: Support "Destroy target piece at a square you control"
   * Requirement 11.8: Support time and energy modification
   * 
   * @param cardId - ID of the card to play
   * @param player - The player playing the card
   * @param target - Optional target square for targeted effects
   * @returns Object with success flag and message
   */
  playCard(cardId: string, player: PlayerColor, target?: string): { success: boolean; message: string } {
    const playerState = this.state.players[player];

    const cardIndex = playerState.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) {
      return { success: false, message: 'Card not found in hand' };
    }

    const card = playerState.hand[cardIndex];

    const validation = this.canPlayCard(card, player);
    if (!validation.canPlay) {
      return { success: false, message: validation.reason };
    }

    const requiresTarget = 'requiresTarget' in card.effect && card.effect.requiresTarget;
    if (requiresTarget && !target) {
      return { success: false, message: 'Card requires a target' };
    }

    // Resolve Disturb tags on first card play (Requirement 8.3)
    this.resolveDisturbTagsOnCardPlay(player);

    // Deduct costs
    if (card.energyCost !== null) {
      this.deductEnergy(player, card.energyCost);
    }
    if (card.timeCost !== null) {
      this.deductTime(player, card.timeCost);
    }

    // Remove card from hand
    playerState.hand.splice(cardIndex, 1);

    // Resolve effect
    const effectResult = this.resolveCardEffect(card, player, target);

    // Add card to discard pile
    playerState.discard.push(card);

    this.notifyStateChange();

    return effectResult;
  }

  /**
   * Resolves a card's effect
   * 
   * @param card - The card being played
   * @param player - The player who played the card
   * @param target - Optional target for targeted effects
   * @returns Object with success flag and message
   * @private
   */
  resolveCardEffect(card: Card, player: PlayerColor, target?: string): { success: boolean; message: string } {
    return resolveCardEffectHelper(this, card, player, target);
  }

  /**
   * Gets a card from player's hand by ID
   * 
   * @param player - Player color
   * @param cardId - Card ID
   * @returns Card or null if not found
   */
  getCardFromHand(player: PlayerColor, cardId: string): Card | null {
    return this.state.players[player].hand.find(c => c.id === cardId) || null;
  }

  /**
   * Gets player's hand
   * 
   * @param player - Player color
   * @returns Copy of hand array
   */
  getHand(player: PlayerColor): Card[] {
    return [...this.state.players[player].hand];
  }

  /**
   * Gets player's deck
   * 
   * @param player - Player color
   * @returns Copy of deck array
   */
  getDeck(player: PlayerColor): Card[] {
    return [...this.state.players[player].deck];
  }

  /**
   * Gets player's discard pile
   * 
   * @param player - Player color
   * @returns Copy of discard array
   */
  getDiscard(player: PlayerColor): Card[] {
    return [...this.state.players[player].discard];
  }

  /* ============================================
   * BOARD STATE
   * ============================================
   */

  /**
   * Updates board FEN
   * 
   * @param fen - FEN string
   */
  setBoardFEN(fen: string): void {
    this.state.boardFEN = fen;
    this.notifyStateChange();
  }

  /**
   * Gets current board FEN
   * 
   * @returns FEN string
   */
  getBoardFEN(): string {
    return this.state.boardFEN;
  }

  /* ============================================
   * STATE IMPORT/EXPORT (for P2P sync)
   * ============================================
   */

  /**
   * Imports full game state (for P2P sync)
   * 
   * @param state - State to import
   */
  importState(state: GameState): void {
    this.state = { ...state };
    this.notifyStateChange();
  }

  /**
   * Exports full game state (for P2P sync)
   * 
   * @returns Copy of current state
   */
  exportState(): GameState {
    return { ...this.state };
  }
}
