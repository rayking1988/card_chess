/**
 * CardTargeting Component - Handles card drag-to-play and arrow targeting
 * 
 * Requirements: 9.3, 9.4, 9.5, 9.6
 * - 9.3: Drag card to board area to play (non-targeted cards)
 * - 9.4: Drag arrow from card to target (targeted cards)
 * - 9.5: Resolve effect when arrow released on valid target
 * - 9.6: Cancel and return to normal when released on invalid target
 */

import Phaser from 'phaser';
import { Card as CardData } from '../managers/GameStateManager';
import { CardComponent } from './Card';
import { cardRequiresTarget } from '../data/cards';
import { Square } from 'chess.js';

// Targeting constants
const ARROW_COLOR = 0xffcc00;
const ARROW_WIDTH = 4;
const ARROW_HEAD_SIZE = 15;
const VALID_TARGET_COLOR = 0x00ff00;
const INVALID_TARGET_COLOR = 0xff0000;
const PLAY_ZONE_ALPHA = 0.3;

/**
 * Target validation function type
 */
export type TargetValidator = (square: Square, card: CardData) => boolean;

/**
 * Play zone bounds
 */
export interface PlayZoneBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * CardTargetingComponent - Manages card targeting interactions
 */
export class CardTargetingComponent {
  private scene: Phaser.Scene;
  private arrowGraphics: Phaser.GameObjects.Graphics;
  private playZoneGraphics: Phaser.GameObjects.Graphics;
  
  // State
  private isTargeting: boolean = false;
  private isDragging: boolean = false;
  private activeCard: CardData | null = null;
  private activeCardComponent: CardComponent | null = null;
  private startX: number = 0;
  private startY: number = 0;
  private currentX: number = 0;
  private currentY: number = 0;
  
  // Configuration
  private playZone: PlayZoneBounds | null = null;
  private boardBounds: PlayZoneBounds | null = null;
  private targetValidator: TargetValidator | null = null;
  private squareSize: number = 64;
  private boardX: number = 0;
  private boardY: number = 0;
  private isFlipped: boolean = false;
  
  // Callbacks
  public onCardPlayed?: (card: CardData) => void;
  public onCardTargeted?: (card: CardData, target: Square) => void;
  public onTargetingStart?: (card: CardData) => void;
  public onTargetingCancel?: (card: CardData) => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    
    this.arrowGraphics = scene.add.graphics();
    this.arrowGraphics.setDepth(500);
    
    this.playZoneGraphics = scene.add.graphics();
    this.playZoneGraphics.setDepth(499);
    
    this.setupInputHandlers();
  }

  /**
   * Configure the play zone (area where non-targeted cards can be dropped)
   */
  setPlayZone(bounds: PlayZoneBounds): void {
    this.playZone = bounds;
  }

  /**
   * Configure the board bounds for targeting
   */
  setBoardBounds(x: number, y: number, width: number, height: number, squareSize: number, isFlipped: boolean = false): void {
    this.boardBounds = { x, y, width, height };
    this.squareSize = squareSize;
    this.boardX = x;
    this.boardY = y;
    this.isFlipped = isFlipped;
  }

  /**
   * Set target validation function
   */
  setTargetValidator(validator: TargetValidator): void {
    this.targetValidator = validator;
  }

  /**
   * Start targeting mode for a card
   */
  startTargeting(card: CardData, cardComponent: CardComponent, startX: number, startY: number): void {
    this.activeCard = card;
    this.activeCardComponent = cardComponent;
    this.startX = startX;
    this.startY = startY;
    this.currentX = startX;
    this.currentY = startY;
    
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
   * Update targeting position (called on pointer move)
   */
  updateTargeting(x: number, y: number): void {
    if (!this.activeCard) return;
    
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
   * Update play zone highlight based on cursor position
   */
  private updatePlayZoneHighlight(x: number, y: number): void {
    if (!this.playZone) return;
    
    const isInZone = this.isInPlayZone(x, y);
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

  /**
   * End targeting (called on pointer up)
   * Requirement 9.5: Resolve effect when arrow released on valid target
   * Requirement 9.6: Cancel and return to normal when released on invalid target
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
   * Cancel current targeting
   */
  cancelTargeting(): void {
    this.isTargeting = false;
    this.isDragging = false;
    this.activeCard = null;
    this.activeCardComponent = null;
    
    this.arrowGraphics.clear();
    this.hidePlayZone();
  }

  /**
   * Check if currently targeting
   */
  isActive(): boolean {
    return this.isTargeting || this.isDragging;
  }

  /**
   * Check if in arrow targeting mode (vs drag-to-play)
   */
  isArrowTargeting(): boolean {
    return this.isTargeting;
  }

  /**
   * Check if in drag-to-play mode
   */
  isDragToPlay(): boolean {
    return this.isDragging;
  }

  /**
   * Get the active card
   */
  getActiveCard(): CardData | null {
    return this.activeCard;
  }

  /**
   * Get the active card component
   */
  getActiveCardComponent(): CardComponent | null {
    return this.activeCardComponent;
  }

  /**
   * Setup input handlers
   */
  private setupInputHandlers(): void {
    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isActive()) {
        this.updateTargeting(pointer.x, pointer.y);
      }
    });
    
    this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.isActive()) {
        this.endTargeting(pointer.x, pointer.y);
      }
    });
  }

  /**
   * Draw targeting arrow from card to cursor
   */
  private drawTargetingArrow(): void {
    this.arrowGraphics.clear();
    
    const target = this.getTargetSquare(this.currentX, this.currentY);
    const isValid = target && this.activeCard && this.isValidTarget(target, this.activeCard);
    const color = isValid ? VALID_TARGET_COLOR : ARROW_COLOR;
    
    // Draw line
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
    
    // Highlight target square if valid
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
   * Show play zone highlight
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
   * Hide play zone highlight
   */
  private hidePlayZone(): void {
    this.playZoneGraphics.clear();
  }

  /**
   * Check if point is in play zone
   */
  private isInPlayZone(x: number, y: number): boolean {
    if (!this.playZone) return false;
    
    return x >= this.playZone.x &&
           x <= this.playZone.x + this.playZone.width &&
           y >= this.playZone.y &&
           y <= this.playZone.y + this.playZone.height;
  }

  /**
   * Get target square from screen coordinates
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
   * Convert board coordinates to square notation
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
   * Convert square notation to board coordinates
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
   * Check if target is valid for the card
   */
  private isValidTarget(target: Square, card: CardData): boolean {
    if (this.targetValidator) {
      return this.targetValidator(target, card);
    }
    // Default: all squares are valid
    return true;
  }

  /**
   * Set depth
   */
  setDepth(depth: number): void {
    this.arrowGraphics.setDepth(depth);
    this.playZoneGraphics.setDepth(depth - 1);
  }

  /**
   * Destroy the component
   */
  destroy(): void {
    this.arrowGraphics.destroy();
    this.playZoneGraphics.destroy();
  }
}
