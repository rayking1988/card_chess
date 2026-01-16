/**
 * @fileoverview Card Component - Single card rendering with layered assets
 * 
 * This component renders a single game card with multiple visual layers:
 * frame, art, cost circles, and text. Cards can be face-up or face-down
 * and support drag-and-drop interactions.
 * 
 * Requirements addressed:
 * - 10.1: Layer: frame → art → energy circle → time circle → text
 * - 10.2: Use card_front_[color].png based on card type
 * - 10.3: Display energy cost in gold circle, time cost in blue circle
 * - 10.4: Display card name below art, description in white area
 * - 10.5: Use card_back.png for opponent's hand and deck
 * 
 * @module components/Card
 * @requires phaser
 * @requires ../managers/GameStateManager
 * @requires ../data/cards
 */

import Phaser from 'phaser';
import { Card as CardData } from '../managers/GameStateManager';
import { CARD_DEFINITIONS } from '../data/cards';

/* ============================================
 * CARD DIMENSION CONSTANTS
 * ============================================
 * Base dimensions used for layout calculations.
 * Actual rendered size depends on FRAME_SCALE.
 */

/** Base card width for calculations */
export const CARD_WIDTH = 10;

/** Base card height for calculations */
export const CARD_HEIGHT = 14;

/* ============================================
 * TEXTURE MAPPING CONSTANTS
 * ============================================
 * Maps card properties to texture keys loaded in BootScene.
 */

/**
 * Maps frame color names to texture keys
 * Used to select the appropriate card border based on card type
 */
const FRAME_TEXTURES: Record<string, string> = {
  gold: 'card_front_gold',
  silver: 'card_front_silver',
  blue: 'card_front_blue',
  green: 'card_front_cyan',
  purple: 'card_front_purple',
  brown: 'card_front_brown',
  cyan: 'card_front_cyan'
};

/**
 * Maps art asset filenames to texture keys
 * Used to display the card illustration
 */
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
  'search.png': 'card_art_search'
};

/* ============================================
 * LAYOUT CONSTANTS
 * ============================================
 * Positions and scales for card elements.
 * All values are relative to the card center.
 */

/** Y offset for card art (negative = above center) */
const ART_Y_OFFSET = -220;

/** Scale factor for card art */
const ART_SCALE = 1.2;

/** X position for energy circle (left side) */
const ENERGY_CIRCLE_X = -280;

/** Y position for energy circle (top area) */
const ENERGY_CIRCLE_Y = -550;

/** X position for time circle (left side, below energy) */
const TIME_CIRCLE_X = -280;

/** Y position for time circle */
const TIME_CIRCLE_Y = -380;

/** Scale factor for cost circles */
const CIRCLE_SCALE = 2.2;

/** Y offset for card name text */
const NAME_Y_OFFSET = 100;

/** Y offset for description text */
const DESC_Y_OFFSET = 220;

/** Width of description text box */
const DESC_BOX_SIZE = 350;

/** Scale factor for card frame and back */
const FRAME_SCALE = 0.3;

/** Scale factor for card back (same as frame) */
const BACK_SCALE = 0.3;

/* ============================================
 * CARD COMPONENT CLASS
 * ============================================
 */

/**
 * CardComponent - Renders a single game card
 * 
 * Cards are composed of multiple layers:
 * 1. Art layer (bottom) - Card illustration
 * 2. Frame layer - Colored border based on card type
 * 3. Cost circles - Energy (gold) and time (blue) indicators
 * 4. Text layer (top) - Card name and description
 * 
 * Cards can be:
 * - Face-up: Shows all card details
 * - Face-down: Shows only the card back
 * 
 * Supports interactions:
 * - Hover: Triggers onHover/onHoverEnd callbacks
 * - Click: Triggers onClick callback
 * - Drag: Triggers onDragStart/onDragMove/onDragEnd callbacks
 * 
 * @example
 * // Create a face-up card
 * const card = new CardComponent(scene, 100, 200, cardData, false, 0.8);
 * 
 * // Create a face-down card (for opponent's hand)
 * const hiddenCard = new CardComponent(scene, 100, 200, null, true, 0.8);
 * 
 * Used by: CardHandComponent, GameScene (deck/discard displays)
 */
export class CardComponent {
  /** Reference to the Phaser scene */
  private scene: Phaser.Scene;
  
