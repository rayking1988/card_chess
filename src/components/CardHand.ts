/**
 * @fileoverview CardHand Component - Fan-shaped card display with interactions
 * 
 * This component manages a player's hand of cards displayed in a fan shape.
 * It handles card arrangement, hover previews, drag-to-play mechanics,
 * and arrow-based targeting for targeted cards.
 * 
 * Requirements addressed:
 * - 9.1: Arrange cards in a fan shape at bottom of screen
 * - 9.2: Show enlarged preview on hover
 * - 9.3: Drag card to board area to play (non-targeted cards)
 * - 9.4: Drag arrow from card to target (targeted cards)
 * - 9.5: Resolve effect when arrow released on valid target
 * - 9.6: Cancel and return to normal when released on invalid target
 * 
 * @module components/CardHand
 * @requires phaser
 * @requires ../managers/GameStateManager
 * @requires ./Card
 * @requires ./CardTargeting
 */

import Phaser from 'phaser';
import { Card as CardData } from '../managers/GameStateManager';
import { CardComponent, CARD_WIDTH, CARD_HEIGHT } from './Card';
import { CardTargetingComponent, TargetValidator, PlayZoneBounds } from './CardTargeting';
import { Square } from 'chess.js';

/* ============================================
 * FAN LAYOUT CONFIGURATION
 * ============================================
 * These constants control the visual arrangement
 * of cards in the fan-shaped hand display.
 */

/** Degrees between adjacent cards in the fan */
const FAN_SPREAD_ANGLE = 30;

/** Maximum total spread angle for the entire fan */
const MAX_FAN_ANGLE = 80;

/** Radius of the arc for fan arrangement (affects curvature) */
const FAN_RADIUS = 1200;

/** Normal card scale when displayed in hand */
const CARD_SCALE = 0.8;

/** Scale multiplier when hovering over a card */
const HOVER_SCALE = 1.2;

/** Pixels to lift card vertically on hover */
const HOVER_LIFT = 50;

/** Scale for the preview card shown on hover */
const PREVIEW_SCALE = 1.5;

/** Margin from screen edge for preview card position */
const PREVIEW_MARGIN = 20;

/* ============================================
 * TYPE DEFINITIONS
 * ============================================
 */

/**
 * Extended CardComponent interface with original position tracking
 * 
 * Used internally to store each card's original fan position
 * so it can be restored after hover or drag interactions.
 * 
 * @property originalX - Original X position in fan
 * @property originalY - Original Y position in fan
 * @property originalRotation - Original rotation angle
 * @property originalDepth - Original z-depth
 * @property originalScale - Original scale factor
 */
interface CardComponentWithOriginal extends CardComponent {
  originalX: number;
  originalY: number;
  originalRotation: number;
  originalDepth: number;
  originalScale: number;
}

/* ============================================
 * CARD HAND COMPONENT CLASS
 * ============================================
 */

/**
 * CardHandComponent - Manages a fan-shaped hand of cards
 * 
 * Displays cards in an arc formation and handles all card interactions:
 * - Hover: Lifts card and shows enlarged preview
 * - Drag: Moves card or draws targeting arrow
 * - Play: Validates and triggers card play callbacks
 * 
 * Visual structure:
 * - Main container at hand center position
 * - Individual CardComponents arranged in fan
 * - Preview CardComponent (shown on hover)
 * - CardTargetingComponent for drag/arrow mechanics
 * 
 * @example
 * const hand = new CardHandComponent(scene, 400, 550, 100, 500);
 * hand.setCards(playerCards);
 * hand.enableInteraction();
 * 
 * hand.onCardPlayed = (card) => {
 *   console.log('Card played:', card.name);
 * };
 * 
 * Used by: GameScene (creates player hand)
 */
export class CardHandComponent {
  /** Reference to the Phaser scene */
  private scene: Phaser.Scene;
  
  /** Container holding all card components */
  private container: Phaser.GameObjects.Container;
  
  /** Array of CardComponent instances */
  private cards: CardComponent[] = [];
  
  /** Array of card data objects */
  private cardData: CardData[] = [];
  
  /** X coordinate of hand center */
  private centerX: number;
  
  /** Y coordinate of hand center */
  private centerY: number;
  
  /** Preview card component (shown on hover) */
  private previewCard: CardComponent | null = null;
  
  /** X position for preview card */
  private previewX: number;
  
