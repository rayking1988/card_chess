/**
 * CardHand Component - Fan-shaped card display with interactions
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
 * - 9.1: Arrange cards in a fan shape at bottom of screen
 * - 9.2: Show enlarged preview on hover
 * - 9.3: Drag card to board area to play (non-targeted cards)
 * - 9.4: Drag arrow from card to target (targeted cards)
 * - 9.5: Resolve effect when arrow released on valid target
 * - 9.6: Cancel and return to normal when released on invalid target
 */

import Phaser from 'phaser';
import { Card as CardData } from '../managers/GameStateManager';
import { CardComponent, CARD_WIDTH, CARD_HEIGHT } from './Card';
import { CardTargetingComponent, TargetValidator, PlayZoneBounds } from './CardTargeting';
import { Square } from 'chess.js';

// Fan layout constants
const FAN_SPREAD_ANGLE = 30; // Degrees between cards
const MAX_FAN_ANGLE = 80; // Maximum total spread angle
const FAN_RADIUS = 1200; // Radius of the arc for fan arrangement
const CARD_SCALE = 0.8; // Normal card scale in hand
const HOVER_SCALE = 1.2; // Scale when hovering
const HOVER_LIFT = 50; // Pixels to lift card on hover
const PREVIEW_SCALE = 1.5; // Scale for preview card
const PREVIEW_MARGIN = 20; // Margin from screen edge for preview

/**
 * CardHandComponent - Manages a fan-shaped hand of cards
 */
export class CardHandComponent {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private cards: CardComponent[] = [];
  private cardData: CardData[] = [];
  
  // Position
  private centerX: number;
  private centerY: number;
  
  // Preview
  private previewCard: CardComponent | null = null;
  private previewX: number;
  private previewY: number;
  
  // Interaction state
  private hoveredCard: CardComponent | null = null;
  private isInteractive: boolean = false;
  private draggingCard: CardComponent | null = null;
  private handScale: number = 1;
  
  // Targeting component
  private targeting: CardTargetingComponent | null = null;
  
  // Event callbacks
  public onCardSelect?: (card: CardData) => void;
  public onCardDragStart?: (card: CardData) => void;
  public onCardDragEnd?: (card: CardData, pointer: Phaser.Input.Pointer) => void;
  public onCardHover?: (card: CardData | null) => void;
  public onCardPlayed?: (card: CardData) => void;
  public onCardTargeted?: (card: CardData, target: Square) => void;
  public onTargetingCancel?: (card: CardData) => void;

  constructor(
    scene: Phaser.Scene,
    centerX: number,
    centerY: number,
    previewX: number = PREVIEW_MARGIN + (CARD_WIDTH * PREVIEW_SCALE) / 2,
    previewY: number = 0
  ) {
    this.scene = scene;
    this.centerX = centerX;
    this.centerY = centerY;
    this.previewX = previewX;
    this.previewY = previewY || scene.scale.height - PREVIEW_MARGIN - (CARD_HEIGHT * PREVIEW_SCALE) / 2;
    
    this.container = scene.add.container(0, 0);
    
    // Initialize targeting component
    this.targeting = new CardTargetingComponent(scene);
    this.setupTargetingCallbacks();
  }

  /**
   * Setup targeting component callbacks
   */
  private setupTargetingCallbacks(): void {
    if (!this.targeting) return;
    
    // When a non-targeted card is played (dragged to play zone)
    // Requirement 9.3: Drag card to board area to play
    this.targeting.onCardPlayed = (card: CardData) => {
      // Clear dragging reference immediately
      const draggedCard = this.draggingCard;
      this.draggingCard = null;
      
      // Disable interaction on the dragged card to prevent further events
      if (draggedCard) {
        draggedCard.disableInteraction();
      }
      
      if (this.onCardPlayed) {
        this.onCardPlayed(card);
      }
    };
    
    // When a targeted card hits a valid target
    // Requirement 9.5: Resolve effect when arrow released on valid target
    this.targeting.onCardTargeted = (card: CardData, target: Square) => {
      // Clear dragging reference immediately
      const draggedCard = this.draggingCard;
      this.draggingCard = null;
      
      // Disable interaction on the dragged card to prevent further events
      if (draggedCard) {
        draggedCard.disableInteraction();
      }
      
      if (this.onCardTargeted) {
        this.onCardTargeted(card, target);
      }
    };
    
    // When targeting is cancelled (invalid target or released outside)
    // Requirement 9.6: Cancel and return to normal when released on invalid target
    this.targeting.onTargetingCancel = (card: CardData) => {
      if (this.onTargetingCancel) {
        this.onTargetingCancel(card);
      }
      // Reset the card to its original position
      this.resetDraggingCard();
    };
  }

