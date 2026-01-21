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
import { Card as CardData, MAX_HAND_SIZE } from '../managers/GameStateManager';
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
const FAN_RADIUS = 900;

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

/** Pixels of drag movement before hiding touch preview */
const TOUCH_PREVIEW_HIDE_DISTANCE = 14;

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

  /** Whether preview card should be shown */
  private previewEnabled: boolean = true;

  /** Whether touch preview behavior is enabled */
  private touchPreviewEnabled: boolean = false;

  /** Whether touch preview is currently active */
  private touchPreviewActive: boolean = false;

  /** Pointer start position for touch preview */
  private touchPreviewStart: { x: number; y: number } | null = null;
  
  /** Whether card interaction is enabled */
  private isInteractive: boolean = false;
  
  /** Currently dragged card component */
  private draggingCard: CardComponent | null = null;
  
  /** Scale factor for cards in hand */
  private handScale: number = 1;
  
  /** Targeting component for drag/arrow mechanics */
  private targeting: CardTargetingComponent | null = null;
  
  /** Section width for constraining hand */
  private sectionWidth: number = 0;
  
  /** Section height for constraining hand */
  private sectionHeight: number = 0;

  /** Queue of cards to animate from deck into hand */
  private drawQueue: Array<{ card: CardData; origin: { x: number; y: number } }> = [];

  /** Whether a draw animation sequence is active */
  private isDrawAnimating: boolean = false;

  /** Sequence token to invalidate queued draw animations */
  private drawSequenceToken: number = 0;

  /** Whether interaction was enabled before draw animation started */
  private restoreInteractionAfterDraw: boolean = false;
  
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
  public onCardPlayed?: (card: CardData) => boolean | void;
  
  /** Called when a targeted card hits a valid target (Req 9.5) */
  public onCardTargeted?: (card: CardData, target: Square) => boolean | void;
  
  /** Called when targeting starts (for highlighting legal squares) */
  public onTargetingStart?: (card: CardData) => void;
  
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
    this.targeting = new CardTargetingComponent(scene, false);
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
    
    // When targeting starts (for highlighting legal squares)
    this.targeting.onTargetingStart = (card: CardData) => {
      if (this.onTargetingStart) {
        this.onTargetingStart(card);
      }
    };
    
    // When a non-targeted card is played (dragged to play zone)
    // Requirement 9.3: Drag card to board area to play
    this.targeting.onCardPlayed = (card: CardData) => {
      // Clear dragging reference immediately
      const draggedCard = this.draggingCard ?? this.targeting?.getActiveCardComponent() ?? null;
      this.draggingCard = null;
      
      if (draggedCard) {
        draggedCard.disableInteraction();
      }

      const accepted = this.onCardPlayed ? this.onCardPlayed(card) : false;
      if (draggedCard) {
        if (accepted === false) {
          this.resetCardPosition(draggedCard);
          draggedCard.enableInteraction(true);
          draggedCard.setVisible(true); // Ensure card is visible when rejected
        } else {
          draggedCard.setVisible(false);
        }
      }
      
      // Clear highlights after card is played
      if (this.onTargetingCancel) {
        this.onTargetingCancel(card);
      }
    };
    
    // When a targeted card hits a valid target
    // Requirement 9.5: Resolve effect when arrow released on valid target
    this.targeting.onCardTargeted = (card: CardData, target: Square) => {
      // Clear dragging reference immediately
      const draggedCard = this.draggingCard ?? this.targeting?.getActiveCardComponent() ?? null;
      this.draggingCard = null;
      
      if (draggedCard) {
        draggedCard.disableInteraction();
      }

      const accepted = this.onCardTargeted ? this.onCardTargeted(card, target) : false;
      if (draggedCard) {
        if (accepted === false) {
          this.resetCardPosition(draggedCard);
          draggedCard.enableInteraction(true);
          draggedCard.setVisible(true); // Ensure card is visible when rejected
        } else {
          draggedCard.setVisible(false);
        }
      }
      
      // Clear highlights after card is targeted
      if (this.onTargetingCancel) {
        this.onTargetingCancel(card);
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
      this.draggingCard.setVisible(true); // Ensure card is visible after reset
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

  /**
   * Sets an additional play zone (e.g., discard area)
   *
   * @param bounds - Extra play zone bounds or null to clear
   */
  setExtraPlayZone(bounds: PlayZoneBounds | null): void {
    if (this.targeting) {
      this.targeting.setExtraPlayZone(bounds);
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
   * Finds the differences between current and new card arrays
   * 
   * @param newCards - New card array
   * @returns Object with added and removed card info
   * @private
   */
  private findCardDifferences(newCards: CardData[]): {
    added: CardData[];
    removed: string[];
    unchanged: boolean;
  } {
    const currentIds = new Set(this.cardData.map(c => c.id));
    const newIds = new Set(newCards.map(c => c.id));
    
    const added: CardData[] = [];
    const removed: string[] = [];
    
    // Find added cards
    for (const card of newCards) {
      if (!currentIds.has(card.id)) {
        added.push(card);
      }
    }
    
    // Find removed cards
    for (const card of this.cardData) {
      if (!newIds.has(card.id)) {
        removed.push(card.id);
      }
    }
    
    return {
      added,
      removed,
      unchanged: added.length === 0 && removed.length === 0
    };
  }

  /**
   * Sets the cards in hand with incremental updates
   * 
   * Optimized to only add/remove changed cards instead of rebuilding entire hand.
   * Falls back to full rebuild if order changed significantly.
   * 
   * @param cards - Array of card data to display
   * 
   * Used by: GameScene (when hand changes)
   */
  setCards(cards: CardData[]): void {
    // Skip if cards haven't changed at all
    if (this.cardsEqual(this.cardData, cards)) {
      return;
    }
    
    // Ensure all existing cards are visible before update (fix for hidden cards)
    for (const card of this.cards) {
      if (!card.getContainer().visible) {
        card.setVisible(true);
      }
    }
    
    const diff = this.findCardDifferences(cards);
    
    // If only additions or removals (no reordering), use incremental update
    if (diff.added.length <= 2 && diff.removed.length <= 2 && !diff.unchanged) {
      // Check if remaining cards are in same relative order
      const remainingOld = this.cardData.filter(c => !diff.removed.includes(c.id));
      const remainingNew = cards.filter(c => !diff.added.some(a => a.id === c.id));
      
      if (this.cardsEqual(remainingOld, remainingNew)) {
        // Incremental update is safe
        for (const cardId of diff.removed) {
          this.removeCardIncremental(cardId);
        }
        for (const card of diff.added) {
          this.addCardIncremental(card);
        }
        this.cardData = [...cards];
        // Delay repositioning to allow removal animations to complete
        this.scene.time.delayedCall(160, () => {
          this.repositionCards();
        });
        return;
      }
    }
    
    // Fall back to full rebuild for complex changes
    this.cardData = [...cards];
    this.rebuildHand();
  }

  /**
   * Adds a card to the hand incrementally (without full rebuild)
   * 
   * @param card - Card data to add
   * @private
   */
  private addCardIncremental(card: CardData): void {
    const effectiveScale = this.calculateEffectiveScale();
    
    // Create card at temporary position (will be repositioned)
    const cardComponent = new CardComponent(
      this.scene,
      this.centerX,
      this.centerY + 100, // Start below hand
      card,
      false,
      effectiveScale
    );
    
    cardComponent.setAlpha(0);
    this.cards.push(cardComponent);
    this.container.add(cardComponent.getContainer());
    
    // Animate card appearing
    this.scene.tweens.add({
      targets: cardComponent.getContainer(),
      alpha: 1,
      y: this.centerY,
      duration: 200,
      ease: 'Back.easeOut'
    });
  }

  /**
   * Removes a card from hand incrementally (without full rebuild)
   * 
   * @param cardId - ID of card to remove
   * @private
   */
  private removeCardIncremental(cardId: string): void {
    const index = this.cards.findIndex((_, i) => this.cardData[i]?.id === cardId);
    if (index === -1) return;
    
    const card = this.cards[index];
    
    // Clear hover state if this card was hovered
    if (this.hoveredCard === card) {
      this.hoveredCard = null;
      this.hidePreview();
    }
    
    // Remove from array immediately to prevent duplicate operations
    this.cards.splice(index, 1);
    
    // Animate card disappearing then destroy
    this.scene.tweens.add({
      targets: card.getContainer(),
      alpha: 0,
      y: card.getPosition().y - 50,
      scaleX: 0.5,
      scaleY: 0.5,
      duration: 150,
      ease: 'Quad.easeIn',
      onComplete: () => {
        card.destroy();
      }
    });
  }

  /**
   * Repositions all cards to their correct fan positions
   * Used after incremental add/remove operations
   * 
   * @private
   */
  private repositionCards(): void {
    if (this.cardData.length === 0) return;
    
    const effectiveScale = this.calculateEffectiveScale();
    const positions = this.calculateFanPositions(this.cardData.length, effectiveScale);
    
    for (let i = 0; i < this.cards.length; i++) {
      const card = this.cards[i];
      const pos = positions[i];
      
      if (!pos) continue;
      
      // Store original position for hover reset
      (card as CardComponentWithOriginal).originalX = pos.x;
      (card as CardComponentWithOriginal).originalY = pos.y;
      (card as CardComponentWithOriginal).originalRotation = pos.rotation;
      (card as CardComponentWithOriginal).originalDepth = i;
      (card as CardComponentWithOriginal).originalScale = pos.scale;
      
      // Animate to new position
      this.scene.tweens.add({
        targets: card.getContainer(),
        x: pos.x,
        y: pos.y,
        rotation: pos.rotation,
        scaleX: pos.scale,
        scaleY: pos.scale,
        duration: 200,
        ease: 'Quad.easeOut'
      });
      
      card.setDepth(i);
    }
    
    // Sort container children by depth
    this.container.sort('depth');
    
    // Re-enable interaction if it was enabled
    if (this.isInteractive) {
      this.setupInteraction();
    }
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
    this.addCardIncremental(card);
    this.repositionCards();
  }

  /**
   * Queues cards to animate from a specific origin into the hand.
   *
   * @param cards - Cards to add in order
   * @param origin - World position to start the draw animation
   */
  queueDrawCards(cards: CardData[], origin: { x: number; y: number }): void {
    if (cards.length === 0) return;

    const existingIds = new Set(this.cardData.map(card => card.id));
    for (const queued of this.drawQueue) {
      existingIds.add(queued.card.id);
    }
    const uniqueCards = cards.filter(card => !existingIds.has(card.id));
    if (uniqueCards.length === 0) {
      return;
    }

    // Preserve interaction state for restoration after draw sequence.
    if (!this.isDrawAnimating) {
      this.restoreInteractionAfterDraw = this.isInteractive;
      this.disableInteraction();
    }

    for (const card of uniqueCards) {
      this.drawQueue.push({ card, origin });
    }

    if (!this.isDrawAnimating) {
      this.isDrawAnimating = true;
      this.processDrawQueue(this.drawSequenceToken);
    }
  }

  /**
   * Cancels any queued draw animations.
   */
  cancelDrawQueue(): void {
    this.drawQueue = [];
    this.isDrawAnimating = false;
    this.drawSequenceToken += 1;
    if (this.restoreInteractionAfterDraw) {
      this.enableInteraction();
    }
    this.restoreInteractionAfterDraw = false;
  }

  /**
   * Checks if draw animation is active.
   */
  isAnimatingDraw(): boolean {
    return this.isDrawAnimating || this.drawQueue.length > 0;
  }

  private processDrawQueue(token: number): void {
    if (token !== this.drawSequenceToken) return;

    const next = this.drawQueue.shift();
    if (!next) {
      this.isDrawAnimating = false;
      if (this.restoreInteractionAfterDraw) {
        this.enableInteraction();
      }
      this.restoreInteractionAfterDraw = false;
      return;
    }

    this.animateDrawCard(next.card, next.origin, token);
  }

  private animateDrawCard(card: CardData, origin: { x: number; y: number }, token: number): void {
    if (token !== this.drawSequenceToken) return;

    const effectiveScale = this.calculateEffectiveScale();
    const cardComponent = new CardComponent(
      this.scene,
      origin.x,
      origin.y,
      card,
      false,
      effectiveScale
    );

    this.cardData.push(card);
    this.cards.push(cardComponent);
    this.container.add(cardComponent.getContainer());

    const positions = this.calculateFanPositions(this.cardData.length, effectiveScale);
    const newCardIndex = this.cards.length - 1;

    for (let i = 0; i < this.cards.length; i++) {
      const cardView = this.cards[i];
      const pos = positions[i];
      if (!pos) continue;

      (cardView as CardComponentWithOriginal).originalX = pos.x;
      (cardView as CardComponentWithOriginal).originalY = pos.y;
      (cardView as CardComponentWithOriginal).originalRotation = pos.rotation;
      (cardView as CardComponentWithOriginal).originalDepth = i;
      (cardView as CardComponentWithOriginal).originalScale = pos.scale;

      const isNewCard = i === newCardIndex;
      const duration = isNewCard ? 100 : 300;

      this.scene.tweens.add({
        targets: cardView.getContainer(),
        x: pos.x,
        y: pos.y,
        rotation: pos.rotation,
        scaleX: pos.scale,
        scaleY: pos.scale,
        duration,
        ease: 'Quad.easeOut',
        onComplete: isNewCard
          ? () => {
              if (token !== this.drawSequenceToken) return;
              this.scene.time.delayedCall(20, () => this.processDrawQueue(token));
            }
          : undefined
      });

      cardView.setDepth(i);
    }

    this.container.sort('depth');
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
    this.removeCardIncremental(cardId);
    
    // Reposition remaining cards after a short delay to allow remove animation
    this.scene.time.delayedCall(100, () => {
      this.repositionCards();
    });
    
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
   * 2. Calculate card scale based on section size
   * 3. Calculate fan positions for all cards
   * 4. Create CardComponent for each card
   * 5. Store original positions for hover reset
   * 6. Sort by depth for proper layering
   * 7. Re-enable interaction if needed
   * 
   * @private
   */
  private rebuildHand(): void {
    // Clear existing cards
    this.clearCards();
    
    if (this.cardData.length === 0) return;
    
    // Calculate effective scale based on section size
    const effectiveScale = this.calculateEffectiveScale();
    
    // Calculate fan positions
    const positions = this.calculateFanPositions(this.cardData.length, effectiveScale);
    
    // Create card components
    for (let i = 0; i < this.cardData.length; i++) {
      const pos = positions[i];
      const cardComponent = new CardComponent(
        this.scene,
        pos.x,
        pos.y,
        this.cardData[i],
        false,
        pos.scale
      );
      
      cardComponent.setRotation(pos.rotation);
      cardComponent.setDepth(i);
      
      // Store original position for hover reset
      (cardComponent as CardComponentWithOriginal).originalX = pos.x;
      (cardComponent as CardComponentWithOriginal).originalY = pos.y;
      (cardComponent as CardComponentWithOriginal).originalRotation = pos.rotation;
      (cardComponent as CardComponentWithOriginal).originalDepth = i;
      (cardComponent as CardComponentWithOriginal).originalScale = pos.scale;
      
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
   * Calculates effective scale to fit cards within section
   * 
   * @returns Scale factor for cards
   * @private
   */
  private calculateEffectiveScale(): number {
    if (this.sectionWidth <= 0 || this.sectionHeight <= 0) {
      return CARD_SCALE * this.handScale;
    }
    
    const cardCount = Math.max(1, this.cardData.length);
    const baseCardWidth = CARD_WIDTH * CARD_SCALE;
    const baseCardHeight = CARD_HEIGHT * CARD_SCALE;
    
    // Calculate how much horizontal space we need for the fan
    const overlapFactor = 0.35;
    const totalWidthNeeded = baseCardWidth + (cardCount - 1) * baseCardWidth * overlapFactor;
    
    // Calculate scale to fit within section width
    const widthPadding = this.sectionWidth * 0.02;
    const availableWidth = this.sectionWidth - widthPadding * 2;
    const scaleForWidth = availableWidth / totalWidthNeeded;
    
    // Calculate scale to fit within section height (use more padding for smaller cards)
    const heightPadding = this.sectionHeight * 0.12;
    const availableHeight = this.sectionHeight - heightPadding * 2;
    const scaleForHeight = availableHeight / baseCardHeight;
    
    // Use the smaller scale to ensure cards fit both dimensions
    const constrainedScale = Math.min(scaleForWidth, scaleForHeight);
    
    // Apply a reduction factor to make cards smaller overall
    const reductionFactor = 0.85;
    return Math.max(0.5, Math.min(0.95, constrainedScale * this.handScale * reductionFactor));
  }

  /**
   * Calculates fan positions for cards, constrained to section size
   * 
   * @param cardCount - Number of cards to position
   * @param effectiveScale - Scale factor for cards
   * @returns Array of position objects with x, y, rotation, scale
   * @private
   */
  private calculateFanPositions(cardCount: number, effectiveScale: number): Array<{ x: number; y: number; rotation: number; scale: number }> {
    const positions: Array<{ x: number; y: number; rotation: number; scale: number }> = [];
    
    if (cardCount === 0) return positions;
    
    if (cardCount === 1) {
      positions.push({
        x: this.centerX,
        y: this.centerY,
        rotation: 0,
        scale: effectiveScale
      });
      return positions;
    }
    
    // Calculate spread based on section width so cards don't squeeze too tightly
    const cardWidth = CARD_WIDTH * effectiveScale;
    let totalSpread: number;

    if (this.sectionWidth > 0) {
      const maxSpread = Math.max(0, (this.sectionWidth - cardWidth) * 0.95);
      const spacing = this.sectionWidth / (cardCount + 1);
      totalSpread = Math.min(spacing * (cardCount - 1), maxSpread);
    } else {
      const spacing = cardWidth * 0.6;
      totalSpread = Math.min(spacing * (cardCount - 1), FAN_RADIUS * 0.3);
    }
    
    // Calculate total spread angle
    const totalAngle = Math.min((cardCount - 1) * FAN_SPREAD_ANGLE, MAX_FAN_ANGLE);
    const startAngle = -totalAngle / 2;
    const angleStep = cardCount > 1 ? totalAngle / (cardCount - 1) : 0;
    
    // Calculate horizontal spacing
    const spacing = cardCount > 1 ? totalSpread / (cardCount - 1) : 0;
    const startX = this.centerX - totalSpread / 2;
    
    for (let i = 0; i < cardCount; i++) {
      const angle = startAngle + (i * angleStep);
      const radians = (angle * Math.PI) / 180;
      
      const x = startX + i * spacing;
      const arcHeight = this.sectionHeight > 0 ? this.sectionHeight * 0.2 : 20;
      const y = this.centerY + Math.abs(angle / MAX_FAN_ANGLE) * arcHeight;
      
      positions.push({
        x,
        y,
        rotation: radians * 0.3,
        scale: effectiveScale
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
      card.onDragStart = (_, pointer) => this.handleCardDragStart(card, cardData, pointer);
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
    if (!this.touchPreviewEnabled) {
      this.showPreview(cardData);
    }
    
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
    // Don't reset if this card is being dragged
    if (this.draggingCard === card) return;
    
    if (this.hoveredCard !== card) return;
    
    this.resetCardPosition(card);
    this.hoveredCard = null;
    
    // Hide preview
    if (!this.touchPreviewEnabled) {
      this.hidePreview();
    }
    
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
    card.setVisible(true); // Ensure card is visible when reset
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
   * 5. Start targeting mode with pointer position for offset calculation
   * 6. Notify callback
   * 
   * @param card - The dragged card component
   * @param cardData - The card's data
   * @param pointer - The pointer that initiated the drag
   * @private
   */
  private handleCardDragStart(card: CardComponent, cardData: CardData, pointer: Phaser.Input.Pointer): void {
    this.draggingCard = card;
    
    // Clear hover state to prevent interference
    this.hoveredCard = null;
    
    card.setDepth(200); // Bring to very front while dragging
    const original = card as CardComponentWithOriginal;
    card.setScale(original.originalScale * HOVER_SCALE);
    card.setRotation(0);
    
    if (this.touchPreviewEnabled && this.previewEnabled) {
      this.touchPreviewActive = true;
      this.touchPreviewStart = { x: pointer.x, y: pointer.y };
      this.showPreview(cardData);
    } else {
      // Hide preview while dragging
      this.hidePreview();
    }
    
    // Start targeting mode with pointer position for offset calculation
    const pos = card.getPosition();
    if (this.targeting) {
      this.targeting.startTargeting(cardData, card, pos.x, pos.y, pointer.x, pointer.y);
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
    
    if (this.touchPreviewEnabled && this.touchPreviewActive && this.touchPreviewStart) {
      const dx = pointer.x - this.touchPreviewStart.x;
      const dy = pointer.y - this.touchPreviewStart.y;
      if (Math.hypot(dx, dy) > TOUCH_PREVIEW_HIDE_DISTANCE) {
        this.hidePreview();
        this.touchPreviewActive = false;
      }
    }

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

    if (this.touchPreviewActive) {
      this.hidePreview();
    }
    this.touchPreviewActive = false;
    this.touchPreviewStart = null;
    
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
    if (!this.previewEnabled) {
      return;
    }
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
   * Forces drag-only targeting (used for discard mode)
   *
   * @param force - Whether to force drag-to-play behavior
   */
  setForceDragMode(force: boolean): void {
    this.targeting?.setForceDragMode(force);
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
   * Cancels current targeting/dragging and resets card position
   * 
   * Can be called externally (e.g., on right-click or escape key)
   */
  cancelTargeting(): void {
    if (this.targeting?.isActive()) {
      this.targeting.forceCancel();
    }
    this.resetDraggingCard();
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
   * Sets the section size for constraining the hand
   * Cards will be scaled and positioned to fit within this size
   * 
   * @param centerX - Center X position
   * @param centerY - Center Y position  
   * @param width - Section width
   * @param height - Section height
   * 
   * Used by: GameScene.positionCardHand()
   */
  setSectionSize(centerX: number, centerY: number, width: number, height: number): void {
    this.centerX = centerX;
    this.centerY = centerY;
    this.sectionWidth = width;
    this.sectionHeight = height;
    this.rebuildHand();
  }

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
   * Enables or disables preview display
   *
   * @param enabled - Whether preview should be shown on hover
   */
  setPreviewEnabled(enabled: boolean): void {
    this.previewEnabled = enabled;
    if (!enabled) {
      this.hidePreview();
      this.touchPreviewActive = false;
      this.touchPreviewStart = null;
    }
  }

  /**
   * Enables or disables touch preview behavior
   *
   * @param enabled - Whether touch preview should show on drag start
   */
  setTouchPreviewEnabled(enabled: boolean): void {
    this.touchPreviewEnabled = enabled;
    if (!enabled) {
      this.touchPreviewActive = false;
      this.touchPreviewStart = null;
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
