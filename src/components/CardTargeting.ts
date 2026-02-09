/**
 * @fileoverview CardTargeting Component - Handles card drag-to-play and arrow targeting
 * 
 * This component manages the targeting mechanics for playing cards:
 * - Non-targeted cards: Drag to play zone to activate
 * - Targeted cards: Draw arrow from card to target square
 * 
 * Requirements addressed:
 * - 9.3: Drag card to board area to play (non-targeted cards)
 * - 9.4: Drag arrow from card to target (targeted cards)
 * - 9.5: Resolve effect when arrow released on valid target
 * - 9.6: Cancel and return to normal when released on invalid target
 * 
 * @module components/CardTargeting
 * @requires phaser
 * @requires ../managers/GameStateManager
 * @requires ./Card
 * @requires ../data/cards
 */

import Phaser from 'phaser';
import { Card as CardData } from '../managers/GameStateManager';
import { CardComponent } from './Card';
import { cardRequiresTarget } from '../data/cards';
import { Square } from 'chess.js';
import { hex } from '../utils/colors.js';
import { TARGETING_COLORS, TARGETING_LAYOUT, DEPTH, MATH } from '../config';

/* ============================================
 * TARGETING VISUAL CONSTANTS
 * ============================================
 */

/** Color for the targeting arrow (yellow) - CHANGE THIS TO MODIFY ARROW COLOR */
const ARROW_COLOR = hex(TARGETING_COLORS.ARROW);

/** Width of the arrow line in pixels */
const ARROW_WIDTH = TARGETING_LAYOUT.ARROW_WIDTH;

/** Size of the arrow head in pixels */
const ARROW_HEAD_SIZE = TARGETING_LAYOUT.ARROW_HEAD_SIZE;

/** Alpha for persistent arrows when selecting multiple targets */
const PERSISTENT_ARROW_ALPHA = 0.6;

/** Color for valid target highlights (green) */
const VALID_TARGET_COLOR = hex(TARGETING_COLORS.VALID_TARGET);

/** Color for invalid target highlights (red) */
const INVALID_TARGET_COLOR = hex(TARGETING_COLORS.INVALID_TARGET);

/** Alpha for play zone highlight */
const PLAY_ZONE_ALPHA = TARGETING_LAYOUT.PLAY_ZONE_ALPHA;

/** 
 * Curve factor for the targeting arrow (0 = straight, higher = more curved)
 * CHANGE THIS TO MODIFY ARROW CURVE INTENSITY
 * Positive values curve upward, negative values curve downward
 */
const ARROW_CURVE_FACTOR = TARGETING_LAYOUT.ARROW_CURVE_FACTOR;

/* ============================================
 * TYPE DEFINITIONS
 * ============================================
 */

/**
 * Target validation function type
 * 
 * Called to determine if a square is a valid target for a card.
 * 
 * @param square - The chess square being targeted
 * @param card - The card being played
 * @returns True if the target is valid
 */
export type TargetValidator = (square: Square, card: CardData) => boolean;

export type CardPlayOutcome = 'played' | 'continue' | 'cancelled';

export function normalizeCardPlayOutcome(outcome: CardPlayOutcome | boolean | void): CardPlayOutcome {
  if (outcome === 'continue') return 'continue';
  if (outcome === 'cancelled' || outcome === false) return 'cancelled';
  return 'played';
}

/**
 * Play zone bounds definition
 * 
 * Defines the rectangular area where non-targeted cards
 * can be dropped to play them.
 * 
 * @property x - Left edge X coordinate
 * @property y - Top edge Y coordinate
 * @property width - Zone width
 * @property height - Zone height
 */
export interface PlayZoneBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/* ============================================
 * CARD TARGETING COMPONENT CLASS
 * ============================================
 */

/**
 * CardTargetingComponent - Manages card targeting interactions
 * 
 * Handles two targeting modes:
 * 1. Drag-to-play: Card follows cursor, dropped in play zone to activate
 * 2. Arrow targeting: Card stays in place, arrow drawn to target square
 * 
 * Visual elements:
 * - Arrow graphics (for targeted cards)
 * - Play zone highlight (for non-targeted cards)
 * - Target square highlight
 * 
 * @example
 * const targeting = new CardTargetingComponent(scene);
 * targeting.setPlayZone({ x: 100, y: 100, width: 400, height: 300 });
 * targeting.setBoardBounds(200, 100, 512, 512, 64);
 * 
 * targeting.onCardPlayed = (card) => {
 *   console.log('Card played:', card.name);
 * };
 * 
 * Used by: CardHandComponent (delegates targeting to this component)
 */