  /** Y position for preview card */
  private previewY: number;
  
  /** Currently hovered card component */
  private hoveredCard: CardComponent | null = null;
  
  /** Whether card interaction is enabled */
  private isInteractive: boolean = false;
  
  /** Currently dragged card component */
  private draggingCard: CardComponent | null = null;
  
  /** Scale factor for cards in hand */
  private handScale: number = 1;
  
  /** Targeting component for drag/arrow mechanics */
  private targeting: CardTargetingComponent | null = null;
  
  /* ============================================
   * EVENT CALLBACKS
   * ============================================
   * These callbacks are invoked by the component
   * to notify the parent of card interactions.
   */
  
  /** Called when a card is clicked/selected */
  public onCardSelect?: (card: CardData) => void;
  
  /** Called when card drag starts */
  public onCardDragStart?: (card: CardData) => void;
  
  /** Called when card drag ends */
  public onCardDragEnd?: (card: CardData, pointer: Phaser.Input.Pointer) => void;
  
  /** Called when card hover state changes */
  public onCardHover?: (card: CardData | null) => void;
  
  /** Called when a non-targeted card is played (Req 9.3) */
  public onCardPlayed?: (card: CardData) => void;
  
  /** Called when a targeted card hits a valid target (Req 9.5) */
  public onCardTargeted?: (card: CardData, target: Square) => void;
  
  /** Called when targeting is cancelled (Req 9.6) */
  public onTargetingCancel?: (card: CardData) => void;

  /**
   * Creates a new CardHandComponent
   * 
   * Algorithm:
   * 1. Store position and scene references
   * 2. Create main container
   * 3. Initialize targeting component
   * 4. Setup targeting callbacks
   * 
   * @param scene - The Phaser scene
   * @param centerX - X coordinate for hand center
   * @param centerY - Y coordinate for hand center
   * @param previewX - X position for preview card (default: left edge)
   * @param previewY - Y position for preview card (default: bottom)
   * 
   * Used by: GameScene.createPlayerHand()
   */
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

  /* ============================================
   * TARGETING SETUP
   * ============================================
   */

  /**
   * Sets up callbacks from the targeting component
   * 
   * Connects targeting events to hand callbacks:
   * - Card played (non-targeted) → onCardPlayed
   * - Card targeted (arrow hit) → onCardTargeted
   * - Targeting cancelled → onTargetingCancel
   * 
   * @private
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
   * Resets the dragging card to its original fan position
   * 
   * @private
   */
  private resetDraggingCard(): void {
    if (this.draggingCard) {
      this.resetCardPosition(this.draggingCard);
      this.draggingCard = null;
    }
  }

