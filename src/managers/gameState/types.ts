/**
 * @fileoverview Game state type definitions
 *
 * @module managers/gameState/types
 */

/**
 * Card effect action types
 *
 * Each effect defines what happens when a card is played:
 * - SHUFFLE_DECK: Randomize deck order
 * - DRAW_CARDS: Draw cards from deck
 * - DISCARD_TO_CAP: Discard excess cards
 * - DEPLOY_PIECE: Place a piece on the board
 * - DESTROY_PIECE: Remove a piece from the board
 * - MODIFY_TIME: Add or subtract clock time
 * - MODIFY_ENERGY: Add or subtract energy
 * - MODIFY_ENERGY_CAP: Change maximum energy
 * - ENERGY_CARD: Standard energy card effect
 */
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

/** Chess piece type (lowercase) */
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

/**
 * Card data structure
 *
 * @property id - Unique identifier
 * @property name - Display name
 * @property type - Card category (energy, piece, spell)
 * @property energyCost - Energy required to play (null if none)
 * @property timeCost - Time deducted when played (null if none)
 * @property effect - What happens when played
 * @property artAsset - Texture key for card art
 * @property frameColor - Card frame color variant
 */
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

/**
 * Player state data structure
 *
 * @property name - Player display name
 * @property clock - Remaining time in seconds (starts at 600)
 * @property stopwatch - Accumulated turn time cost
 * @property energy - Current energy available
 * @property energyCap - Maximum energy capacity
 * @property disturbTags - Disturb debuff count
 * @property mode - Current mode (focus or disturb)
 * @property energyPlayedThisTurn - Whether energy card was played
 * @property hasPlayedCardThisTurn - Whether any card was played
 * @property deployedPiecesThisTurn - Squares where pieces were deployed
 * @property deck - Cards in deck
 * @property hand - Cards in hand
 * @property discard - Cards in discard pile
 */
export interface PlayerState {
  name: string;
  clock: number;
  stopwatch: number;
  energy: number;
  energyCap: number;
  disturbTags: number;
  mode: 'focus' | 'disturb';
  energyPlayedThisTurn: boolean;
  hasPlayedCardThisTurn: boolean;
  deployedPiecesThisTurn: string[];
  deck: Card[];
  hand: Card[];
  discard: Card[];
}

/** Game phase type */
export type GamePhase = 'mulligan' | 'playing' | 'ended';

/** Player color type */
export type PlayerColor = 'white' | 'black';

/**
 * Complete game state structure
 *
 * @property phase - Current game phase
 * @property currentTurn - Whose turn it is
 * @property localPlayer - Which color the local player controls
 * @property turnNumber - Current turn number
 * @property boardFEN - Chess position in FEN notation
 * @property players - State for both players
 */
export interface GameState {
  phase: GamePhase;
  currentTurn: PlayerColor;
  localPlayer: PlayerColor;
  turnNumber: number;
  boardFEN: string;
  players: {
    white: PlayerState;
    black: PlayerState;
  };
}