export class CardTargetingComponent {
  /** Reference to the Phaser scene */
  private scene: Phaser.Scene;
  
  /** Graphics for drawing the targeting arrow */
  private arrowGraphics: Phaser.GameObjects.Graphics;

  /** Graphics for persistent arrows between multi-step targets */
  private persistentArrowGraphics: Phaser.GameObjects.Graphics;
  
  /** Graphics for highlighting the play zone */
  private playZoneGraphics: Phaser.GameObjects.Graphics;
  
  /* ============================================
   * STATE PROPERTIES
   * ============================================
   */
  
  /** Whether arrow targeting mode is active */
  private isTargeting: boolean = false;
  
  /** Whether drag-to-play mode is active */
  private isDragging: boolean = false;

  /** Force drag mode (used for discard-only interactions) */
  private forceDragMode: boolean = false;
  
  /** The card currently being targeted/dragged */
  private activeCard: CardData | null = null;
  
  /** The card component being targeted/dragged */
  private activeCardComponent: CardComponent | null = null;
  
  /** Starting X position of the drag/arrow */
  private startX: number = 0;
  
  /** Starting Y position of the drag/arrow */
  private startY: number = 0;
  
  /** Current X position of cursor */
  private currentX: number = 0;
  
  /** Current Y position of cursor */
  private currentY: number = 0;
  
  /** Offset from pointer to card center X (to prevent jump on drag start) */
  private dragOffsetX: number = 0;
  
  /** Offset from pointer to card center Y (to prevent jump on drag start) */
  private dragOffsetY: number = 0;
  
  /** Last coordinates used to render targeting (avoid duplicate redraws) */
  private lastUpdateX: number | null = null;
  private lastUpdateY: number | null = null;

  /** Last pointer release position */
  private lastReleaseX: number | null = null;
  private lastReleaseY: number | null = null;
  
  /** Cached play zone hit state to avoid redundant redraws */
  private lastPlayZoneInBounds: boolean | null = null;
  
  /* ============================================
   * CONFIGURATION PROPERTIES
   * ============================================
   */
  
  /** Play zone bounds for non-targeted cards */
  private playZone: PlayZoneBounds | null = null;

  /** Optional extra play zone (e.g., discard area) */
  private extraPlayZone: PlayZoneBounds | null = null;
  
  /** Board bounds for targeted cards */
  private boardBounds: PlayZoneBounds | null = null;
  
  /** Function to validate targets */
  private targetValidator: TargetValidator | null = null;
  
  /** Size of each chess square in pixels */
  private squareSize: number = 64;
  
  /** Board left edge X coordinate */
  private boardX: number = 0;
  
  /** Board top edge Y coordinate */
  private boardY: number = 0;
  
  /** Whether board is flipped (black perspective) */
  private isFlipped: boolean = false;

  /** Whether to listen to scene pointermove/up events internally */
  private useSceneInputHandlers: boolean = true;
  
  /* ============================================
   * EVENT CALLBACKS
   * ============================================
   */
  
  /** Called when a non-targeted card is played (Req 9.3) */
  public onCardPlayed?: (card: CardData) => CardPlayOutcome | boolean | void;
  
  /** Called when a targeted card hits a valid target (Req 9.5) */
  public onCardTargeted?: (card: CardData, target: Square) => CardPlayOutcome | boolean | void;
  
  /** Called when targeting starts */
  public onTargetingStart?: (card: CardData) => void;
  
  /** Called when targeting is cancelled (Req 9.6) */
  public onTargetingCancel?: (card: CardData) => void;
  
  /** Bound input handlers for cleanup */
  private boundPointerMove?: (pointer: Phaser.Input.Pointer) => void;
  private boundPointerUp?: (pointer: Phaser.Input.Pointer) => void;
  private boundPointerUpOutside?: (pointer: Phaser.Input.Pointer) => void;
  private boundRightClick?: (pointer: Phaser.Input.Pointer) => void;
  
  /** Throttle timestamp for update calls */
  private lastUpdateTime: number = 0;

  /** Whether to follow pointer movement after releasing (multi-step targeting) */
  private followPointer: boolean = false;