  /** Container holding all card visual elements */
  private container: Phaser.GameObjects.Container;
  
  /** Card data (null for face-down cards) */
  private cardData: CardData | null;
  
  /** Whether the card is face-down */
  private isFaceDown: boolean;
  
  /** Current scale factor */
  private scale: number;
  
  /* Visual element references */
  private frameSprite: Phaser.GameObjects.Image | null = null;
  private artSprite: Phaser.GameObjects.Image | null = null;
  private energyCircle: Phaser.GameObjects.Image | null = null;
  private timeCircle: Phaser.GameObjects.Image | null = null;
  private energyText: Phaser.GameObjects.Text | null = null;
  private timeText: Phaser.GameObjects.Text | null = null;
  private nameText: Phaser.GameObjects.Text | null = null;
  private descText: Phaser.GameObjects.Text | null = null;
  private backSprite: Phaser.GameObjects.Image | null = null;

  /* Interaction state */
  private isInteractive: boolean = false;
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private dragOffsetX: number = 0;
  private dragOffsetY: number = 0;
  private useExternalDragHandler: boolean = false;
  private boundPointerMove?: (pointer: Phaser.Input.Pointer) => void;
  private boundPointerUp?: (pointer: Phaser.Input.Pointer) => void;
  private boundPointerOver?: () => void;
  private boundPointerOut?: () => void;
  private boundPointerDown?: (pointer: Phaser.Input.Pointer) => void;

  /* Event callbacks - set by parent components */
  
  /** Called when drag starts */
  public onDragStart?: (card: CardComponent, pointer: Phaser.Input.Pointer) => void;
  
  /** Called when drag ends */
  public onDragEnd?: (card: CardComponent, pointer: Phaser.Input.Pointer) => void;
  
  /** Called during drag movement */
  public onDragMove?: (card: CardComponent, pointer: Phaser.Input.Pointer) => void;
  
  /** Called when pointer enters card */
  public onHover?: (card: CardComponent) => void;
  
  /** Called when pointer leaves card */
  public onHoverEnd?: (card: CardComponent) => void;
  
  /** Called when card is clicked */
  public onClick?: (card: CardComponent) => void;

  /**
   * Creates a new CardComponent
   * 
   * @param scene - The Phaser scene to add this component to
   * @param x - X position for the card center
   * @param y - Y position for the card center
   * @param cardData - Card data object (null for face-down cards)
   * @param isFaceDown - Whether to show the card back
   * @param scale - Scale factor for the card (default: 1)
   * 
   * Used by: CardHandComponent.rebuildHand(), GameScene deck/discard displays
   */
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
   * Gets the card data
   * 
   * @returns The card data object or null if face-down
   */
  getCardData(): CardData | null {
    return this.cardData;
  }

  /**
   * Gets the card ID
   * 
   * @returns The card's unique ID or null
   */
  getCardId(): string | null {
    return this.cardData?.id || null;
  }

  /**
   * Updates the card data and re-renders
   * 
   * @param cardData - New card data (or null for face-down)
   * 
   * Used by: GameScene when card state changes
   */
  setCardData(cardData: CardData | null): void {
    this.cardData = cardData;
    this.render();
  }

  /**
   * Sets whether the card is face-down
   * 
   * @param faceDown - True to show card back, false to show front
   * 
   * Used by: GameScene for card flip animations
   */
  setFaceDown(faceDown: boolean): void {
    this.isFaceDown = faceDown;
    this.render();
  }

  /**
   * Checks if the card is face-down
   * 
   * @returns True if showing card back
   */
  getFaceDown(): boolean {
    return this.isFaceDown;
  }

  /**
   * Renders the card based on current state
   * 
   * Algorithm:
   * 1. Clear all existing visual elements
   * 2. If face-down or no data: render card back
   * 3. Otherwise: render full card front with all layers
   * 4. Apply current scale to container
   * 
   * @private
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
   * Clears all visual elements from the card
   * 
   * @private
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
   * Renders the card back (face-down state)
   * 
   * Uses the 'card_back' texture loaded in BootScene.
   * 
   * @private
   */
  private renderBack(): void {
    this.backSprite = this.scene.add.image(0, 0, 'card_back');
    this.backSprite.setScale(BACK_SCALE);
    this.container.add(this.backSprite);
  }