  /* ============================================
   * TARGETING CONFIGURATION
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
   * Used by: GameScene.updateLayout()
   */
  setPlayZone(bounds: PlayZoneBounds): void {
    if (this.targeting) {
      this.targeting.setPlayZone(bounds);
    }
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
   * Used by: GameScene.updateLayout()
   */
  setBoardBounds(
    x: number,
    y: number,
    width: number,
    height: number,
    squareSize: number,
    isFlipped: boolean = false
  ): void {
    if (this.targeting) {
      this.targeting.setBoardBounds(x, y, width, height, squareSize, isFlipped);
    }
  }

  /**
   * Sets the target validation function
   * 
   * The validator determines which squares are valid targets
   * for a given card.
   * 
   * @param validator - Function that validates targets
   * 
   * Used by: GameScene (sets game-specific validation)
   */
  setTargetValidator(validator: TargetValidator): void {
    if (this.targeting) {
      this.targeting.setTargetValidator(validator);
    }
  }

  /* ============================================
   * CARD MANAGEMENT
   * ============================================
   */

  /**
   * Checks if two card arrays are equal (same cards in same order)
   * 
   * @param a - First card array
   * @param b - Second card array
   * @returns True if arrays contain the same cards in the same order
   * @private
   */
  private cardsEqual(a: CardData[], b: CardData[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i].id !== b[i].id) return false;
    }
    return true;
  }

  /**
   * Sets the cards in hand
   * 
   * Replaces all current cards with the provided array.
   * Optimized to skip rebuild if cards haven't changed.
   * 
   * @param cards - Array of card data to display
   * 
   * Used by: GameScene (when hand changes)
   */
  setCards(cards: CardData[]): void {
    // Skip rebuild if cards haven't changed (performance optimization)
    if (this.cardsEqual(this.cardData, cards)) {
      return;
    }
    
    this.cardData = [...cards];
    this.rebuildHand();
  }

  /**
   * Adds a card to the hand
   * 
   * @param card - Card data to add
   * 
   * Used by: GameScene (when drawing cards)
   */
  addCard(card: CardData): void {
    this.cardData.push(card);
    this.rebuildHand();
  }

  /**
   * Removes a card from hand by ID
   * 
   * @param cardId - ID of card to remove
   * @returns The removed card data, or null if not found
   * 
   * Used by: GameScene (when playing cards)
   */
  removeCard(cardId: string): CardData | null {
    const index = this.cardData.findIndex(c => c.id === cardId);
    if (index === -1) return null;
    
    const removed = this.cardData.splice(index, 1)[0];
    this.rebuildHand();
    return removed;
  }

  /**
   * Gets all cards in hand
   * 
   * @returns Copy of card data array
   */
  getCards(): CardData[] {
    return [...this.cardData];
  }

  /**
   * Gets the number of cards in hand
   * 
   * @returns Card count
   */
  getCardCount(): number {
    return this.cardData.length;
  }

  /* ============================================
   * HAND RENDERING
   * ============================================
   */

  /**
   * Rebuilds the entire hand display
   * 
   * Algorithm:
   * 1. Clear existing card components
   * 2. Calculate fan positions for all cards
   * 3. Create CardComponent for each card
   * 4. Store original positions for hover reset
   * 5. Sort by depth for proper layering
   * 6. Re-enable interaction if needed
   * 
   * @private
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
   * Calculates fan positions for cards
   * 
   * Algorithm:
   * 1. Single card: center position, no rotation
   * 2. Multiple cards:
   *    a. Calculate total spread (capped at MAX_FAN_ANGLE)
   *    b. Distribute cards evenly across spread
   *    c. Position on arc using sin/cos
   *    d. Apply slight rotation for fan effect
   * 
   * @param cardCount - Number of cards to position
   * @returns Array of position objects with x, y, rotation
   * @private
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
      // X: horizontal spread using sine
      // Y: vertical arc using cosine (cards at edges are slightly higher)
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
   * Clears all card components
   * 
   * @private
   */
  private clearCards(): void {
    for (const card of this.cards) {
      card.destroy();
    }
    this.cards = [];
    this.hoveredCard = null;
  }

  /* ============================================
   * INTERACTION MANAGEMENT
   * ============================================
   */

  /**
   * Enables card interaction (hover, drag, click)
   * 
   * Used by: GameScene (when it's player's turn)
   */
  enableInteraction(): void {
    this.isInteractive = true;
    this.setupInteraction();
  }

  /**
   * Disables card interaction
   * 
   * Used by: GameScene (when it's opponent's turn)
   */
  disableInteraction(): void {
    this.isInteractive = false;
    for (const card of this.cards) {
      card.disableInteraction();
    }
  }

  /**
   * Sets up interaction handlers for all cards
   * 
   * Connects each card's events to the hand's handlers:
   * - Hover → handleCardHover/handleCardHoverEnd
   * - Drag → handleCardDragStart/handleCardDrag/handleCardDragEnd
   * - Click → onCardSelect callback
   * 
   * @private
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

  /* ============================================
   * HOVER HANDLING
   * ============================================
   */

  /**
   * Handles card hover start
   * 
   * Algorithm:
   * 1. Reset previous hovered card
   * 2. Lift and scale the hovered card
   * 3. Straighten rotation
   * 4. Bring to front (depth 100)
   * 5. Show preview card
   * 6. Notify callback
   * 
   * @param card - The hovered card component
   * @param cardData - The card's data
   * @private
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
   * Handles card hover end
   * 
   * @param card - The card that was hovered
   * @private
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
   * Resets a card to its original fan position
   * 
   * @param card - The card to reset
   * @private
   */
  private resetCardPosition(card: CardComponent): void {
    const original = card as CardComponentWithOriginal;
    card.setScale(original.originalScale);
    card.setPosition(original.originalX, original.originalY);
    card.setRotation(original.originalRotation);
    card.setDepth(original.originalDepth);
  }

  /* ============================================
   * DRAG HANDLING
   * ============================================
   */

  /**
   * Handles card drag start
   * 
   * Algorithm:
   * 1. Store reference to dragging card
   * 2. Bring card to front (depth 200)
   * 3. Scale up and straighten
   * 4. Hide preview
   * 5. Start targeting mode
   * 6. Notify callback
   * 
   * @param card - The dragged card component
   * @param cardData - The card's data
   * @private
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
   * Handles card drag movement
   * 
   * Updates the targeting component with current pointer position.
   * The targeting component handles both arrow drawing and card movement.
   * 
   * @param pointer - Current pointer position
   * @private
   */
  private handleCardDrag(pointer: Phaser.Input.Pointer): void {
    if (!this.draggingCard || !this.targeting) return;
    
    // Update targeting position
    this.targeting.updateTargeting(pointer.x, pointer.y);
  }

  /**
   * Handles card drag end
   * 
   * The targeting component determines the outcome:
   * - Valid play zone → onCardPlayed
   * - Valid target → onCardTargeted
   * - Invalid → onTargetingCancel
   * 
   * @param card - The dragged card component
   * @param cardData - The card's data
   * @param pointer - Final pointer position
   * @private
   */
  private handleCardDragEnd(
    card: CardComponent,
    cardData: CardData,
    pointer: Phaser.Input.Pointer
  ): void {
    // The targeting component handles the actual resolution
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

  /* ============================================
   * PREVIEW MANAGEMENT
   * ============================================
   */

  /**
   * Shows the preview card
   * 
   * Creates an enlarged card at the preview position.
   * 
   * @param cardData - Card data to preview
   * @private
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
   * Hides the preview card
   * 
   * @private
   */
  private hidePreview(): void {
    if (this.previewCard) {
      this.previewCard.destroy();
      this.previewCard = null;
    }
  }

  /* ============================================
   * PUBLIC ACCESSORS
   * ============================================
   */

  /**
   * Gets a card component by card ID
   * 
   * @param cardId - ID of the card to find
   * @returns The CardComponent, or null if not found
   */
  getCardComponent(cardId: string): CardComponent | null {
    const index = this.cardData.findIndex(c => c.id === cardId);
    if (index === -1) return null;
    return this.cards[index] || null;
  }

  /**
   * Gets the targeting component
   * 
   * @returns The CardTargetingComponent, or null
   */
  getTargeting(): CardTargetingComponent | null {
    return this.targeting;
  }

  /**
   * Checks if currently in targeting mode
   * 
   * @returns True if targeting is active
   */
  isTargeting(): boolean {
    return this.targeting?.isActive() ?? false;
  }

  /**
   * Gets the main container
   * 
   * @returns The Phaser container
   */
  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  /* ============================================
   * POSITION AND DISPLAY SETTERS
   * ============================================
   */

  /**
   * Sets the hand center position
   * 
   * @param x - New X coordinate
   * @param y - New Y coordinate
   * 
   * Used by: GameScene.handleResize()
   */
  setPosition(x: number, y: number): void {
    this.centerX = x;
    this.centerY = y;
    this.rebuildHand();
  }

  /**
   * Sets the preview card position
   * 
   * @param x - New X coordinate
   * @param y - New Y coordinate
   */
  setPreviewPosition(x: number, y: number): void {
    this.previewX = x;
    this.previewY = y;
    if (this.previewCard) {
      this.previewCard.setPosition(x, y);
    }
  }

  /**
   * Sets the scale for cards in hand
   * 
   * Note: Container stays at scale 1, individual cards are scaled.
   * 
   * @param scale - Scale factor for cards
   * 
   * Used by: GameScene.handleResize()
   */
  setHandScale(scale: number): void {
    this.handScale = scale;
    this.rebuildHand();
  }

  /**
   * Sets visibility
   * 
   * @param visible - Whether the hand should be visible
   */
  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
    if (!visible) {
      this.hidePreview();
    }
  }

  /**
   * Sets the depth (z-index)
   * 
   * @param depth - Depth value
   */
  setDepth(depth: number): void {
    this.container.setDepth(depth);
  }

  /**
   * Sets the container scale
   * 
   * @param scale - Scale factor
   */
  setScale(scale: number): void {
    this.container.setScale(scale);
  }

  /**
   * Destroys the component and cleans up resources
   * 
   * Used by: GameScene.shutdown()
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

/* ============================================
 * RE-EXPORTS
 * ============================================
 */

/** Re-export targeting types for convenience */
export type { TargetValidator, PlayZoneBounds } from './CardTargeting';