  /** Ignore the next scene pointerup event after switching to follow mode */
  private ignoreNextPointerUp: boolean = false;

  /** Pause targeting updates (used for modal overlays) */
  private paused: boolean = false;
  
  /** Minimum ms between update calls to prevent glitches from fast movement */
  private static readonly UPDATE_THROTTLE_MS = 8; // ~120fps max

  /**
   * Creates a new CardTargetingComponent
   * 
   * Algorithm:
   * 1. Create arrow graphics layer (depth 500)
   * 2. Create play zone graphics layer (depth 499)
   * 3. Setup input handlers for pointer events
   * 
   * @param scene - The Phaser scene
   * @param useSceneInputHandlers - Whether to register scene-level move/up handlers
   * 
   * Used by: CardHandComponent constructor
   */
  constructor(scene: Phaser.Scene, useSceneInputHandlers: boolean = true) {
    this.scene = scene;
    this.useSceneInputHandlers = useSceneInputHandlers;
    
    // Create graphics layers
    this.persistentArrowGraphics = scene.add.graphics();
    this.persistentArrowGraphics.setDepth(DEPTH.TARGETING_ARROW);

    this.arrowGraphics = scene.add.graphics();
    this.arrowGraphics.setDepth(DEPTH.TARGETING_ARROW);
    
    this.playZoneGraphics = scene.add.graphics();
    this.playZoneGraphics.setDepth(DEPTH.PLAY_ZONE);
    
    this.setupInputHandlers();
  }

  /* ============================================
   * CONFIGURATION METHODS
   * ============================================
   */

  /**
   * Configures the play zone for non-targeted cards
   * 
   * The play zone is the area where dragging a non-targeted
   * card will trigger the play action.
   * 
   * @param bounds - Play zone boundaries
   * 
   * Used by: CardHandComponent.setPlayZone()
   */
  setPlayZone(bounds: PlayZoneBounds): void {
    this.playZone = bounds;
  }

  /**
   * Configures the board bounds for targeted cards
   * 
   * Used to convert pointer position to chess square
   * for arrow-based targeting.
   * 
   * @param x - Board left edge X
   * @param y - Board top edge Y
   * @param width - Board width
   * @param height - Board height
   * @param squareSize - Size of each chess square
   * @param isFlipped - Whether board is flipped (black perspective)
   * 
   * Used by: CardHandComponent.setBoardBounds()
   */
  setBoardBounds(
    x: number,
    y: number,
    width: number,
    height: number,
    squareSize: number,
    isFlipped: boolean = false
  ): void {
    this.boardBounds = { x, y, width, height };
    this.squareSize = squareSize;
    this.boardX = x;
    this.boardY = y;
    this.isFlipped = isFlipped;
  }

  /**
   * Sets the target validation function
   * 
   * The validator determines which squares are valid targets
   * for a given card.
   * 
   * @param validator - Function that validates targets
   * 
   * Used by: CardHandComponent.setTargetValidator()
   */
  setTargetValidator(validator: TargetValidator): void {
    this.targetValidator = validator;
  }

  /**
   * Sets an additional play zone for drag-to-play checks
   *
   * @param bounds - Additional play zone bounds or null to clear
   */
  setExtraPlayZone(bounds: PlayZoneBounds | null): void {
    this.extraPlayZone = bounds;
  }

  /**
   * Forces drag-only mode for all cards (disables arrow targeting)
   *
   * @param force - Whether to force drag mode
   */
  setForceDragMode(force: boolean): void {
    this.forceDragMode = force;
    if (force && this.isTargeting) {
      this.handleCancelRequest();
    }
  }

  private getLocalPointerPosition(x: number, y: number): { x: number; y: number } {
    const container = this.activeCardComponent?.getContainer();
    const parent = container?.parentContainer;
    if (!parent) return { x, y };
    const matrix = parent.getWorldTransformMatrix();
    const point = new Phaser.Math.Vector2();
    matrix.applyInverse(x, y, point);
    return { x: point.x, y: point.y };
  }

  /* ============================================
   * TARGETING LIFECYCLE METHODS
   * ============================================
   */

