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

/* ============================================
 * TARGETING VISUAL CONSTANTS
 * ============================================
 */

/** Color for the targeting arrow (yellow) */
const ARROW_COLOR = 0xffcc00;

/** Width of the arrow line in pixels */
const ARROW_WIDTH = 4;

/** Size of the arrow head in pixels */
const ARROW_HEAD_SIZE = 15;

/** Color for valid target highlights (green) */
const VALID_TARGET_COLOR = 0x00ff00;

/** Color for invalid target highlights (red) */
const INVALID_TARGET_COLOR = 0xff0000;

/** Alpha for play zone highlight */
const PLAY_ZONE_ALPHA = 0.3;

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
  
  /** Last coordinates used to render targeting (avoid duplicate redraws) */
  private lastUpdateX: number | null = null;
  private lastUpdateY: number | null = null;
  
  /** Cached play zone hit state to avoid redundant redraws */
  private lastPlayZoneInBounds: boolean | null = null;
  
  /* ============================================
   * CONFIGURATION PROPERTIES
   * ============================================
   */
  
  /** Play zone bounds for non-targeted cards */
  private playZone: PlayZoneBounds | null = null;
  
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
  
  /* ============================================
   * EVENT CALLBACKS
   * ============================================
   */
  
  /** Called when a non-targeted card is played (Req 9.3) */
  public onCardPlayed?: (card: CardData) => void;
  
  /** Called when a targeted card hits a valid target (Req 9.5) */
  public onCardTargeted?: (card: CardData, target: Square) => void;
  
  /** Called when targeting starts */
  public onTargetingStart?: (card: CardData) => void;
  
  /** Called when targeting is cancelled (Req 9.6) */
  public onTargetingCancel?: (card: CardData) => void;
  
  /** Bound input handlers for cleanup */
  private boundPointerMove?: (pointer: Phaser.Input.Pointer) => void;
  private boundPointerUp?: (pointer: Phaser.Input.Pointer) => void;

  /**
   * Creates a new CardTargetingComponent
   * 
   * Algorithm:
   * 1. Create arrow graphics layer (depth 500)
   * 2. Create play zone graphics layer (depth 499)
   * 3. Setup input handlers for pointer events
   * 
   * @param scene - The Phaser scene
   * 
   * Used by: CardHandComponent constructor
   */
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    
    // Create graphics layers
    this.arrowGraphics = scene.add.graphics();
    this.arrowGraphics.setDepth(500);
    
    this.playZoneGraphics = scene.add.graphics();
    this.playZoneGraphics.setDepth(499);
    
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

  /* ============================================
   * TARGETING LIFECYCLE METHODS
   * ============================================
   */

  /**
   * Starts targeting mode for a card
   * 
   * Algorithm:
   * 1. Store card and position references
   * 2. Check if card requires a target
   * 3. If targeted: Enable arrow mode, notify start
   * 4. If non-targeted: Enable drag mode, show play zone
   * 
   * @param card - The card being played
   * @param cardComponent - The card's visual component
   * @param startX - Starting X position
   * @param startY - Starting Y position
   * 
   * Used by: CardHandComponent.handleCardDragStart()
   */
  startTargeting(
    card: CardData,
    cardComponent: CardComponent,
    startX: number,
    startY: number
  ): void {
    this.activeCard = card;
    this.activeCardComponent = cardComponent;
    this.startX = startX;
    this.startY = startY;
    this.currentX = startX;
    this.currentY = startY;
    this.lastUpdateX = null;
    this.lastUpdateY = null;
    this.lastPlayZoneInBounds = null;
    
    const requiresTarget = cardRequiresTarget(card);
    
    if (requiresTarget) {
      // Arrow targeting mode - card stays in place, arrow follows cursor
      // Requirement 9.4: Drag arrow from card to target
      this.isTargeting = true;
      this.isDragging = false;
      if (this.onTargetingStart) {
        this.onTargetingStart(card);
      }
    } else {
      // Drag-to-play mode - card follows cursor
      // Requirement 9.3: Drag card to board area to play
      this.isTargeting = false;
      this.isDragging = true;
      this.showPlayZone();
    }
  }

  /**
   * Updates targeting position (called on pointer move)
   * 
   * Algorithm:
   * - If arrow targeting: Draw arrow from start to cursor
   * - If drag-to-play: Move card to cursor, update play zone highlight
   * 
   * @param x - Current pointer X
   * @param y - Current pointer Y
   * 
   * Used by: CardHandComponent.handleCardDrag()
   */
  updateTargeting(x: number, y: number): void {
    if (!this.activeCard) return;
    
    if (this.lastUpdateX === x && this.lastUpdateY === y) {
      return;
    }
    
    this.lastUpdateX = x;
    this.lastUpdateY = y;
    this.currentX = x;
    this.currentY = y;
    
    if (this.isTargeting) {
      // Arrow targeting - draw arrow from card to cursor
      this.drawTargetingArrow();
    } else if (this.isDragging && this.activeCardComponent) {
      // Drag-to-play - move card with cursor
      this.activeCardComponent.setPosition(x, y);
      
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
  endTargeting(x: number, y: number): void {
    if (!this.activeCard) return;
    
    const card = this.activeCard;
    
    if (this.isTargeting) {
      // Arrow targeting - check if we hit a valid target
      const target = this.getTargetSquare(x, y);
      
      if (target && this.isValidTarget(target, card)) {
        // Requirement 9.5: Valid target - resolve effect
        if (this.onCardTargeted) {
          this.onCardTargeted(card, target);
        }
      } else {
        // Requirement 9.6: Invalid target - cancel
        if (this.onTargetingCancel) {
          this.onTargetingCancel(card);
        }
      }
    } else if (this.isDragging) {
      // Drag-to-play - check if we're in the play zone
      if (this.isInPlayZone(x, y)) {
        // Requirement 9.5: In play zone - play the card
        if (this.onCardPlayed) {
          this.onCardPlayed(card);
        }
      } else {
        // Requirement 9.6: Outside play zone - cancel
        if (this.onTargetingCancel) {
          this.onTargetingCancel(card);
        }
      }
    }
    
    this.cancelTargeting();
  }

  /**
   * Cancels current targeting and cleans up
   * 
   * Used by: endTargeting(), external cancellation
   */
  cancelTargeting(): void {
    this.isTargeting = false;
    this.isDragging = false;
    this.activeCard = null;
    this.activeCardComponent = null;
    this.lastUpdateX = null;
    this.lastUpdateY = null;
    this.lastPlayZoneInBounds = null;
    
    this.arrowGraphics.clear();
    this.hidePlayZone();
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
   * 
   * @private
   */
  private setupInputHandlers(): void {
    this.boundPointerMove = (pointer: Phaser.Input.Pointer) => {
      if (this.isActive()) {
        this.updateTargeting(pointer.x, pointer.y);
      }
    };
    
    this.boundPointerUp = (pointer: Phaser.Input.Pointer) => {
      if (this.isActive()) {
        this.endTargeting(pointer.x, pointer.y);
      }
    };
    
    this.scene.input.on('pointermove', this.boundPointerMove);
    this.scene.input.on('pointerup', this.boundPointerUp);
  }

  /* ============================================
   * PRIVATE RENDERING METHODS
   * ============================================
   */

  /**
   * Draws the targeting arrow from card to cursor
   * 
   * Algorithm:
   * 1. Clear previous arrow
   * 2. Determine if target is valid (affects color)
   * 3. Draw line from start to current position
   * 4. Draw arrow head at current position
   * 5. Highlight target square if over board
   * 
   * @private
   */
  private drawTargetingArrow(): void {
    this.arrowGraphics.clear();
    
    // Determine arrow color based on target validity
    const target = this.getTargetSquare(this.currentX, this.currentY);
    const isValid = target && this.activeCard && this.isValidTarget(target, this.activeCard);
    const color = isValid ? VALID_TARGET_COLOR : ARROW_COLOR;
    
    // Draw line from card to cursor
    this.arrowGraphics.lineStyle(ARROW_WIDTH, color, 1);
    this.arrowGraphics.beginPath();
    this.arrowGraphics.moveTo(this.startX, this.startY);
    this.arrowGraphics.lineTo(this.currentX, this.currentY);
    this.arrowGraphics.strokePath();
    
    // Draw arrow head
    const angle = Math.atan2(this.currentY - this.startY, this.currentX - this.startX);
    const headX1 = this.currentX - ARROW_HEAD_SIZE * Math.cos(angle - Math.PI / 6);
    const headY1 = this.currentY - ARROW_HEAD_SIZE * Math.sin(angle - Math.PI / 6);
    const headX2 = this.currentX - ARROW_HEAD_SIZE * Math.cos(angle + Math.PI / 6);
    const headY2 = this.currentY - ARROW_HEAD_SIZE * Math.sin(angle + Math.PI / 6);
    
    this.arrowGraphics.fillStyle(color, 1);
    this.arrowGraphics.beginPath();
    this.arrowGraphics.moveTo(this.currentX, this.currentY);
    this.arrowGraphics.lineTo(headX1, headY1);
    this.arrowGraphics.lineTo(headX2, headY2);
    this.arrowGraphics.closePath();
    this.arrowGraphics.fillPath();
    
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
    if (!this.playZone) return false;
    
    return x >= this.playZone.x &&
           x <= this.playZone.x + this.playZone.width &&
           y >= this.playZone.y &&
           y <= this.playZone.y + this.playZone.height;
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
    this.arrowGraphics.destroy();
    this.playZoneGraphics.destroy();
  }
}
