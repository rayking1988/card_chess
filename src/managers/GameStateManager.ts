/**
 * GameStateManager - Central state management for Card Chess
 * Handles game state, turn flow, and action execution
 * 
 * Requirements: 3.1, 3.3, 3.5, 4.3, 4.5, 4.7, 5.3, 5.4, 6.3, 6.4, 6.5, 6.6, 8.1-8.4
 */

import { Chess, Square as ChessSquare } from 'chess.js';

// Card effect types
export type CardEffect =
  | { action: 'SHUFFLE_DECK' }
  | { action: 'DRAW_CARDS'; count: number; respectCap: boolean }
  | { action: 'DISCARD_TO_CAP' }
  | { action: 'DEPLOY_PIECE'; piece: PieceType; requiresTarget: true }
  | { action: 'DESTROY_PIECE'; requiresTarget: true }
  | { action: 'MODIFY_TIME'; amount: number }
  | { action: 'MODIFY_ENERGY'; amount: number }
  | { action: 'MODIFY_ENERGY_CAP'; amount: number }
  | { action: 'ENERGY_CARD' };

export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export interface Card {
  id: string;
  name: string;
  type: 'energy' | 'piece' | 'spell';
  energyCost: number | null;
  timeCost: number | null;
  effect: CardEffect;
  artAsset: string;
  frameColor: string;
}

export interface PlayerState {
  name: string;
  clock: number;           // seconds remaining (starts at 600)
  stopwatch: number;       // accumulated turn time cost
  energy: number;          // current energy
  energyCap: number;       // max energy
  disturbTags: number;     // disturb debuff count
  mode: 'focus' | 'disturb';
  energyPlayedThisTurn: boolean;
  hasPlayedCardThisTurn: boolean;
  deployedPiecesThisTurn: string[];  // squares where pieces were deployed this turn
  
  // Deck state
  deck: Card[];
  hand: Card[];
  discard: Card[];
}

export type GamePhase = 'mulligan' | 'playing' | 'ended';
export type PlayerColor = 'white' | 'black';

export interface GameState {
  phase: GamePhase;
  currentTurn: PlayerColor;
  localPlayer: PlayerColor;
  turnNumber: number;
  
  // Chess state
  boardFEN: string;
  
  // Player states
  players: {
    white: PlayerState;
    black: PlayerState;
  };
}


// Constants
const INITIAL_CLOCK_SECONDS = 600; // 10:00
const MOVE_TIME_COST = 3;
const MULLIGAN_TIME_COST = 10;
const STOPWATCH_THRESHOLD = 60;
const MAX_HAND_SIZE = 7;
const INITIAL_DRAW_COUNT = 7;

/**
 * Creates a new empty player state
 */
function createPlayerState(name: string): PlayerState {
  return {
    name,
    clock: INITIAL_CLOCK_SECONDS,
    stopwatch: 0,
    energy: 0,
    energyCap: 0,
    disturbTags: 0,
    mode: 'focus',
    energyPlayedThisTurn: false,
    hasPlayedCardThisTurn: false,
    deployedPiecesThisTurn: [],
    deck: [],
    hand: [],
    discard: []
  };
}

/**
 * Creates initial game state for a new game
 * Board starts with only two kings (White King on e1, Black King on e8)
 */
export function createInitialGameState(
  localPlayer: PlayerColor,
  whiteName: string,
  blackName: string
): GameState {
  return {
    phase: 'mulligan',
    currentTurn: 'white',
    localPlayer,
    turnNumber: 1,
    // Starting position: only two kings (White King e1, Black King e8)
    boardFEN: '4k3/8/8/8/8/8/8/4K3 w - - 0 1',
    players: {
      white: createPlayerState(whiteName),
      black: createPlayerState(blackName)
    }
  };
}

/**
 * GameStateManager class - manages all game state and actions
 */
export class GameStateManager {
  private state: GameState;
  private onStateChange?: (state: GameState) => void;

  constructor(
    localPlayer: PlayerColor = 'white',
    whiteName: string = 'White',
    blackName: string = 'Black'
  ) {
    this.state = createInitialGameState(localPlayer, whiteName, blackName);
  }

  /**
   * Get current game state (immutable copy)
   */
  getState(): GameState {
    return { ...this.state };
  }

  /**
   * Set state change callback
   */
  setOnStateChange(callback: (state: GameState) => void): void {
    this.onStateChange = callback;
  }