  /**
   * Starts targeting mode for a card
   * 
   * Algorithm:
   * 1. Store card and position references
   * 2. Calculate offset from pointer to card center (prevents jump)
   * 3. Check if card requires a target
   * 4. If targeted: Enable arrow mode, notify start
   * 5. If non-targeted: Enable drag mode, show play zone
   * 
   * @param card - The card being played
   * @param cardComponent - The card's visual component
   * @param startX - Starting X position (card center)
   * @param startY - Starting Y position (card center)
   * @param pointerX - Pointer X position (optional, defaults to startX)
   * @param pointerY - Pointer Y position (optional, defaults to startY)
   * 
   * Used by: CardHandComponent.handleCardDragStart()
   */
  startTargeting(
    card: CardData,
    cardComponent: CardComponent,
    startX: number,
    startY: number,
    pointerX?: number,
    pointerY?: number
  ): void {
    this.activeCard = card;
    this.activeCardComponent = cardComponent;
    this.startX = startX;
    this.startY = startY;
    const pointerWorldX = pointerX ?? startX;
    const pointerWorldY = pointerY ?? startY;
    this.currentX = pointerWorldX;
    this.currentY = pointerWorldY;
    
    // Calculate offset from pointer to card center to prevent jump on drag
    const localPointer = this.getLocalPointerPosition(pointerWorldX, pointerWorldY);
    const localCardPos = cardComponent.getPosition();
    this.dragOffsetX = localCardPos.x - localPointer.x;
    this.dragOffsetY = localCardPos.y - localPointer.y;
    
    this.lastUpdateX = null;
    this.lastUpdateY = null;
    this.lastPlayZoneInBounds = null;
    this.lastReleaseX = null;
    this.lastReleaseY = null;
    this.followPointer = false;
    this.ignoreNextPointerUp = false;
    this.paused = false;
    this.persistentArrowGraphics.clear();
    
    const requiresTarget = this.forceDragMode ? false : cardRequiresTarget(card);
    
    if (requiresTarget) {
      // Arrow targeting mode - card stays in place, arrow follows cursor
      // Requirement 9.4: Drag arrow from card to target
      this.isTargeting = true;
      this.isDragging = false;
    } else {
      // Drag-to-play mode - card follows cursor
      // Requirement 9.3: Drag card to board area to play
      this.isTargeting = false;
      this.isDragging = true;
      this.showPlayZone();
    }
    
    // Notify targeting start for both modes (for highlighting legal squares)
    if (this.onTargetingStart) {
      this.onTargetingStart(card);
    }
  }

  /**
   * Updates targeting position (called on pointer move)
   * 
   * Algorithm:
   * - If arrow targeting: Draw arrow from start to cursor
   * - If drag-to-play: Move card with cursor (using offset to prevent jump)
   * 
   * Includes throttling to prevent glitches from very fast mouse movement.
   * 
   * @param x - Current pointer X
   * @param y - Current pointer Y
   * 
   * Used by: CardHandComponent.handleCardDrag()
   */
  updateTargeting(x: number, y: number): void {
    if (!this.activeCard) return;
    if (this.paused) return;
    
    // Skip if coordinates haven't changed
    if (this.lastUpdateX === x && this.lastUpdateY === y) {
      return;
    }
    
    // Throttle updates to prevent glitches from very fast movement
    const now = performance.now();
    if (now - this.lastUpdateTime < CardTargetingComponent.UPDATE_THROTTLE_MS) {
      // Still update position tracking but skip expensive operations
      this.currentX = x;
      this.currentY = y;
      
      // For drag mode, always update card position to keep it responsive
      if (this.isDragging && this.activeCardComponent) {
        const localPointer = this.getLocalPointerPosition(x, y);
        this.activeCardComponent.setPosition(localPointer.x + this.dragOffsetX, localPointer.y + this.dragOffsetY);
      }
      return;
    }
    this.lastUpdateTime = now;
    
    this.lastUpdateX = x;
    this.lastUpdateY = y;
    this.currentX = x;
    this.currentY = y;
    
    if (this.isTargeting) {
      // Arrow targeting - draw arrow from card to cursor
      this.drawTargetingArrow();
    } else if (this.isDragging && this.activeCardComponent) {
      // Drag-to-play - move card with cursor, applying offset to prevent jump
      const localPointer = this.getLocalPointerPosition(x, y);
      this.activeCardComponent.setPosition(localPointer.x + this.dragOffsetX, localPointer.y + this.dragOffsetY);
      
      // Update play zone highlight based on position
      this.updatePlayZoneHighlight(x, y);
    }
  }

