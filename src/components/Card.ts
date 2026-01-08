/**
 * Card Component - Single card rendering with layered assets
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 * - 10.1: Layer: frame → art → energy circle → time circle → text
 * - 10.2: Use card_front_[color].png based on card type
 * - 10.3: Display energy cost in gold circle, time cost in blue circle
 * - 10.4: Display card name below art, description in white area
 * - 10.5: Use card_back.png for opponent's hand and deck
 */

import Phaser from 'phaser';
import { Card as CardData } from '../managers/GameStateManager';
import { CARD_DEFINITIONS } from '../data/cards';

// Card dimensions (smaller size for better layout)
export const CARD_WIDTH = 10;
export const CARD_HEIGHT = 14;

// Frame color to texture key mapping
const FRAME_TEXTURES: Record<string, string> = {
  gold: 'card_front_gold',
  silver: 'card_front_silver',
  blue: 'card_front_blue',
  green: 'card_front_cyan', // Using cyan for green
  purple: 'card_front_purple',
  brown: 'card_front_brown',
  cyan: 'card_front_cyan',
};

// Art asset to texture key mapping
const ART_TEXTURES: Record<string, string> = {
  'energy.png': 'card_art_energy',
  'pawn.png': 'card_art_pawn',
  'knight.png': 'card_art_knight',
  'bishop.png': 'card_art_bishop',
  'rook.png': 'card_art_rook',
  'queen.png': 'card_art_queen',
  'ponder.png': 'card_art_ponder',
  'grow.png': 'card_art_grow',
  'destroy.png': 'card_art_destroy',
  'search.png': 'card_art_search',
};

// Layout constants (relative to card dimensions)
// Art is below the frame (positive Y = lower on screen)
const ART_Y_OFFSET = -220;
const ART_SCALE = 1.2;
// Circles are above the frame (negative Y = higher), outside the card
const ENERGY_CIRCLE_X = -280;
const ENERGY_CIRCLE_Y = -550;
const TIME_CIRCLE_X = -280;
const TIME_CIRCLE_Y = -380;
const CIRCLE_SCALE = 2.2;
// Text positions - name on stripe between art and text box, description in square text box
const NAME_Y_OFFSET = 100; // Stripe between art and text box
const DESC_Y_OFFSET = 220; // Center of the square text box
const DESC_BOX_SIZE = 350; // Square text box size
// Frame/back scale to make them smaller (can go below 1.0 to shrink below original size)
const FRAME_SCALE = 0.3;
const BACK_SCALE = 0.3;

/**
 * CardComponent - Phaser visual component for a single card
 */
export class CardComponent {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private cardData: CardData | null;
  private isFaceDown: boolean;
  private scale: number;
  
  // Visual elements
  private frameSprite: Phaser.GameObjects.Image | null = null;
  private artSprite: Phaser.GameObjects.Image | null = null;
  private energyCircle: Phaser.GameObjects.Image | null = null;
  private timeCircle: Phaser.GameObjects.Image | null = null;
  private energyText: Phaser.GameObjects.Text | null = null;
  private timeText: Phaser.GameObjects.Text | null = null;
  private nameText: Phaser.GameObjects.Text | null = null;
  private descText: Phaser.GameObjects.Text | null = null;
  private backSprite: Phaser.GameObjects.Image | null = null;

  // Interaction state
  private isInteractive: boolean = false;
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private useExternalDragHandler: boolean = false;
  private boundPointerMove?: (pointer: Phaser.Input.Pointer) => void;
  private boundPointerUp?: (pointer: Phaser.Input.Pointer) => void;