  /**
   * Reset the dragging card to its original position
   */
  private resetDraggingCard(): void {
    if (this.draggingCard) {
      this.resetCardPosition(this.draggingCard);
      this.draggingCard = null;
    }
  }

  /**
   * Configure the play zone for non-targeted cards
   * Requirement 9.3: Drag card to board area to play
   */
  setPlayZone(bounds: PlayZoneBounds): void {
    if (this.targeting) {
      this.targeting.setPlayZone(bounds);
    }
  }

  /**
   * Configure the board bounds for targeted cards
   * Requirement 9.4: Drag arrow from card to target
   */
  setBoardBounds(x: number, y: number, width: number, height: number, squareSize: number, isFlipped: boolean = false): void {
    if (this.targeting) {
      this.targeting.setBoardBounds(x, y, width, height, squareSize, isFlipped);
    }
  }

  /**
   * Set target validation function
   * Requirement 9.5, 9.6: Validate targets
   */
  setTargetValidator(validator: TargetValidator): void {
    if (this.targeting) {
      this.targeting.setTargetValidator(validator);
    }
  }

  /**
   * Set the cards in hand
   */
  setCards(cards: CardData[]): void {
    this.cardData = [...cards];
    this.rebuildHand();
  }

  /**
   * Add a card to hand
   */
  addCard(card: CardData): void {
    this.cardData.push(card);
    this.rebuildHand();
  }

  /**
   * Remove a card from hand by ID
   */
  removeCard(cardId: string): CardData | null {
    const index = this.cardData.findIndex(c => c.id === cardId);
    if (index === -1) return null;
    
    const removed = this.cardData.splice(index, 1)[0];
    this.rebuildHand();
    return removed;
  }

  /**
   * Get all cards in hand
   */
  getCards(): CardData[] {
    return [...this.cardData];
  }

  /**
   * Get card count
   */
  getCardCount(): number {
    return this.cardData.length;
  }

  /**
   * Rebuild the hand display
   */
  private rebuildHand(): void {
    // Clear existing cards
    this.clearCards();
    
    if (this.cardData.length === 0) return;
    
    // Calculate fan positions
    const positions = this.calculateFanPositions(this.cardData.length);
    
    // Create card components
    for (let i = 0; i < this.cardData.length; i++) {
      const pos = positions[i];
      const cardComponent = new CardComponent(
        this.scene,
        pos.x,
        pos.y,
        this.cardData[i],
        false,
        CARD_SCALE * this.handScale
      );
      
      cardComponent.setRotation(pos.rotation);
      cardComponent.setDepth(i);
      
      // Store original position for hover reset
      (cardComponent as CardComponentWithOriginal).originalX = pos.x;
      (cardComponent as CardComponentWithOriginal).originalY = pos.y;
      (cardComponent as CardComponentWithOriginal).originalRotation = pos.rotation;
      (cardComponent as CardComponentWithOriginal).originalDepth = i;
      (cardComponent as CardComponentWithOriginal).originalScale = CARD_SCALE * this.handScale;
      
      this.cards.push(cardComponent);
      this.container.add(cardComponent.getContainer());
    }
    
    // Sort container children by depth so rightmost cards appear on top
    this.container.sort('depth');
    
    // Re-enable interaction if it was enabled
    if (this.isInteractive) {
      this.setupInteraction();
    }
  }