  /**
   * Ends targeting (called on pointer up)
   * 
   * Algorithm:
   * 1. If arrow targeting:
   *    a. Get target square from position
   *    b. If valid target → call onCardTargeted (Req 9.5)
   *    c. If invalid → call onTargetingCancel (Req 9.6)
   * 2. If drag-to-play:
   *    a. If in play zone → call onCardPlayed (Req 9.5)
   *    b. If outside → call onTargetingCancel (Req 9.6)
   * 3. Clean up targeting state
   * 
   * @param x - Final pointer X
   * @param y - Final pointer Y
   * 
   * Used by: CardHandComponent.handleCardDragEnd()
   */
  endTargeting(x: number, y: number): 'played' | 'cancelled' {
    if (!this.activeCard) return 'cancelled';
    
    const card = this.activeCard;
    this.lastReleaseX = x;
    this.lastReleaseY = y;
    
    if (this.isTargeting) {
      // Arrow targeting - check if we hit a valid target
      const target = this.getTargetSquare(x, y);
      
      if (target && this.isValidTarget(target, card)) {
        // Requirement 9.5: Valid target - resolve effect
        const outcome = normalizeCardPlayOutcome(this.onCardTargeted?.(card, target));
        if (outcome === 'continue') {
          this.addPersistentArrow(target);
          this.followPointer = true;
          this.ignoreNextPointerUp = true;
          this.scene.time.delayedCall(0, () => {
            this.ignoreNextPointerUp = false;
          });
          return 'played';
        }
        if (outcome === 'cancelled') {
          this.cancelTargeting();
          return 'cancelled';
        }
        this.cancelTargeting();
        return 'played';
      }

      // Requirement 9.6: Invalid target - cancel
      if (this.onTargetingCancel) {
        this.onTargetingCancel(card);
      }
      this.cancelTargeting();
      return 'cancelled';
    } else if (this.isDragging) {
      // Drag-to-play - check if we're in the play zone
      if (this.isInPlayZone(x, y)) {
        // Requirement 9.5: In play zone - play the card
        const outcome = normalizeCardPlayOutcome(this.onCardPlayed?.(card));
        if (outcome === 'cancelled') {
          this.cancelTargeting();
          return 'cancelled';
        }
        this.cancelTargeting();
        return 'played';
      } else {
        // Requirement 9.6: Outside play zone - cancel
        if (this.onTargetingCancel) {
          this.onTargetingCancel(card);
        }
        this.cancelTargeting();
        return 'cancelled';
      }
    }
    
    this.cancelTargeting();
    return 'cancelled';
  }

  /**
   * Cancels current targeting and cleans up
   * 
   * Used by: endTargeting(), external cancellation, right-click cancel
   */
  cancelTargeting(): void {
    this.isTargeting = false;
    this.isDragging = false;
    this.activeCard = null;
    this.activeCardComponent = null;
    this.lastUpdateX = null;
    this.lastUpdateY = null;
    this.lastPlayZoneInBounds = null;
    this.lastUpdateTime = 0;
    this.followPointer = false;
    this.ignoreNextPointerUp = false;
    this.paused = false;
    
    this.arrowGraphics.clear();
    this.persistentArrowGraphics.clear();
    this.hidePlayZone();
  }
  
  /**
   * Forcefully cancels targeting with callback notification
   * 
   * Used by: External cancel requests (e.g., from CardHand on right-click)
   */
  forceCancel(): void {
    this.handleCancelRequest();
  }

  /* ============================================
   * STATE QUERY METHODS
   * ============================================
   */

  /**
   * Checks if targeting is currently active
   * 
   * @returns True if in any targeting mode
   */
  isActive(): boolean {
    return this.isTargeting || this.isDragging;
  }

  /**
   * Checks if in arrow targeting mode
   * 
   * @returns True if drawing targeting arrow
   */
  isArrowTargeting(): boolean {
    return this.isTargeting;
  }

  /**
   * Checks if in drag-to-play mode
   * 
   * @returns True if dragging card to play zone
   */
  isDragToPlay(): boolean {
    return this.isDragging;
  }

  /**
   * Gets the currently active card
   * 
   * @returns The card being targeted, or null
   */
  getActiveCard(): CardData | null {
    return this.activeCard;
  }