  /**
   * Notify listeners of state change
   */
  private notifyStateChange(): void {
    if (this.onStateChange) {
      this.onStateChange(this.getState());
    }
  }

  /**
   * Get current player state
   */
  getCurrentPlayer(): PlayerState {
    return this.state.players[this.state.currentTurn];
  }

  /**
   * Get opponent player state
   */
  getOpponentPlayer(): PlayerState {
    const opponent = this.state.currentTurn === 'white' ? 'black' : 'white';
    return this.state.players[opponent];
  }

  /**
   * Get player state by color
   */
  getPlayer(color: PlayerColor): PlayerState {
    return this.state.players[color];
  }

  // ============================================
  // Phase and Turn Management (Requirements 3.1, 3.3, 3.5)
  // ============================================

  /**
   * Start the game (transition from mulligan to playing)
   */
  startGame(): void {
    if (this.state.phase !== 'mulligan') return;
    this.state.phase = 'playing';
    this.notifyStateChange();
  }

  /**
   * End current turn and pass to opponent
   * Requirement 3.3: White doesn't draw on first turn, others draw 1 at turn start
   * Requirement 3.5: Can play any number of cards during turn
   */
  endTurn(): void {
    if (this.state.phase !== 'playing') return;

    const currentPlayer = this.getCurrentPlayer();
    
    // Process end-of-turn Focus/Disturb mode effects
    this.processEndOfTurnMode(this.state.currentTurn);
    
    // Process stopwatch threshold
    this.processStopwatchThreshold(this.state.currentTurn);
    
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

    // Draw card at turn start (except white's first turn)
    const isWhiteFirstTurn = this.state.currentTurn === 'white' && this.state.turnNumber === 1;
    if (!isWhiteFirstTurn) {
      this.drawCards(this.state.currentTurn, 1, true);
    }

    this.notifyStateChange();
  }

  /**
   * Get current game phase
   */
  getPhase(): GamePhase {
    return this.state.phase;
  }

  /**
   * Get current turn color
   */
  getCurrentTurn(): PlayerColor {
    return this.state.currentTurn;
  }

  /**
   * Check if it's the local player's turn
   */
  isLocalPlayerTurn(): boolean {
    return this.state.currentTurn === this.state.localPlayer;
  }

  /**
   * End the game
   */
  endGame(): void {
    this.state.phase = 'ended';
    this.notifyStateChange();
  }


  // ============================================
  // Clock Management (Requirements 4.3, 4.5, 4.7)
  // ============================================

  /**
   * Deduct time from player's clock
   * Requirement 4.3: Deduct card's time cost when played
   * Requirement 4.7: Deduct 3 seconds when moving a piece
   */
  deductTime(player: PlayerColor, seconds: number): void {
    const playerState = this.state.players[player];
    playerState.clock = Math.max(0, playerState.clock - seconds);
    
    // Also add to stopwatch for current turn tracking
    if (player === this.state.currentTurn) {
      playerState.stopwatch += seconds;
    }
    
    this.notifyStateChange();
  }

  /**
   * Add time to player's clock
   */
  addTime(player: PlayerColor, seconds: number): void {
    const playerState = this.state.players[player];
    playerState.clock += seconds;
    this.notifyStateChange();
  }

  /**
   * Modify time (can be positive or negative)
   */
  modifyTime(player: PlayerColor, seconds: number): void {
    if (seconds >= 0) {
      this.addTime(player, seconds);
    } else {
      this.deductTime(player, Math.abs(seconds));
    }
  }

  /**
   * Deduct time cost for moving a piece (3 seconds)
   * Requirement 4.7
   */
  deductMoveTimeCost(player: PlayerColor): void {
    this.deductTime(player, MOVE_TIME_COST);
  }

  /**
   * Deduct time cost for mulligan (10 seconds)
   */
  deductMulliganTimeCost(player: PlayerColor): void {
    this.deductTime(player, MULLIGAN_TIME_COST);
  }

  /**
   * Check if player has timed out
   * Requirement 4.5: Clock reaching 00:00 triggers loss
   */
  hasTimedOut(player: PlayerColor): boolean {
    return this.state.players[player].clock <= 0;
  }

  /**
   * Get player's remaining clock time in seconds
   */
  getClockTime(player: PlayerColor): number {
    return this.state.players[player].clock;
  }