  /**
   * Renders the card front with all layers
   * 
   * Layer order (bottom to top):
   * 1. Art - Card illustration
   * 2. Frame - Colored border
   * 3. Energy circle - Gold circle with energy cost
   * 4. Time circle - Blue circle with time cost
   * 5. Name text - Card name
   * 6. Description text - Card effect description
   * 
   * @private
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
    
    // Layer 2: Frame (colored border based on card type)
    const frameTexture = FRAME_TEXTURES[this.cardData.frameColor] || 'card_front_silver';
    this.frameSprite = this.scene.add.image(0, 0, frameTexture);
    this.frameSprite.setScale(FRAME_SCALE);
    this.container.add(this.frameSprite);
    
    // Layer 3: Energy circle (if card has energy cost)
    if (this.cardData.energyCost !== null) {
      this.energyCircle = this.scene.add.image(
        ENERGY_CIRCLE_X * FRAME_SCALE,
        ENERGY_CIRCLE_Y * FRAME_SCALE,
        'energy_circle'
      );
      this.energyCircle.setScale(CIRCLE_SCALE * FRAME_SCALE);
      this.container.add(this.energyCircle);
      
      // Energy cost number
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
    
    // Layer 4: Time circle (if card has time cost)
    if (this.cardData.timeCost !== null) {
      this.timeCircle = this.scene.add.image(
        TIME_CIRCLE_X * FRAME_SCALE,
        TIME_CIRCLE_Y * FRAME_SCALE,
        'time_circle'
      );
      this.timeCircle.setScale(CIRCLE_SCALE * FRAME_SCALE);
      this.container.add(this.timeCircle);
      
      // Time cost number
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
    
    // Layer 5: Card name
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
    
    // Layer 6: Description text
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
   * Gets the card description from the card definitions
   * 
   * Looks up the card by name in CARD_DEFINITIONS to find
   * the description text.
   * 
   * @returns The card description or empty string
   * @private
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
   * Enables interaction (hover, click, drag)
   * 
   * @param useExternalDragHandler - If true, card position won't be
   *        updated internally during drag (parent handles positioning)
   * 
   * Used by: CardHandComponent.setupInteraction()
   */
  enableInteraction(useExternalDragHandler: boolean = false): void {
    if (this.isInteractive) return;
    
    // Check if container and scene still exist
    if (!this.container || !this.container.scene || !this.scene || !this.scene.input) return;
    
    this.isInteractive = true;
    this.useExternalDragHandler = useExternalDragHandler;
    
    // Calculate hit area based on frame dimensions
    const actualWidth = 600 * FRAME_SCALE;
    const actualHeight = 900 * FRAME_SCALE;
    
    const hitArea = new Phaser.Geom.Rectangle(
      -actualWidth / 2,
      -actualHeight / 2,
      actualWidth,
      actualHeight
    );
    
    this.container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
    
    // Hover events
    if (!this.boundPointerOver) {
      this.boundPointerOver = () => {
        if (this.onHover) this.onHover(this);
      };
    }
    
    if (!this.boundPointerOut) {
      this.boundPointerOut = () => {
        if (this.onHoverEnd) this.onHoverEnd(this);
      };
    }
    
    this.container.on('pointerover', this.boundPointerOver);
    this.container.on('pointerout', this.boundPointerOut);
    
    // Click/drag events
    if (!this.boundPointerDown) {
      this.boundPointerDown = (pointer: Phaser.Input.Pointer) => {
        if (this.onClick) this.onClick(this);
        
        this.isDragging = true;
        this.dragStartX = this.container.x;
        this.dragStartY = this.container.y;
        
        // Store the offset between pointer and card center
        // This prevents the card from "jumping" to the pointer position
        this.dragOffsetX = this.container.x - pointer.x;
        this.dragOffsetY = this.container.y - pointer.y;
        
        if (this.onDragStart) this.onDragStart(this, pointer);
      };
    }
    
    this.container.on('pointerdown', this.boundPointerDown);
    
    // Scene-level drag handling
    this.boundPointerMove = (pointer: Phaser.Input.Pointer) => {
      if (this.isDragging) {
        if (!this.useExternalDragHandler) {
          // Apply offset to keep card relative to where it was grabbed
          this.container.x = pointer.x + this.dragOffsetX;
          this.container.y = pointer.y + this.dragOffsetY;
        }
        if (this.onDragMove) this.onDragMove(this, pointer);
      }
    };
    
    this.boundPointerUp = (ptr: Phaser.Input.Pointer) => {
      if (this.isDragging) {
        this.isDragging = false;
        if (this.onDragEnd) this.onDragEnd(this, ptr);
      }
    };
    
    this.scene.input.on('pointermove', this.boundPointerMove);
    this.scene.input.on('pointerup', this.boundPointerUp);
  }