  /**
   * Gets the active card component
   * 
   * @returns The card component being targeted, or null
   */
  getActiveCardComponent(): CardComponent | null {
    return this.activeCardComponent;
  }

  /**
   * Gets the last pointer release position, if any.
   */
  getLastReleasePosition(): { x: number; y: number } | null {
    if (this.lastReleaseX === null || this.lastReleaseY === null) return null;
    return { x: this.lastReleaseX, y: this.lastReleaseY };
  }

  /* ============================================
   * PRIVATE INPUT HANDLING
   * ============================================
   */

  /**
   * Sets up input handlers for pointer events
   * 
   * Listens for:
   * - pointermove: Update targeting position
   * - pointerup: End targeting
   * - pointerdown (right button): Cancel targeting
   * 
   * @private
   */
  private setupInputHandlers(): void {
    this.boundPointerMove = (pointer: Phaser.Input.Pointer) => {
      if (this.isActive() && this.shouldHandleSceneInput()) {
        this.updateTargeting(pointer.x, pointer.y);
      }
    };
    
    this.boundPointerUp = (pointer: Phaser.Input.Pointer) => {
      if (!this.isActive() || !this.shouldHandleSceneInput()) return;
      if (this.ignoreNextPointerUp) {
        this.ignoreNextPointerUp = false;
        return;
      }
      this.endTargeting(pointer.x, pointer.y);
    };

    this.boundPointerUpOutside = (pointer: Phaser.Input.Pointer) => {
      if (!this.isActive() || !this.shouldHandleSceneInput()) return;
      if (this.ignoreNextPointerUp) {
        this.ignoreNextPointerUp = false;
        return;
      }
      this.endTargeting(pointer.x, pointer.y);
    };

    this.scene.input.on('pointermove', this.boundPointerMove);
    this.scene.input.on('pointerup', this.boundPointerUp);
    this.scene.input.on('pointerupoutside', this.boundPointerUpOutside);

    // Right-click to cancel targeting
    this.boundRightClick = (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown() && this.isActive()) {
        this.handleCancelRequest();
      }
    };