  // ============================================
  // Stopwatch Management (Requirements 5.3, 5.4)
  // ============================================

  /**
   * Process stopwatch threshold at end of turn
   * Requirement 5.3: At 60+ seconds, subtract 60 and opponent draws 1 card
   * Requirement 5.4: Reset to 0 when turn ends
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
   * Get player's current stopwatch value
   */
  getStopwatch(player: PlayerColor): number {
    return this.state.players[player].stopwatch;
  }

  // ============================================
  // Energy Management (Requirements 6.3, 6.4, 6.5, 6.6)
  // ============================================

  /**
   * Add energy to player (capped at energyCap)
   * Requirement 6.5: Deduct energy cost when playing non-energy cards
   */
  addEnergy(player: PlayerColor, amount: number): void {
    const playerState = this.state.players[player];
    playerState.energy = Math.min(playerState.energyCap, playerState.energy + amount);
    this.notifyStateChange();
  }

  /**
   * Deduct energy from player
   * Requirement 6.6: Prevent card play if insufficient energy
   */
  deductEnergy(player: PlayerColor, amount: number): boolean {
    const playerState = this.state.players[player];
    if (playerState.energy < amount) {
      return false; // Insufficient energy
    }
    playerState.energy -= amount;
    this.notifyStateChange();
    return true;
  }

  /**
   * Modify energy (can be positive or negative)
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
   * Increase energy cap
   * Requirement 6.3: Energy card increases cap by 1, then current by 1
   */
  modifyEnergyCap(player: PlayerColor, amount: number): void {
    const playerState = this.state.players[player];
    playerState.energyCap = Math.max(0, playerState.energyCap + amount);
    this.notifyStateChange();
  }

  /**
   * Play energy card effect
   * Requirement 6.3: Increase cap by 1, then current by 1
   * Requirement 6.4: Only 1 energy card per turn
   */
  playEnergyCard(player: PlayerColor): boolean {
    const playerState = this.state.players[player];
    
    // Check if energy card already played this turn
    if (playerState.energyPlayedThisTurn) {
      return false;
    }
    
    // Increase cap by 1
    playerState.energyCap += 1;
    // Increase current by 1 (capped at new cap)
    playerState.energy = Math.min(playerState.energyCap, playerState.energy + 1);
    // Mark energy played this turn
    playerState.energyPlayedThisTurn = true;
    
    this.notifyStateChange();
    return true;
  }

  /**
   * Check if player can afford energy cost
   */
  canAffordEnergy(player: PlayerColor, cost: number): boolean {
    return this.state.players[player].energy >= cost;
  }

  /**
   * Check if player can play energy card this turn
   */
  canPlayEnergyCard(player: PlayerColor): boolean {
    return !this.state.players[player].energyPlayedThisTurn;
  }

  /**
   * Get player's current energy
   */
  getEnergy(player: PlayerColor): number {
    return this.state.players[player].energy;
  }

  /**
   * Get player's energy cap
   */
  getEnergyCap(player: PlayerColor): number {
    return this.state.players[player].energyCap;
  }


  // ============================================
  // Focus/Disturb Mode (Requirements 8.1, 8.2, 8.3, 8.4)
  // ============================================

  /**
   * Toggle player's mode between Focus and Disturb
   */
  toggleMode(player: PlayerColor): void {
    const playerState = this.state.players[player];
    playerState.mode = playerState.mode === 'focus' ? 'disturb' : 'focus';
    this.notifyStateChange();
  }

  /**
   * Set player's mode
   */
  setMode(player: PlayerColor, mode: 'focus' | 'disturb'): void {
    this.state.players[player].mode = mode;
    this.notifyStateChange();
  }

  /**
   * Get player's current mode
   */
  getMode(player: PlayerColor): 'focus' | 'disturb' {
    return this.state.players[player].mode;
  }

  /**
   * Process end-of-turn mode effects
   * Requirement 8.1: Focus mode converts leftover energy to time (1:1)
   * Requirement 8.2: Disturb mode converts leftover energy to opponent's Disturb tags
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
   * Modify Disturb tags for a player
   */
  modifyDisturbTags(player: PlayerColor, amount: number): void {
    const playerState = this.state.players[player];
    playerState.disturbTags = Math.max(0, playerState.disturbTags + amount);
    this.notifyStateChange();
  }

  /**
   * Get player's Disturb tag count
   */
  getDisturbTags(player: PlayerColor): number {
    return this.state.players[player].disturbTags;
  }