  /**
   * Calculate fan positions for cards
   */
  private calculateFanPositions(cardCount: number): Array<{ x: number; y: number; rotation: number }> {
    const positions: Array<{ x: number; y: number; rotation: number }> = [];
    
    if (cardCount === 0) return positions;
    
    if (cardCount === 1) {
      // Single card centered
      positions.push({
        x: this.centerX,
        y: this.centerY,
        rotation: 0
      });
      return positions;
    }
    
    // Calculate total spread angle (capped at MAX_FAN_ANGLE)
    const totalAngle = Math.min((cardCount - 1) * FAN_SPREAD_ANGLE, MAX_FAN_ANGLE);
    const startAngle = -totalAngle / 2;
    const angleStep = cardCount > 1 ? totalAngle / (cardCount - 1) : 0;
    
    for (let i = 0; i < cardCount; i++) {
      const angle = startAngle + (i * angleStep);
      const radians = (angle * Math.PI) / 180;
      
      // Calculate position on arc
      const x = this.centerX + Math.sin(radians) * FAN_RADIUS * 0.3;
      const y = this.centerY - Math.cos(radians) * FAN_RADIUS * 0.1 + Math.abs(angle) * 0.5;
      
      positions.push({
        x,
        y,
        rotation: radians * 0.5 // Slight rotation for fan effect
      });
    }
    
    return positions;
  }

  /**
   * Clear all card components
   */
  private clearCards(): void {
    for (const card of this.cards) {
      card.destroy();
    }
    this.cards = [];
    this.hoveredCard = null;
  }

  /**
   * Enable card interaction
   */
  enableInteraction(): void {
    this.isInteractive = true;
    this.setupInteraction();
  }

  /**
   * Disable card interaction
   */
  disableInteraction(): void {
    this.isInteractive = false;
    for (const card of this.cards) {
      card.disableInteraction();
    }
  }

  /**
   * Setup interaction handlers for all cards
   */
  private setupInteraction(): void {
    for (let i = 0; i < this.cards.length; i++) {
      const card = this.cards[i];
      const cardData = this.cardData[i];
      
      // Enable interaction with external drag handler (targeting system handles position)
      card.enableInteraction(true);
      
      // Hover handlers
      card.onHover = () => this.handleCardHover(card, cardData);
      card.onHoverEnd = () => this.handleCardHoverEnd(card);
      
      // Drag handlers
      card.onDragStart = () => this.handleCardDragStart(card, cardData);
      card.onDragMove = (_, pointer) => this.handleCardDrag(pointer);
      card.onDragEnd = (_, pointer) => this.handleCardDragEnd(card, cardData, pointer);
      
      // Click handler
      card.onClick = () => {
        if (this.onCardSelect) {
          this.onCardSelect(cardData);
        }
      };
    }
  }

  /**
   * Handle card hover
   * Requirement 9.2: Show enlarged preview on hover
   */
  private handleCardHover(card: CardComponent, cardData: CardData): void {
    if (this.hoveredCard === card) return;
    
    // Reset previous hovered card
    if (this.hoveredCard) {
      this.resetCardPosition(this.hoveredCard);
    }
    
    this.hoveredCard = card;
    
    // Lift and scale the hovered card
    const original = card as CardComponentWithOriginal;
    card.setScale(original.originalScale * HOVER_SCALE);
    card.setPosition(original.originalX, original.originalY - HOVER_LIFT);
    card.setRotation(0); // Straighten on hover
    card.setDepth(100); // Bring to front
    
    // Show preview
    this.showPreview(cardData);
    
    // Notify callback
    if (this.onCardHover) {
      this.onCardHover(cardData);
    }
  }

  /**
   * Handle card hover end
   */
  private handleCardHoverEnd(card: CardComponent): void {
    if (this.hoveredCard !== card) return;
    
    this.resetCardPosition(card);
    this.hoveredCard = null;
    
    // Hide preview
    this.hidePreview();
    
    // Notify callback
    if (this.onCardHover) {
      this.onCardHover(null);
    }
  }

  /**
   * Reset card to original position
   */
  private resetCardPosition(card: CardComponent): void {
    const original = card as CardComponentWithOriginal;
    card.setScale(original.originalScale);
    card.setPosition(original.originalX, original.originalY);
    card.setRotation(original.originalRotation);
    card.setDepth(original.originalDepth);
  }