    this.scene.input.on('pointerdown', this.boundRightClick);
  }
  
  /**
   * Handles a cancel request (from right-click or escape key)
   * Cancels current targeting and notifies callback
   * 
   * @private
   */
  private handleCancelRequest(): void {
    if (!this.activeCard) return;
    
    const card = this.activeCard;
    
    // Notify cancel callback
    if (this.onTargetingCancel) {
      this.onTargetingCancel(card);
    }
    
    this.cancelTargeting();
  }

  private shouldHandleSceneInput(): boolean {
    return (this.useSceneInputHandlers || this.followPointer) && !this.paused;
  }

  /**
   * Pauses or resumes targeting updates (e.g., during promotion picker).
   */
  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
      this.arrowGraphics.clear();
    }
  }

  /* ============================================
   * PRIVATE RENDERING METHODS
   * ============================================
   */

  private addPersistentArrow(target: Square): void {
    if (!this.boardBounds) return;
    const { col, row } = this.squareToCoords(target);
    const endX = this.boardX + col * this.squareSize + this.squareSize / 2;
    const endY = this.boardY + row * this.squareSize + this.squareSize / 2;
    this.drawArrow(
      this.persistentArrowGraphics,
      this.startX,
      this.startY,
      endX,
      endY,
      VALID_TARGET_COLOR,
      PERSISTENT_ARROW_ALPHA
    );
  }

  private drawArrow(
    graphics: Phaser.GameObjects.Graphics,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    color: number,
    alpha: number = 1
  ): void {
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    const dx = endX - startX;
    const dy = endY - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Perpendicular offset for curve (curves upward/left relative to direction)
    const perpX = -dy * ARROW_CURVE_FACTOR;
    const perpY = dx * ARROW_CURVE_FACTOR;
    const controlX = midX + perpX;
    const controlY = midY + perpY;

    // Draw curved line using quadratic bezier
    graphics.lineStyle(ARROW_WIDTH, color, alpha);
    graphics.beginPath();
    graphics.moveTo(startX, startY);

    // Draw bezier curve as series of line segments for smooth appearance
    const segments = Math.max(TARGETING_LAYOUT.MIN_ARROW_SEGMENTS, Math.floor(distance / TARGETING_LAYOUT.ARROW_SEGMENT_DIVISOR));
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const invT = 1 - t;
      // Quadratic bezier formula: B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
      const x = invT * invT * startX + 2 * invT * t * controlX + t * t * endX;
      const y = invT * invT * startY + 2 * invT * t * controlY + t * t * endY;
      graphics.lineTo(x, y);
    }
    graphics.strokePath();

    // Calculate tangent angle at the end of the curve for arrow head direction
    // Derivative of quadratic bezier at t=1: 2(P2 - P1)
    const tangentX = 2 * (endX - controlX);
    const tangentY = 2 * (endY - controlY);
    const angle = Math.atan2(tangentY, tangentX);

    // Draw arrow head aligned with curve tangent
    const headX1 = endX - ARROW_HEAD_SIZE * Math.cos(angle - MATH.ARROW_HEAD_ANGLE);
    const headY1 = endY - ARROW_HEAD_SIZE * Math.sin(angle - MATH.ARROW_HEAD_ANGLE);
    const headX2 = endX - ARROW_HEAD_SIZE * Math.cos(angle + MATH.ARROW_HEAD_ANGLE);
    const headY2 = endY - ARROW_HEAD_SIZE * Math.sin(angle + MATH.ARROW_HEAD_ANGLE);

    graphics.fillStyle(color, alpha);
    graphics.beginPath();
    graphics.moveTo(endX, endY);
    graphics.lineTo(headX1, headY1);
    graphics.lineTo(headX2, headY2);
    graphics.closePath();
    graphics.fillPath();
  }

  /**
   * Draws the targeting arrow from card to cursor
   * 
   * Algorithm:
   * 1. Clear previous arrow
   * 2. Determine if target is valid (affects color)
   * 3. Draw curved bezier line from start to current position
   * 4. Draw arrow head at current position (tangent to curve)
   * 5. Highlight target square if over board
   * 
   * Arrow color and curve can be configured at the top of this file:
   * - ARROW_COLOR: Base color when not over valid target
   * - VALID_TARGET_COLOR: Color when over valid target
   * - ARROW_CURVE_FACTOR: How much the arrow curves (0 = straight)
   * 
   * @private
   */
  private drawTargetingArrow(): void {
    this.arrowGraphics.clear();
    
    // Determine arrow color based on target validity
    const target = this.getTargetSquare(this.currentX, this.currentY);
    const isValid = target && this.activeCard && this.isValidTarget(target, this.activeCard);
    const color = isValid ? VALID_TARGET_COLOR : ARROW_COLOR;
    
    this.drawArrow(this.arrowGraphics, this.startX, this.startY, this.currentX, this.currentY, color, 1);
    
    // Highlight target square if over board
    if (target && this.boardBounds) {
      const { col, row } = this.squareToCoords(target);
      const squareX = this.boardX + col * this.squareSize;
      const squareY = this.boardY + row * this.squareSize;
      
      const highlightColor = isValid ? VALID_TARGET_COLOR : INVALID_TARGET_COLOR;
      this.arrowGraphics.fillStyle(highlightColor, 0.3);
      this.arrowGraphics.fillRect(squareX, squareY, this.squareSize, this.squareSize);
    }
  }

  /**
   * Shows the play zone highlight
   * 
   * @private
   */
  private showPlayZone(): void {
    if (!this.playZone) return;
    
    this.playZoneGraphics.clear();
    this.playZoneGraphics.fillStyle(VALID_TARGET_COLOR, PLAY_ZONE_ALPHA);
    this.playZoneGraphics.fillRect(
      this.playZone.x,
      this.playZone.y,
      this.playZone.width,
      this.playZone.height
    );
  }

  /**
   * Hides the play zone highlight
   * 
   * @private
   */
  private hidePlayZone(): void {
    this.playZoneGraphics.clear();
  }

  /**
   * Updates play zone highlight based on cursor position
   * 
   * Changes color to indicate if card will be played.
   * 
   * @param x - Cursor X position
   * @param y - Cursor Y position
   * @private
   */
  private updatePlayZoneHighlight(x: number, y: number): void {
    if (!this.playZone) return;
    
    const isInZone = this.isInPlayZone(x, y);
    if (this.lastPlayZoneInBounds === isInZone) {
      return;
    }
    this.lastPlayZoneInBounds = isInZone;
    this.playZoneGraphics.clear();
    
    const color = isInZone ? VALID_TARGET_COLOR : ARROW_COLOR;
    this.playZoneGraphics.fillStyle(color, PLAY_ZONE_ALPHA);
    this.playZoneGraphics.fillRect(
      this.playZone.x,
      this.playZone.y,
      this.playZone.width,
      this.playZone.height
    );
  }

  /* ============================================
   * PRIVATE COORDINATE CONVERSION
   * ============================================
   */

  /**
   * Checks if a point is within the play zone
   * 
   * @param x - X coordinate
   * @param y - Y coordinate
   * @returns True if point is in play zone
   * @private
   */
  private isInPlayZone(x: number, y: number): boolean {
    const inZone = (zone: PlayZoneBounds | null): boolean => {
      if (!zone) return false;
      return x >= zone.x &&
        x <= zone.x + zone.width &&
        y >= zone.y &&
        y <= zone.y + zone.height;
    };

    return inZone(this.playZone) || inZone(this.extraPlayZone);
  }

  /**
   * Gets the target square from screen coordinates
   * 
   * @param x - Screen X coordinate
   * @param y - Screen Y coordinate
   * @returns Chess square notation, or null if not over board
   * @private
   */
  private getTargetSquare(x: number, y: number): Square | null {
    if (!this.boardBounds) return null;
    
    // Check if point is within board bounds
    if (x < this.boardX || x >= this.boardX + this.boardBounds.width ||
        y < this.boardY || y >= this.boardY + this.boardBounds.height) {
      return null;
    }
    
    const col = Math.floor((x - this.boardX) / this.squareSize);
    const row = Math.floor((y - this.boardY) / this.squareSize);
    
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    
    return this.coordsToSquare(col, row);
  }

  /**
   * Checks if the pointer is within the active card bounds
   * 
   * @param x - Screen X coordinate
   * @param y - Screen Y coordinate
   * @returns True if pointer is over the active card
   * @private
   */
  /**
   * Converts board coordinates to square notation
   * 
   * @param col - Column (0-7)
   * @param row - Row (0-7)
   * @returns Chess square notation (e.g., 'e4')
   * @private
   */
  private coordsToSquare(col: number, row: number): Square {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
    
    if (this.isFlipped) {
      col = 7 - col;
      row = 7 - row;
    }
    
    return (files[col] + ranks[row]) as Square;
  }

  /**
   * Converts square notation to board coordinates
   * 
   * @param square - Chess square notation
   * @returns Object with col and row
   * @private
   */
  private squareToCoords(square: Square): { col: number; row: number } {
    const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
    const rank = 8 - parseInt(square[1]);
    
    let col = file;
    let row = rank;
    
    if (this.isFlipped) {
      col = 7 - col;
      row = 7 - row;
    }
    
    return { col, row };
  }

  /**
   * Checks if a target is valid for the card
   * 
   * @param target - Target square
   * @param card - Card being played
   * @returns True if target is valid
   * @private
   */
  private isValidTarget(target: Square, card: CardData): boolean {
    if (this.targetValidator) {
      return this.targetValidator(target, card);
    }
    // Default: all squares are valid
    return true;
  }

  /* ============================================
   * PUBLIC DISPLAY METHODS
   * ============================================
   */

  /**
   * Sets the depth (z-index) for targeting graphics
   * 
   * @param depth - Depth value
   */
  setDepth(depth: number): void {
    this.arrowGraphics.setDepth(depth);
    this.persistentArrowGraphics.setDepth(depth);
    this.playZoneGraphics.setDepth(depth - 1);
  }

  /**
   * Destroys the component and cleans up resources
   * 
   * Used by: CardHandComponent.destroy()
   */
  destroy(): void {
    if (this.boundPointerMove) {
      this.scene.input.off('pointermove', this.boundPointerMove);
      this.boundPointerMove = undefined;
    }
    if (this.boundPointerUp) {
      this.scene.input.off('pointerup', this.boundPointerUp);
      this.boundPointerUp = undefined;
    }
    if (this.boundPointerUpOutside) {
      this.scene.input.off('pointerupoutside', this.boundPointerUpOutside);
      this.boundPointerUpOutside = undefined;
    }
    if (this.boundRightClick) {
      this.scene.input.off('pointerdown', this.boundRightClick);
      this.boundRightClick = undefined;
    }
    this.persistentArrowGraphics.destroy();
    this.arrowGraphics.destroy();
    this.playZoneGraphics.destroy();
  }
}