  // ============================================
  // Deployed Piece Tracking
  // ============================================

  /**
   * Track a deployed piece for this turn
   * Deployed pieces cannot move on the same turn they are deployed
   */
  trackDeployedPiece(player: PlayerColor, square: string): void {
    this.state.players[player].deployedPiecesThisTurn.push(square);
    this.notifyStateChange();
  }

  /**
   * Check if a piece at a square was deployed this turn
   * Returns true if the piece was deployed this turn (cannot move)
   */
  wasDeployedThisTurn(player: PlayerColor, square: string): boolean {
    return this.state.players[player].deployedPiecesThisTurn.includes(square);
  }

  /**
   * Check if a piece can move from a square
   * Returns false if the piece was deployed this turn
   */
  canMovePiece(player: PlayerColor, fromSquare: string): { canMove: boolean; reason: string } {
    if (this.wasDeployedThisTurn(player, fromSquare)) {
      return { canMove: false, reason: 'Piece was deployed this turn and cannot move' };
    }
    return { canMove: true, reason: '' };
  }

  /**
   * Get list of squares where pieces were deployed this turn
   */
  getDeployedPiecesThisTurn(player: PlayerColor): string[] {
    return [...this.state.players[player].deployedPiecesThisTurn];
  }

  /**
   * Check if deploying a piece at a square would give check to opponent's king
   * This validation should be called before placing the piece
   * Returns true if the deployment would give check (invalid deployment)
   * 
   * Note: This method requires a ChessBoardWrapper instance to be passed in
   * since GameStateManager doesn't have direct access to the chess board
   */
  wouldDeploymentGiveCheck(
    targetSquare: string,
    pieceType: PieceType,
    playerColor: PlayerColor,
    boardFEN: string
  ): boolean {
    // Create a temporary board to test the deployment
    const tempChess = new Chess(boardFEN);
    
    // Find opponent's king
    const opponentColor = playerColor === 'white' ? 'b' : 'w';
    const pieceColor = playerColor === 'white' ? 'w' : 'b';
    let kingSquare: ChessSquare | null = null;
    
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];
    
    for (const file of files) {
      for (const rank of ranks) {
        const square = (file + rank) as ChessSquare;
        const piece = tempChess.get(square);
        if (piece && piece.type === 'k' && piece.color === opponentColor) {
          kingSquare = square;
          break;
        }
      }
      if (kingSquare) break;
    }
    
    if (!kingSquare) return false; // No opponent king found
    
    // Place the piece temporarily
    const placed = tempChess.put({ type: pieceType, color: pieceColor }, targetSquare as ChessSquare);
    if (!placed) {
      // chess.js won't allow placing pawns on rank 1 or 8
      // In this case, we need to manually check if the piece would give check
      // For pawns on rank 1/8, they can't give check anyway (no valid pawn moves)
      // For other pieces that fail to place, assume no check
      return false;
    }
    
    // Check if the deployed piece can attack the king
    // We need to check if the piece at targetSquare can move to kingSquare
    try {
      const moves = tempChess.moves({ square: targetSquare as ChessSquare, verbose: true });
      for (const move of moves) {
        if (move.to === kingSquare) {
          return true; // Deployment would give check
        }
      }
    } catch {
      // If we can't get moves, assume no check
    }
    