  /**
   * Handle card drag start
   * Requirements 9.3, 9.4: Start drag-to-play or arrow targeting
   */
  private handleCardDragStart(card: CardComponent, cardData: CardData): void {
    this.draggingCard = card;
    card.setDepth(200); // Bring to very front while dragging
    const original = card as CardComponentWithOriginal;
    card.setScale(original.originalScale * HOVER_SCALE);
    card.setRotation(0);
    
    // Hide preview while dragging
    this.hidePreview();
    
    // Start targeting mode
    const pos = card.getPosition();
    if (this.targeting) {
      this.targeting.startTargeting(cardData, card, pos.x, pos.y);
    }
    
    if (this.onCardDragStart) {
      this.onCardDragStart(cardData);
    }
  }

  /**
   * Handle card drag (pointer move while dragging)
   */
  private handleCardDrag(pointer: Phaser.Input.Pointer): void {
    if (!this.draggingCard || !this.targeting) return;
    
    // Update targeting position - this handles both arrow drawing and card movement
    this.targeting.updateTargeting(pointer.x, pointer.y);
  }

  /**
   * Handle card drag end
   * Requirements 9.5, 9.6: Resolve or cancel based on target validity
   */
  private handleCardDragEnd(card: CardComponent, cardData: CardData, pointer: Phaser.Input.Pointer): void {
    // The targeting component handles the actual resolution
    // It will call the appropriate callback (onCardPlayed, onCardTargeted, or onTargetingCancel)
    if (this.targeting && this.targeting.isActive()) {
      this.targeting.endTargeting(pointer.x, pointer.y);
    } else {
      // Fallback: reset card position if targeting wasn't active
      this.resetCardPosition(card);
      this.draggingCard = null;
    }
    
    if (this.onCardDragEnd) {
      this.onCardDragEnd(cardData, pointer);
    }
  }

  /**
   * Show preview card
   * Requirement 9.2: Show enlarged preview on bottom-left
   */
  private showPreview(cardData: CardData): void {
    this.hidePreview();
    
    this.previewCard = new CardComponent(
      this.scene,
      this.previewX,
      this.previewY,
      cardData,
      false,
      PREVIEW_SCALE
    );
    
    this.previewCard.setDepth(1000);
  }

  /**
   * Hide preview card
   */
  private hidePreview(): void {
    if (this.previewCard) {
      this.previewCard.destroy();
      this.previewCard = null;
    }
  }

  /**
   * Get card component by card ID
   */
  getCardComponent(cardId: string): CardComponent | null {
    const index = this.cardData.findIndex(c => c.id === cardId);
    if (index === -1) return null;
    return this.cards[index] || null;
  }

  /**
   * Set position of the hand center
   */
  setPosition(x: number, y: number): void {
    this.centerX = x;
    this.centerY = y;
    this.rebuildHand();
  }

  /**
   * Set preview position
   */
  setPreviewPosition(x: number, y: number): void {
    this.previewX = x;
    this.previewY = y;
    if (this.previewCard) {
      this.previewCard.setPosition(x, y);
    }
  }

  /**
   * Set the scale for cards in hand (container stays at scale 1)
   */
  setHandScale(scale: number): void {
    this.handScale = scale;
    this.rebuildHand();
  }

  /**
   * Set visibility
   */
  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
    if (!visible) {
      this.hidePreview();
    }
  }

  /**
   * Set depth
   */
  setDepth(depth: number): void {
    this.container.setDepth(depth);
  }

  /**
   * Set scale
   */
  setScale(scale: number): void {
    this.container.setScale(scale);
  }

  /**
   * Get the container
   */
  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  /**
   * Check if currently in targeting mode
   */
  isTargeting(): boolean {
    return this.targeting?.isActive() ?? false;
  }

  /**
   * Get the targeting component for direct access
   */
  getTargeting(): CardTargetingComponent | null {
    return this.targeting;
  }

  /**
   * Destroy the component
   */
  destroy(): void {
    this.clearCards();
    this.hidePreview();
    if (this.targeting) {
      this.targeting.destroy();
      this.targeting = null;
    }
    this.container.destroy();
  }
}

/**
 * Extended CardComponent interface with original position tracking
 */
interface CardComponentWithOriginal extends CardComponent {
  originalX: number;
  originalY: number;
  originalRotation: number;
  originalDepth: number;
  originalScale: number;
}

// Re-export targeting types for convenience
export type { TargetValidator, PlayZoneBounds } from './CardTargeting';