  /**
   * Disables all interaction
   * 
   * Used by: CardHandComponent when card is played
   */
  disableInteraction(): void {
    if (!this.isInteractive) return;
    this.isInteractive = false;
    
    // Check if container still exists
    if (!this.container || !this.container.scene) return;
    
    this.container.disableInteractive();
    
    if (this.boundPointerOver) {
      this.container.off('pointerover', this.boundPointerOver);
    }
    if (this.boundPointerOut) {
      this.container.off('pointerout', this.boundPointerOut);
    }
    if (this.boundPointerDown) {
      this.container.off('pointerdown', this.boundPointerDown);
    }
    
    // Check if scene still exists before removing input listeners
    if (this.scene && this.scene.input) {
      if (this.boundPointerMove) {
        this.scene.input.off('pointermove', this.boundPointerMove);
        this.boundPointerMove = undefined;
      }
      if (this.boundPointerUp) {
        this.scene.input.off('pointerup', this.boundPointerUp);
        this.boundPointerUp = undefined;
      }
    }
  }

  /**
   * Resets position to where drag started
   * 
   * Used by: CardHandComponent when drag is cancelled
   */
  resetPosition(): void {
    this.container.x = this.dragStartX;
    this.container.y = this.dragStartY;
  }

  /**
   * Sets the card position
   * 
   * @param x - New X position
   * @param y - New Y position
   */
  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
    this.dragStartX = x;
    this.dragStartY = y;
  }

  /**
   * Gets the current position
   * 
   * @returns Object with x and y coordinates
   */
  getPosition(): { x: number; y: number } {
    return { x: this.container.x, y: this.container.y };
  }

  /**
   * Sets the rotation in radians
   * 
   * @param rotation - Rotation angle in radians
   */
  setRotation(rotation: number): void {
    this.container.setRotation(rotation);
  }

  /**
   * Gets the current rotation
   * 
   * @returns Rotation in radians
   */
  getRotation(): number {
    return this.container.rotation;
  }

  /**
   * Sets the scale factor
   * 
   * @param scale - Scale factor (1 = normal size)
   */
  setScale(scale: number): void {
    this.scale = scale;
    this.container.setScale(scale);
  }

  /**
   * Gets the current scale
   * 
   * @returns Current scale factor
   */
  getScale(): number {
    return this.scale;
  }

  /**
   * Sets the depth (z-index)
   * 
   * @param depth - Depth value (higher = on top)
   */
  setDepth(depth: number): void {
    this.container.setDepth(depth);
  }

  /**
   * Gets the container for direct manipulation
   * 
   * @returns The Phaser container
   */
  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  /**
   * Sets visibility
   * 
   * @param visible - Whether the card should be visible
   */
  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  /**
   * Sets alpha (transparency)
   * 
   * @param alpha - Alpha value (0 = transparent, 1 = opaque)
   */
  setAlpha(alpha: number): void {
    this.container.setAlpha(alpha);
  }

  /**
   * Destroys the component and cleans up resources
   */
  destroy(): void {
    this.disableInteraction();
    this.clearVisuals();
    this.container.destroy();
  }
}

/* ============================================
 * FACTORY FUNCTIONS
 * ============================================
 */

/**
 * Creates a face-up card component
 * 
 * @param scene - The Phaser scene
 * @param x - X position
 * @param y - Y position
 * @param cardData - Card data object
 * @param scale - Scale factor (default: 1)
 * @returns A new CardComponent instance
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
 * Creates a face-down card component
 * 
 * @param scene - The Phaser scene
 * @param x - X position
 * @param y - Y position
 * @param scale - Scale factor (default: 1)
 * @returns A new CardComponent instance showing card back
 */
export function createFaceDownCard(
  scene: Phaser.Scene,
  x: number,
  y: number,
  scale: number = 1
): CardComponent {
  return new CardComponent(scene, x, y, null, true, scale);
}