  // Event callbacks
  public onDragStart?: (card: CardComponent) => void;
  public onDragEnd?: (card: CardComponent, pointer: Phaser.Input.Pointer) => void;
  public onDragMove?: (card: CardComponent, pointer: Phaser.Input.Pointer) => void;
  public onHover?: (card: CardComponent) => void;
  public onHoverEnd?: (card: CardComponent) => void;
  public onClick?: (card: CardComponent) => void;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    cardData: CardData | null = null,
    isFaceDown: boolean = false,
    scale: number = 1
  ) {
    this.scene = scene;
    this.cardData = cardData;
    this.isFaceDown = isFaceDown;
    this.scale = scale;
    
    this.container = scene.add.container(x, y);
    this.render();
  }

  /**
   * Get the card data
   */
  getCardData(): CardData | null {
    return this.cardData;
  }

  /**
   * Get the card ID
   */
  getCardId(): string | null {
    return this.cardData?.id || null;
  }

  /**
   * Set card data and re-render
   */
  setCardData(cardData: CardData | null): void {
    this.cardData = cardData;
    this.render();
  }

  /**
   * Set face down state
   */
  setFaceDown(faceDown: boolean): void {
    this.isFaceDown = faceDown;
    this.render();
  }

  /**
   * Check if card is face down
   */
  getFaceDown(): boolean {
    return this.isFaceDown;
  }

  /**
   * Render the card
   * Requirement 10.1: Layer: frame → art → energy circle → time circle → text
   */
  private render(): void {
    this.clearVisuals();
    
    if (this.isFaceDown || !this.cardData) {
      this.renderBack();
    } else {
      this.renderFront();
    }
    
    this.container.setScale(this.scale);
  }

  /**
   * Clear all visual elements
   */
  private clearVisuals(): void {
    if (this.frameSprite) this.frameSprite.destroy();
    if (this.artSprite) this.artSprite.destroy();
    if (this.energyCircle) this.energyCircle.destroy();
    if (this.timeCircle) this.timeCircle.destroy();
    if (this.energyText) this.energyText.destroy();
    if (this.timeText) this.timeText.destroy();
    if (this.nameText) this.nameText.destroy();
    if (this.descText) this.descText.destroy();
    if (this.backSprite) this.backSprite.destroy();
    
    this.frameSprite = null;
    this.artSprite = null;
    this.energyCircle = null;
    this.timeCircle = null;
    this.energyText = null;
    this.timeText = null;
    this.nameText = null;
    this.descText = null;
    this.backSprite = null;
  }

  /**
   * Render card back
   * Requirement 10.5: Use card_back.png for opponent's hand and deck
   */
  private renderBack(): void {
    this.backSprite = this.scene.add.image(0, 0, 'card_back');
    this.backSprite.setScale(BACK_SCALE);
    this.container.add(this.backSprite);
  }

  /**
   * Render card front with all layers
   * Layer order: art (bottom) → frame → circles (top)
   */
  private renderFront(): void {
    if (!this.cardData) return;
    
    // Layer 1: Art (below frame)
    const artTexture = ART_TEXTURES[this.cardData.artAsset];
    if (artTexture) {
      this.artSprite = this.scene.add.image(0, ART_Y_OFFSET * FRAME_SCALE, artTexture);
      this.artSprite.setScale(ART_SCALE * FRAME_SCALE);
      this.container.add(this.artSprite);
    }
    
    // Layer 2: Frame (on top of art)
    // Requirement 10.2: Use card_front_[color].png based on card type
    const frameTexture = FRAME_TEXTURES[this.cardData.frameColor] || 'card_front_silver';
    this.frameSprite = this.scene.add.image(0, 0, frameTexture);
    this.frameSprite.setScale(FRAME_SCALE);
    this.container.add(this.frameSprite);
    
    // Layer 3: Energy circle (above frame, if card has energy cost)
    // Requirement 10.3: Display energy cost in gold circle
    if (this.cardData.energyCost !== null) {
      this.energyCircle = this.scene.add.image(
        ENERGY_CIRCLE_X * FRAME_SCALE, 
        ENERGY_CIRCLE_Y * FRAME_SCALE, 
        'energy_circle'
      );
      this.energyCircle.setScale(CIRCLE_SCALE * FRAME_SCALE);
      this.container.add(this.energyCircle);
      
      this.energyText = this.scene.add.text(
        ENERGY_CIRCLE_X * FRAME_SCALE,
        ENERGY_CIRCLE_Y * FRAME_SCALE,
        this.cardData.energyCost.toString(),
        {
          fontSize: `${Math.round(90 * FRAME_SCALE)}px`,
          fontFamily: 'BoldPixels, Arial',
          color: '#ffffff',
          fontStyle: 'bold'
        }
      ).setOrigin(0.5);
      this.container.add(this.energyText);
    }
    
    // Layer 4: Time circle (above frame, if card has time cost)
    // Requirement 10.3: Display time cost in blue circle
    if (this.cardData.timeCost !== null) {
      this.timeCircle = this.scene.add.image(
        TIME_CIRCLE_X * FRAME_SCALE, 
        TIME_CIRCLE_Y * FRAME_SCALE, 
        'time_circle'
      );
      this.timeCircle.setScale(CIRCLE_SCALE * FRAME_SCALE);
      this.container.add(this.timeCircle);
      
      this.timeText = this.scene.add.text(
        TIME_CIRCLE_X * FRAME_SCALE,
        TIME_CIRCLE_Y * FRAME_SCALE,
        this.cardData.timeCost.toString(),
        {
          fontSize: `${Math.round(80 * FRAME_SCALE)}px`,
          fontFamily: 'Digital7, "Courier New"',
          color: '#ffffff',
          fontStyle: 'normal'
        }
      ).setOrigin(0.5);
      this.container.add(this.timeText);
    }
    
    // Layer 5: Text (larger fonts, scaled with frame)
    // Card name on the stripe between art and text box
    this.nameText = this.scene.add.text(
      0,
      NAME_Y_OFFSET * FRAME_SCALE,
      this.cardData.name,
      {
        fontSize: `${Math.round(60 * FRAME_SCALE)}px`,
        fontFamily: 'BoldPixels, Arial',
        color: '#f5f1eaff',
        fontStyle: 'bold'
      }
    ).setOrigin(0.5);
    this.container.add(this.nameText);
    
    // Description in square text box
    const description = this.getCardDescription();
    if (description) {
      this.descText = this.scene.add.text(
        0,
        DESC_Y_OFFSET * FRAME_SCALE,
        description,
        {
          fontSize: `${Math.round(50 * FRAME_SCALE)}px`,
          fontFamily: 'BoldPixels, Arial',
          color: '#000000',
          wordWrap: { width: DESC_BOX_SIZE * FRAME_SCALE },
          align: 'center'
        }
      ).setOrigin(0.5, 0);
      this.container.add(this.descText);
    }
  }

  /**
   * Get card description from definitions
   */
  private getCardDescription(): string {
    if (!this.cardData) return '';
    
    for (const def of Object.values(CARD_DEFINITIONS)) {
      if (def.name === this.cardData.name) {
        return def.description;
      }
    }
    return '';
  }

  /**
   * Enable interaction (drag, hover, click)
   * @param useExternalDragHandler If true, card position won't be updated internally during drag
   */
  enableInteraction(useExternalDragHandler: boolean = false): void {
    if (this.isInteractive) return;
    this.isInteractive = true;
    this.useExternalDragHandler = useExternalDragHandler;
    
    // Calculate actual card size based on frame sprite dimensions
    // The frame texture is approximately 600x900 pixels, scaled by FRAME_SCALE
    const actualWidth = 600 * FRAME_SCALE;
    const actualHeight = 900 * FRAME_SCALE;
    
    // Make the container interactive with proper hit area
    const hitArea = new Phaser.Geom.Rectangle(
      -actualWidth / 2,
      -actualHeight / 2,
      actualWidth,
      actualHeight
    );
    
    this.container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
    
    // Hover events
    this.container.on('pointerover', () => {
      if (this.onHover) this.onHover(this);
    });
    
    this.container.on('pointerout', () => {
      if (this.onHoverEnd) this.onHoverEnd(this);
    });
    
    // Click event
    this.container.on('pointerdown', () => {
      if (this.onClick) this.onClick(this);
      
      // Start drag
      this.isDragging = true;
      this.dragStartX = this.container.x;
      this.dragStartY = this.container.y;
      if (this.onDragStart) this.onDragStart(this);
    });
    
    // Store bound handlers so we can remove them later
    this.boundPointerMove = (pointer: Phaser.Input.Pointer) => {
      if (this.isDragging) {
        // Only update position internally if not using external handler
        if (!this.useExternalDragHandler) {
          this.container.x = pointer.x;
          this.container.y = pointer.y;
        }
        // Notify drag move callback
        if (this.onDragMove) this.onDragMove(this, pointer);
      }
    };
    
    this.boundPointerUp = (ptr: Phaser.Input.Pointer) => {
      if (this.isDragging) {
        this.isDragging = false;
        if (this.onDragEnd) {
          this.onDragEnd(this, ptr);
        }
      }
    };
    
    // Drag handling via scene
    this.scene.input.on('pointermove', this.boundPointerMove);
    this.scene.input.on('pointerup', this.boundPointerUp);
  }

  /**
   * Disable interaction
   */
  disableInteraction(): void {
    if (!this.isInteractive) return;
    this.isInteractive = false;
    this.container.disableInteractive();
    
    // Remove scene-level event handlers
    if (this.boundPointerMove) {
      this.scene.input.off('pointermove', this.boundPointerMove);
      this.boundPointerMove = undefined;
    }
    if (this.boundPointerUp) {
      this.scene.input.off('pointerup', this.boundPointerUp);
      this.boundPointerUp = undefined;
    }
  }

  /**
   * Reset position to drag start
   */
  resetPosition(): void {
    this.container.x = this.dragStartX;
    this.container.y = this.dragStartY;
  }

  /**
   * Set position
   */
  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
    this.dragStartX = x;
    this.dragStartY = y;
  }

  /**
   * Get position
   */
  getPosition(): { x: number; y: number } {
    return { x: this.container.x, y: this.container.y };
  }

  /**
   * Set rotation (in radians)
   */
  setRotation(rotation: number): void {
    this.container.setRotation(rotation);
  }

  /**
   * Get rotation
   */
  getRotation(): number {
    return this.container.rotation;
  }

  /**
   * Set scale
   */
  setScale(scale: number): void {
    this.scale = scale;
    this.container.setScale(scale);
  }

  /**
   * Get scale
   */
  getScale(): number {
    return this.scale;
  }

  /**
   * Set depth (z-index)
   */
  setDepth(depth: number): void {
    this.container.setDepth(depth);
  }

  /**
   * Get the container
   */
  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  /**
   * Set visibility
   */
  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  /**
   * Set alpha
   */
  setAlpha(alpha: number): void {
    this.container.setAlpha(alpha);
  }

  /**
   * Destroy the component
   */
  destroy(): void {
    // Clean up event handlers first
    this.disableInteraction();
    this.clearVisuals();
    this.container.destroy();
  }
}

/**
 * Create a card component from card data
 */
export function createCardComponent(
  scene: Phaser.Scene,
  x: number,
  y: number,
  cardData: CardData,
  scale: number = 1
): CardComponent {
  return new CardComponent(scene, x, y, cardData, false, scale);
}

/**
 * Create a face-down card component
 */
export function createFaceDownCard(
  scene: Phaser.Scene,
  x: number,
  y: number,
  scale: number = 1
): CardComponent {
  return new CardComponent(scene, x, y, null, true, scale);
}