    return false;
  }

  /**
   * Resolve Disturb tags when playing first card of turn
   * Requirement 8.3: First card play removes all tags, deducting 1 second per tag
   */
  resolveDisturbTagsOnCardPlay(player: PlayerColor): void {
    const playerState = this.state.players[player];
    
    if (!playerState.hasPlayedCardThisTurn && playerState.disturbTags > 0) {
      // Deduct time equal to tag count
      this.deductTime(player, playerState.disturbTags);
      // Clear all tags
      playerState.disturbTags = 0;
    }
    
    // Mark that a card has been played this turn
    playerState.hasPlayedCardThisTurn = true;
    this.notifyStateChange();
  }

  /**
   * Resolve Disturb tags when moving without playing cards
   * Requirement 8.4: Moving without cards clears tags without time cost
   */
  resolveDisturbTagsOnMove(player: PlayerColor): void {
    const playerState = this.state.players[player];
    
    if (!playerState.hasPlayedCardThisTurn) {
      // Clear tags without time cost
      playerState.disturbTags = 0;
    }
    
    this.notifyStateChange();
  }

  // ============================================
  // Deck Operations (for DeckManager integration)
  // ============================================

  /**
   * Set player's deck
   */
  setDeck(player: PlayerColor, deck: Card[]): void {
    this.state.players[player].deck = [...deck];
    this.notifyStateChange();
  }

  /**
   * Draw cards from deck to hand
   * @param respectCap If true, won't draw beyond MAX_HAND_SIZE
   */
  drawCards(player: PlayerColor, count: number, respectCap: boolean): number {
    const playerState = this.state.players[player];
    let drawn = 0;
    
    for (let i = 0; i < count; i++) {
      if (playerState.deck.length === 0) break;
      if (respectCap && playerState.hand.length >= MAX_HAND_SIZE) break;
      
      const card = playerState.deck.pop();
      if (card) {
        playerState.hand.push(card);
        drawn++;
      }
    }
    
    this.notifyStateChange();
    return drawn;
  }

  /**
   * Shuffle player's deck
   */
  shuffleDeck(player: PlayerColor): void {
    const deck = this.state.players[player].deck;
    // Fisher-Yates shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    this.notifyStateChange();
  }

  /**
   * Discard cards to max hand size
   * Requirement 3.6: Force discard to 7 if hand > 7
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
   * Get hand size for player
   */
  getHandSize(player: PlayerColor): number {
    return this.state.players[player].hand.length;
  }

  /**
   * Check if hand exceeds max size
   */
  handExceedsMax(player: PlayerColor): boolean {
    return this.state.players[player].hand.length > MAX_HAND_SIZE;
  }

  // ============================================
  // Card Effect Resolution (Requirements 11.6, 11.7, 11.8)
  // ============================================

  /**
   * Check if a card can be played
   * Validates energy cost, time cost, and special conditions
   * 
   * @param card The card to check
   * @param player The player attempting to play the card
   * @returns Object with canPlay boolean and reason string
   */
  canPlayCard(card: Card, player: PlayerColor): { canPlay: boolean; reason: string } {
    const playerState = this.state.players[player];

    // Check if it's the player's turn
    if (this.state.currentTurn !== player) {
      return { canPlay: false, reason: 'Not your turn' };
    }

    // Check game phase
    if (this.state.phase !== 'playing') {
      return { canPlay: false, reason: 'Game is not in playing phase' };
    }

    // Check energy card limit (Requirement 6.4)
    if (card.type === 'energy' && playerState.energyPlayedThisTurn) {
      return { canPlay: false, reason: 'Already played an energy card this turn' };
    }

    // Check energy cost (Requirement 6.6)
    if (card.energyCost !== null && playerState.energy < card.energyCost) {
      return { canPlay: false, reason: 'Insufficient energy' };
    }

    // Check time cost - player must have enough time
    if (card.timeCost !== null && playerState.clock < card.timeCost) {
      return { canPlay: false, reason: 'Insufficient time' };
    }

    return { canPlay: true, reason: '' };
  }

  /**
   * Play a card from hand
   * Requirement 11.6: Support "Deploy [piece] at a square you control" action
   * Requirement 11.7: Support "Destroy target piece at a square you control" action
   * Requirement 11.8: Support time and energy modification actions
   * 
   * @param cardId ID of the card to play
   * @param player The player playing the card
   * @param target Optional target square for targeted effects
   * @returns Object with success boolean and message
   */
  playCard(cardId: string, player: PlayerColor, target?: string): { success: boolean; message: string } {
    const playerState = this.state.players[player];

    // Find card in hand
    const cardIndex = playerState.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) {
      return { success: false, message: 'Card not found in hand' };
    }

    const card = playerState.hand[cardIndex];

    // Validate card can be played
    const validation = this.canPlayCard(card, player);
    if (!validation.canPlay) {
      return { success: false, message: validation.reason };
    }

    // Check if card requires target
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
   * Resolve a card's effect
   * 
   * @param card The card being played
   * @param player The player who played the card
   * @param target Optional target for targeted effects
   * @returns Object with success boolean and message
   */
  resolveCardEffect(card: Card, player: PlayerColor, target?: string): { success: boolean; message: string } {
    const effect = card.effect;

    switch (effect.action) {
      case 'ENERGY_CARD':
        // Energy card effect (Requirement 6.3)
        const energySuccess = this.playEnergyCard(player);
        return { 
          success: energySuccess, 
          message: energySuccess ? 'Energy increased' : 'Energy card already played this turn' 
        };

      case 'SHUFFLE_DECK':
        // Shuffle deck (Requirement 11.2)
        this.shuffleDeck(player);
        return { success: true, message: 'Deck shuffled' };

      case 'DRAW_CARDS':
        // Draw cards (Requirements 11.3, 11.4)
        const drawn = this.drawCards(player, effect.count, effect.respectCap);
        return { success: true, message: `Drew ${drawn} card(s)` };

      case 'DISCARD_TO_CAP':
        // Discard to hand size (Requirement 11.5)
        const discarded = this.discardToHandSize(player);
        return { success: true, message: `Discarded ${discarded.length} card(s)` };

      case 'DEPLOY_PIECE':
        // Deploy piece (Requirement 11.6)
        // Note: Actual piece placement is handled by ChessBoardWrapper
        // This just validates and signals the intent
        // The deployed piece is tracked so it cannot move this turn
        if (!target) {
          return { success: false, message: 'No target square specified' };
        }
        // Track the deployed piece so it cannot move this turn
        this.trackDeployedPiece(player, target);
        return { 
          success: true, 
          message: `Deploy ${effect.piece} to ${target}`,
          // The actual piece placement will be done by the game scene
          // which has access to the ChessBoardWrapper
        } as { success: boolean; message: string };

      case 'DESTROY_PIECE':
        // Destroy piece (Requirement 11.7)
        if (!target) {
          return { success: false, message: 'No target square specified' };
        }
        return { 
          success: true, 
          message: `Destroy piece at ${target}`,
          // The actual piece removal will be done by the game scene
        } as { success: boolean; message: string };

      case 'MODIFY_TIME':
        // Modify time (Requirement 11.8)
        this.modifyTime(player, effect.amount);
        return { 
          success: true, 
          message: effect.amount >= 0 ? `Gained ${effect.amount}s` : `Lost ${Math.abs(effect.amount)}s` 
        };

      case 'MODIFY_ENERGY':
        // Modify energy (Requirement 11.8)
        const energyModSuccess = this.modifyEnergy(player, effect.amount);
        return { 
          success: energyModSuccess, 
          message: effect.amount >= 0 ? `Gained ${effect.amount} energy` : `Lost ${Math.abs(effect.amount)} energy` 
        };

      case 'MODIFY_ENERGY_CAP':
        // Modify energy cap (Requirement 11.8)
        this.modifyEnergyCap(player, effect.amount);
        return { 
          success: true, 
          message: effect.amount >= 0 ? `Energy cap increased by ${effect.amount}` : `Energy cap decreased by ${Math.abs(effect.amount)}` 
        };

      default:
        return { success: false, message: 'Unknown effect' };
    }
  }

  /**
   * Get a card from player's hand by ID
   */
  getCardFromHand(player: PlayerColor, cardId: string): Card | null {
    return this.state.players[player].hand.find(c => c.id === cardId) || null;
  }

  /**
   * Get player's hand
   */
  getHand(player: PlayerColor): Card[] {
    return [...this.state.players[player].hand];
  }

  /**
   * Get player's deck
   */
  getDeck(player: PlayerColor): Card[] {
    return [...this.state.players[player].deck];
  }

  /**
   * Get player's discard pile
   */
  getDiscard(player: PlayerColor): Card[] {
    return [...this.state.players[player].discard];
  }

  // ============================================
  // Board State
  // ============================================

  /**
   * Update board FEN
   */
  setBoardFEN(fen: string): void {
    this.state.boardFEN = fen;
    this.notifyStateChange();
  }

  /**
   * Get current board FEN
   */
  getBoardFEN(): string {
    return this.state.boardFEN;
  }

  // ============================================
  // State Import/Export (for P2P sync)
  // ============================================

  /**
   * Import full game state (for P2P sync)
   */
  importState(state: GameState): void {
    this.state = { ...state };
    this.notifyStateChange();
  }

  /**
   * Export full game state (for P2P sync)
   */
  exportState(): GameState {
    return { ...this.state };
  }
}

// Export constants for testing
export {
  INITIAL_CLOCK_SECONDS,
  MOVE_TIME_COST,
  MULLIGAN_TIME_COST,
  STOPWATCH_THRESHOLD,
  MAX_HAND_SIZE,
  INITIAL_DRAW_COUNT
};
