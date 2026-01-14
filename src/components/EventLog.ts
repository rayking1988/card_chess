/**
 * @fileoverview EventLog Component - Scrollable action history display
 * 
 * This component displays a scrollable log of game events.
 * Each entry shows who performed an action and what they did.
 * Supports mouse wheel scrolling and scroll buttons.
 * 
 * Requirements addressed:
 * - 12.1: Display on the left side of the chess board
 * - 12.2: Show all game actions with player attribution
 * - 12.3: Be scrollable to view history
 * 
 * @module components/EventLog
 * @requires phaser
 */

import Phaser from 'phaser';
import { hex } from '../utils/colors';
import { EVENT_LOG_LAYOUT } from '../config';

/* ============================================
 * EVENT LOG CONFIGURATION CONSTANTS
 * ============================================
 */

/** Log panel width in pixels */
const LOG_WIDTH = EVENT_LOG_LAYOUT.WIDTH;

/** Log panel height in pixels */
const LOG_HEIGHT = EVENT_LOG_LAYOUT.HEIGHT;

/** Header space for top padding (no title) */
const HEADER_HEIGHT = EVENT_LOG_LAYOUT.HEADER_HEIGHT;

/** Footer space reserved for quick chat dropdown */
const FOOTER_HEIGHT = EVENT_LOG_LAYOUT.FOOTER_HEIGHT;

/** Height of each log entry in pixels */
const ENTRY_HEIGHT = EVENT_LOG_LAYOUT.ENTRY_HEIGHT;

/** Padding inside the log panel */
const PADDING = EVENT_LOG_LAYOUT.PADDING;

/** Quick chat dropdown button height */
const QUICK_CHAT_HEIGHT = EVENT_LOG_LAYOUT.QUICK_CHAT_HEIGHT;

/** Quick chat dropdown button margin from bottom */
const QUICK_CHAT_MARGIN = EVENT_LOG_LAYOUT.QUICK_CHAT_MARGIN;

/** Quick chat dropdown width */
const QUICK_CHAT_WIDTH = LOG_WIDTH - PADDING * 2 - 12;

/** Quick chat options */
const QUICK_CHAT_OPTIONS = ['Hello!', 'Good Move!', 'Good Game!', 'One More Game?'] as const;

/** Quick chat option height */
const QUICK_CHAT_OPTION_HEIGHT = EVENT_LOG_LAYOUT.QUICK_CHAT_OPTION_HEIGHT;

/** Quick chat option padding */
const QUICK_CHAT_OPTION_PADDING = EVENT_LOG_LAYOUT.QUICK_CHAT_OPTION_PADDING;

/** Background colors for different player entries */
const ENTRY_BACKGROUNDS = {
  white: hex('#3b3326'),
  black: hex('#2d2624'),
  system: hex('#3a2e1a')
};

/** Text colors for different player entries */
const ENTRY_COLORS = {
  white: '#f6e6b3',
  black: '#e2d6b0',
  system: '#ffdd88'
};

/** Panel styling colors (matched to main menu input) */
const PANEL_COLORS = {
  fill: hex('#23211f'),
  border: hex('#000000'),
  inner1: hex('#2a1a0a'),
  inner2: hex('#1d1b1a')
};

/* ============================================
 * TYPE DEFINITIONS
 * ============================================
 */

/**
 * Log entry data structure
 * 
 * @property id - Unique identifier for deduplication
 * @property player - Who performed the action
 * @property message - Description of the action
 * @property displayName - Optional player name to show
 * @property timestamp - Unix timestamp for ordering
 */
export interface LogEntry {
  id: string;
  player: 'white' | 'black' | 'system';
  message: string;
  displayName?: string;
  timestamp: number;
}

/* ============================================
 * EVENT LOG COMPONENT CLASS
 * ============================================
 */

/**
 * EventLogComponent - Scrollable game event history
 * 
 * Displays a chronological list of game events with:
 * - Player attribution (white/black/system)
 * - Color-coded backgrounds
 * - Scroll buttons and mouse wheel support
 * - Auto-scroll to newest entries
 * 
 * Visual structure:
 * - Background panel (semi-transparent dark)
 * - Top padding with scroll controls
 * - Scrollable entries container (masked)
 * - Scroll up/down buttons
 * 
 * @example
 * const eventLog = new EventLogComponent(scene, 100, 300);
 * 
 * // Add entries
 * eventLog.addEntry('white', 'Played Energy card');
 * eventLog.addEntry('black', 'Moved pawn e7 to e5');
 * eventLog.addEntry('system', 'Turn 2 begins');
 * 
 * // Scroll to see history
 * eventLog.scrollToTop();
 * 
 * Used by: GameScene (creates one event log)
 */
export class EventLogComponent {
  /** Reference to the Phaser scene */
  private scene: Phaser.Scene;
  
  /** Container holding all log visual elements */
  private container: Phaser.GameObjects.Container;
  
  /** Graphics for the background panel */
  private backgroundGraphics: Phaser.GameObjects.Graphics;
  
  /** Graphics for the scroll mask */
  private maskGraphics: Phaser.GameObjects.Graphics;
  
  /** Container for entry elements (scrollable) */
  private entriesContainer: Phaser.GameObjects.Container;
  
  /** Scroll up button */
  private scrollUpButton: Phaser.GameObjects.Text;
  
  /** Scroll down button */
  private scrollDownButton: Phaser.GameObjects.Text;

  /** Quick chat container */
  private quickChatContainer!: Phaser.GameObjects.Container;

  /** Quick chat button container */
  private quickChatButton!: Phaser.GameObjects.Container;

  /** Quick chat button label */
  private quickChatLabel!: Phaser.GameObjects.Text;

  /** Quick chat dropdown arrow */
  private quickChatArrow!: Phaser.GameObjects.Text;

  /** Quick chat options container */
  private quickChatOptionsContainer!: Phaser.GameObjects.Container;

  /** Quick chat option texts */
  private quickChatOptionTexts: Phaser.GameObjects.Text[] = [];

  /** Whether quick chat dropdown is open */
  private quickChatOpen: boolean = false;
  
  /** Array of log entry data */
  private entries: LogEntry[] = [];
  
  /** Array of entry text objects */
  private entryTexts: Phaser.GameObjects.Text[] = [];
  
  /** Array of entry background graphics */
  private entryBackgrounds: Phaser.GameObjects.Graphics[] = [];
  
  /** Current scroll offset (in entries) */
  private scrollOffset: number = 0;
  
  /** Counter for generating unique entry IDs */
  private entryIdCounter: number = 0;
  
  /** Current scale factor */
  private currentScale: number = 1;
  
  /** Current X position */
  private currentX: number;
  
  /** Current Y position */
  private currentY: number;
  
  /** Bound wheel handler for cleanup */
  private boundWheelHandler?: (
    pointer: Phaser.Input.Pointer,
    gameObjects: Phaser.GameObjects.GameObject[],
    deltaX: number,
    deltaY: number,
    deltaZ: number
  ) => void;
  
  /** Maximum visible entries based on panel size */
  private maxVisibleEntries: number = 0;

  /** Callback when quick chat option is selected */
  public onQuickChatSelect?: (text: string) => void;

  /**
   * Creates a new EventLogComponent
   * 
   * Algorithm:
   * 1. Create main container at specified position
   * 2. Draw background panel with border
   * 3. Add title text
   * 4. Create masked entries container for scrolling
   * 5. Add scroll buttons with hover effects
   * 6. Setup mouse wheel scrolling
   * 
   * @param scene - The Phaser scene to add this component to
   * @param x - X position for the log center
   * @param y - Y position for the log center
   * 
   * Used by: GameScene.createEventLog()
   */
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number
  ) {
    this.scene = scene;
    this.currentX = x;
    this.currentY = y;
    
    // Create main container
    this.container = scene.add.container(x, y);
    
    // Background panel - draw to graphics then convert to texture for performance
    this.backgroundGraphics = scene.add.graphics();
    this.drawBackground();
    this.convertBackgroundToTexture();
    
    // Scrollable entries container
    this.entriesContainer = scene.add.container(0, 0);
    this.container.add(this.entriesContainer);
    
    // Create mask for scrolling
    this.maskGraphics = scene.add.graphics();
    this.updateMask();
    const mask = this.maskGraphics.createGeometryMask();
    this.entriesContainer.setMask(mask);
    
    const scrollUpY = -LOG_HEIGHT / 2 + HEADER_HEIGHT + 6;
    const scrollDownY = LOG_HEIGHT / 2 - FOOTER_HEIGHT + 8;

    // Scroll up button
    this.scrollUpButton = scene.add.text(
      LOG_WIDTH / 2 - 20,
      scrollUpY,
      '▲',
      {
        fontSize: '14px',
        fontFamily: 'BoldPixels, Arial',
        color: '#dba616'
      }
    ).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.scrollUpButton.on('pointerdown', () => this.scrollUp());
    this.scrollUpButton.on('pointerover', () => this.scrollUpButton.setColor('#ffe4a8'));
    this.scrollUpButton.on('pointerout', () => this.scrollUpButton.setColor('#dba616'));
    this.container.add(this.scrollUpButton);
    
    // Scroll down button
    this.scrollDownButton = scene.add.text(
      LOG_WIDTH / 2 - 20,
      scrollDownY,
      '▼',
      {
        fontSize: '14px',
        fontFamily: 'BoldPixels, Arial',
        color: '#dba616'
      }
    ).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.scrollDownButton.on('pointerdown', () => this.scrollDown());
    this.scrollDownButton.on('pointerover', () => this.scrollDownButton.setColor('#ffe4a8'));
    this.scrollDownButton.on('pointerout', () => this.scrollDownButton.setColor('#dba616'));
    this.container.add(this.scrollDownButton);

    this.createQuickChat();
    
    // Enable mouse wheel scrolling
    this.setupMouseWheelScroll();
    
    // Calculate max visible entries
    this.maxVisibleEntries = this.calculateMaxVisibleEntries();
  }
  
  /** Background sprite (replaces backgroundGraphics for performance) */
  private backgroundSprite: Phaser.GameObjects.Image | null = null;
  
  /**
   * Converts the background graphics to a texture for better rendering performance
   * 
   * @private
   */
  private convertBackgroundToTexture(): void {
    const textureKey = `event_log_bg_${Date.now()}`;
    
    // The background is drawn with center origin (negative offsets), so we need to
    // temporarily redraw it at (0,0) for texture generation
    this.backgroundGraphics.clear();
    
    // Draw at (0,0) for texture capture
    this.backgroundGraphics.fillStyle(PANEL_COLORS.fill, 0.96);
    this.backgroundGraphics.fillRoundedRect(0, 0, LOG_WIDTH, LOG_HEIGHT, 10);
    this.backgroundGraphics.lineStyle(4, PANEL_COLORS.border, 1);
    this.backgroundGraphics.strokeRoundedRect(0, 0, LOG_WIDTH, LOG_HEIGHT, 10);
    this.backgroundGraphics.lineStyle(2, PANEL_COLORS.inner1, 1);
    this.backgroundGraphics.strokeRoundedRect(4, 4, LOG_WIDTH - 8, LOG_HEIGHT - 8, 8);
    this.backgroundGraphics.lineStyle(2, PANEL_COLORS.inner2, 1);
    this.backgroundGraphics.strokeRoundedRect(8, 8, LOG_WIDTH - 16, LOG_HEIGHT - 16, 6);
    
    // Generate texture from graphics
    this.backgroundGraphics.generateTexture(textureKey, LOG_WIDTH, LOG_HEIGHT);
    
    // Create sprite from texture (positioned at center of container)
    this.backgroundSprite = this.scene.add.image(0, 0, textureKey);
    this.container.addAt(this.backgroundSprite, 0);
    
    // Hide the original graphics
    this.backgroundGraphics.setVisible(false);
  }

  /* ============================================
   * PRIVATE RENDERING METHODS
   * ============================================
   */

  /**
   * Draws the background panel with border and title separator
   * 
   * Visual elements:
   * - Semi-transparent dark background (0x1a1a2e, 90% opacity)
   * - Rounded corners (8px radius)
   * - Border line (0x4a4a6e)
   * - Title separator line
   * 
   * @private
   */
  private drawBackground(): void {
    this.backgroundGraphics.clear();
    
    // Pixel-style panel background
    this.backgroundGraphics.fillStyle(PANEL_COLORS.fill, 0.96);
    this.backgroundGraphics.fillRoundedRect(
      -LOG_WIDTH / 2,
      -LOG_HEIGHT / 2,
      LOG_WIDTH,
      LOG_HEIGHT,
      10
    );
    
    // Border and inset strokes
    this.backgroundGraphics.lineStyle(4, PANEL_COLORS.border, 1);
    this.backgroundGraphics.strokeRoundedRect(
      -LOG_WIDTH / 2,
      -LOG_HEIGHT / 2,
      LOG_WIDTH,
      LOG_HEIGHT,
      10
    );
    this.backgroundGraphics.lineStyle(2, PANEL_COLORS.inner1, 1);
    this.backgroundGraphics.strokeRoundedRect(
      -LOG_WIDTH / 2 + 4,
      -LOG_HEIGHT / 2 + 4,
      LOG_WIDTH - 8,
      LOG_HEIGHT - 8,
      8
    );
    this.backgroundGraphics.lineStyle(2, PANEL_COLORS.inner2, 1);
    this.backgroundGraphics.strokeRoundedRect(
      -LOG_WIDTH / 2 + 8,
      -LOG_HEIGHT / 2 + 8,
      LOG_WIDTH - 16,
      LOG_HEIGHT - 16,
      6
    );
  }

  /**
   * Sets up mouse wheel scrolling for the log
   * 
   * Algorithm:
   * 1. Listen for wheel events on the scene
   * 2. Check if pointer is within log bounds
   * 3. Scroll up or down based on wheel direction
   * 
   * @private
   */
  private setupMouseWheelScroll(): void {
    this.boundWheelHandler = (
      _pointer: Phaser.Input.Pointer,
      _gameObjects: Phaser.GameObjects.GameObject[],
      _deltaX: number,
      deltaY: number,
      _deltaZ: number
    ) => {
      // Check if pointer is over the log area
      const pointer = this.scene.input.activePointer;
      const bounds = this.container.getBounds();
      
      if (pointer.x >= bounds.x && pointer.x <= bounds.x + bounds.width &&
          pointer.y >= bounds.y && pointer.y <= bounds.y + bounds.height) {
        if (deltaY > 0) {
          this.scrollDown();
        } else {
          this.scrollUp();
        }
      }
    };
    
    this.scene.input.on('wheel', this.boundWheelHandler);
  }

  /**
   * Creates the quick chat dropdown UI
   *
   * @private
   */
  private createQuickChat(): void {
    this.quickChatContainer = this.scene.add.container(0, 0);

    const buttonY = LOG_HEIGHT / 2 - QUICK_CHAT_MARGIN - QUICK_CHAT_HEIGHT / 2;
    this.quickChatButton = this.scene.add.container(0, buttonY);

    const buttonBg = this.scene.add.graphics();
    buttonBg.fillStyle(PANEL_COLORS.fill, 0.98);
    buttonBg.fillRoundedRect(-QUICK_CHAT_WIDTH / 2, -QUICK_CHAT_HEIGHT / 2, QUICK_CHAT_WIDTH, QUICK_CHAT_HEIGHT, 6);
    buttonBg.lineStyle(3, PANEL_COLORS.border, 1);
    buttonBg.strokeRoundedRect(-QUICK_CHAT_WIDTH / 2, -QUICK_CHAT_HEIGHT / 2, QUICK_CHAT_WIDTH, QUICK_CHAT_HEIGHT, 6);
    buttonBg.lineStyle(1, PANEL_COLORS.inner1, 0.8);
    buttonBg.strokeRoundedRect(-QUICK_CHAT_WIDTH / 2 + 2, -QUICK_CHAT_HEIGHT / 2 + 2, QUICK_CHAT_WIDTH - 4, QUICK_CHAT_HEIGHT - 4, 4);

    this.quickChatLabel = this.scene.add.text(-QUICK_CHAT_WIDTH / 2 + 12, 0, 'Quick Chat', {
      fontSize: '16px',
      fontFamily: 'BoldPixels, Arial',
      color: '#dba616'
    }).setOrigin(0, 0.5);

    this.quickChatArrow = this.scene.add.text(QUICK_CHAT_WIDTH / 2 - 16, -1, '▼', {
      fontSize: '14px',
      fontFamily: 'BoldPixels, Arial',
      color: '#dba616'
    }).setOrigin(0.5);

    this.quickChatButton.add([buttonBg, this.quickChatLabel, this.quickChatArrow]);
    this.quickChatButton.setSize(QUICK_CHAT_WIDTH, QUICK_CHAT_HEIGHT);
    this.quickChatButton.setInteractive({ useHandCursor: true });
    this.quickChatButton.on('pointerdown', () => this.toggleQuickChatOptions());

    this.quickChatContainer.add(this.quickChatButton);

    const optionsHeight = QUICK_CHAT_OPTIONS.length * QUICK_CHAT_OPTION_HEIGHT + QUICK_CHAT_OPTION_PADDING * 2;
    const optionsY = buttonY - QUICK_CHAT_HEIGHT / 2 - optionsHeight / 2 - 6;
    this.quickChatOptionsContainer = this.scene.add.container(0, optionsY);

    const optionsBg = this.scene.add.graphics();
    optionsBg.fillStyle(PANEL_COLORS.fill, 0.98);
    optionsBg.fillRoundedRect(-QUICK_CHAT_WIDTH / 2, -optionsHeight / 2, QUICK_CHAT_WIDTH, optionsHeight, 6);
    optionsBg.lineStyle(3, PANEL_COLORS.border, 1);
    optionsBg.strokeRoundedRect(-QUICK_CHAT_WIDTH / 2, -optionsHeight / 2, QUICK_CHAT_WIDTH, optionsHeight, 6);
    optionsBg.lineStyle(1, PANEL_COLORS.inner1, 0.8);
    optionsBg.strokeRoundedRect(-QUICK_CHAT_WIDTH / 2 + 2, -optionsHeight / 2 + 2, QUICK_CHAT_WIDTH - 4, optionsHeight - 4, 4);
    this.quickChatOptionsContainer.add(optionsBg);

    let optionY = -optionsHeight / 2 + QUICK_CHAT_OPTION_PADDING + QUICK_CHAT_OPTION_HEIGHT / 2;
    QUICK_CHAT_OPTIONS.forEach((option) => {
      const optionBg = this.scene.add.rectangle(0, optionY, QUICK_CHAT_WIDTH - 10, QUICK_CHAT_OPTION_HEIGHT, PANEL_COLORS.inner1, 0.2);
      optionBg.setInteractive({ useHandCursor: true });
      optionBg.on('pointerover', () => optionBg.setFillStyle(PANEL_COLORS.inner1, 0.45));
      optionBg.on('pointerout', () => optionBg.setFillStyle(PANEL_COLORS.inner1, 0.2));
      optionBg.on('pointerdown', () => {
        this.onQuickChatSelect?.(option);
        this.toggleQuickChatOptions(false);
      });

      const optionText = this.scene.add.text(-QUICK_CHAT_WIDTH / 2 + 12, optionY, option, {
        fontSize: '14px',
        fontFamily: 'BoldPixels, Arial',
        color: '#f6e6b3'
      }).setOrigin(0, 0.5);

      this.quickChatOptionTexts.push(optionText);
      this.quickChatOptionsContainer.add([optionBg, optionText]);
      optionY += QUICK_CHAT_OPTION_HEIGHT;
    });

    this.quickChatOptionsContainer.setVisible(false);
    this.quickChatContainer.add(this.quickChatOptionsContainer);

    this.container.add(this.quickChatContainer);
  }

  /**
   * Toggles quick chat options visibility
   *
   * @param force - Optional forced state
   * @private
   */
  private toggleQuickChatOptions(force?: boolean): void {
    const nextState = force ?? !this.quickChatOpen;
    this.quickChatOpen = nextState;
    this.quickChatOptionsContainer.setVisible(nextState);
    this.quickChatArrow.setText(nextState ? '▲' : '▼');
  }

  /**
   * Creates visual elements for a log entry
   * 
   * Algorithm:
   * 1. Determine colors and prefix based on player type
   * 2. Calculate Y position based on entry index
   * 3. Create background rectangle with player color
   * 4. Create text with prefix and message
   * 5. Add to entries container
   * 
   * @param entry - The log entry data
   * @param index - Index in the entries array
   * @private
   */
  private createEntryText(entry: LogEntry, index: number): void {
    // Get styling based on player type
    const color = ENTRY_COLORS[entry.player];
    const backgroundColor = ENTRY_BACKGROUNDS[entry.player];
    
    const label = entry.displayName ? `[${entry.displayName}]: ` : '';
    const y = -LOG_HEIGHT / 2 + HEADER_HEIGHT + 10 + (index * ENTRY_HEIGHT);

    // Create entry background
    const bg = this.scene.add.graphics();
    bg.fillStyle(backgroundColor, 0.28);
    bg.fillRoundedRect(
      -LOG_WIDTH / 2 + PADDING,
      y - 2,
      LOG_WIDTH - PADDING * 2 - 8,
      ENTRY_HEIGHT - 6,
      4
    );
    this.entryBackgrounds.push(bg);
    this.entriesContainer.add(bg);

    // Create entry text
    const text = this.scene.add.text(
      -LOG_WIDTH / 2 + PADDING + 5,
      y,
      label + entry.message,
      {
        fontSize: '18px',
        fontFamily: 'BoldPixels, Arial',
        color,
        wordWrap: { width: LOG_WIDTH - PADDING * 2 - 30 }
      }
    ).setOrigin(0, 0);
    
    this.entryTexts.push(text);
    this.entriesContainer.add(text);
  }

  /**
   * Updates the scroll mask position and size
   * 
   * The mask clips the entries container to show only
   * entries within the visible area.
   * 
   * @private
   */
  private updateMask(): void {
    const scale = this.currentScale;
    const width = LOG_WIDTH * scale;
    const height = LOG_HEIGHT * scale;
    const padding = PADDING * scale;
    const topInset = HEADER_HEIGHT * scale;
    const bottomInset = FOOTER_HEIGHT * scale;
    
    this.maskGraphics.clear();
    this.maskGraphics.fillStyle(hex('#ffffff'));
    this.maskGraphics.fillRect(
      this.currentX - width / 2 + padding,
      this.currentY - height / 2 + topInset,
      width - padding * 2,
      height - topInset - bottomInset
    );
  }

  /**
   * Calculates maximum visible entries based on panel size
   * 
   * @returns Number of entries that fit in visible area
   * @private
   */
  private calculateMaxVisibleEntries(): number {
    const visibleHeight = LOG_HEIGHT - HEADER_HEIGHT - FOOTER_HEIGHT;
    return Math.max(1, Math.floor(visibleHeight / ENTRY_HEIGHT));
  }

  /**
   * Updates scroll position and button states
   * 
   * Algorithm:
   * 1. Move entries container based on scroll offset
   * 2. Update scroll button opacity based on scroll position
   * 
   * @private
   */
  private updateScroll(): void {
    // Move entries container
    this.entriesContainer.y = -this.scrollOffset * ENTRY_HEIGHT;
    
    // Update scroll button visibility
    this.scrollUpButton.setAlpha(this.scrollOffset > 0 ? 1 : 0.3);
    const maxScroll = Math.max(0, this.entries.length - this.maxVisibleEntries);
    this.scrollDownButton.setAlpha(this.scrollOffset < maxScroll ? 1 : 0.3);
  }

  /* ============================================
   * PUBLIC ENTRY MANAGEMENT METHODS
   * ============================================
   */

  /**
   * Adds a new log entry
   * 
   * Algorithm:
   * 1. Create entry object with unique ID and timestamp
   * 2. Add to entries array
   * 3. Create visual elements
   * 4. Auto-scroll to show new entry
   * 
   * @param player - Who performed the action ('white', 'black', or 'system')
   * @param message - Description of the action
   * @param displayName - Optional player name to display
   * @returns The created log entry
   * 
   * Used by: GameScene (logs all game actions)
   */
  addEntry(player: 'white' | 'black' | 'system', message: string, displayName?: string): LogEntry {
    const entry: LogEntry = {
      id: `entry_${this.entryIdCounter++}`,
      player,
      message,
      displayName,
      timestamp: Date.now()
    };
    
    this.entries.push(entry);
    this.createEntryText(entry, this.entries.length - 1);
    
    // Auto-scroll to bottom when new entry is added
    this.scrollToBottom();
    
    return entry;
  }

  /**
   * Clears all log entries
   * 
   * Used by: GameScene (when starting new game)
   */
  clear(): void {
    this.entries = [];
    this.entryBackgrounds.forEach(bg => bg.destroy());
    this.entryBackgrounds = [];
    this.entryTexts.forEach(text => text.destroy());
    this.entryTexts = [];
    this.scrollOffset = 0;
    this.updateScroll();
  }

  /**
   * Gets all log entries
   * 
   * @returns Copy of entries array
   * 
   * Used by: NetworkManager (for P2P sync)
   */
  getEntries(): LogEntry[] {
    return [...this.entries];
  }

  /**
   * Gets the number of log entries
   * 
   * @returns Entry count
   */
  getEntryCount(): number {
    return this.entries.length;
  }

  /**
   * Imports entries from another source (for P2P sync)
   * 
   * Algorithm:
   * 1. Clear existing entries
   * 2. Add each imported entry
   * 3. Scroll to bottom
   * 
   * @param entries - Array of entries to import
   * 
   * Used by: NetworkManager (when syncing with peer)
   */
  importEntries(entries: LogEntry[]): void {
    this.clear();
    entries.forEach((entry, index) => {
      this.entries.push(entry);
      this.createEntryText(entry, index);
    });
    this.scrollToBottom();
  }

  /* ============================================
   * PUBLIC SCROLL METHODS
   * ============================================
   */

  /**
   * Scrolls up by one entry
   * 
   * Used by: Scroll button, mouse wheel
   */
  scrollUp(): void {
    if (this.scrollOffset > 0) {
      this.scrollOffset--;
      this.updateScroll();
    }
  }

  /**
   * Scrolls down by one entry
   * 
   * Used by: Scroll button, mouse wheel
   */
  scrollDown(): void {
    const maxScroll = Math.max(0, this.entries.length - this.maxVisibleEntries);
    if (this.scrollOffset < maxScroll) {
      this.scrollOffset++;
      this.updateScroll();
    }
  }

  /**
   * Scrolls to the bottom (most recent entries)
   * 
   * Used by: addEntry() for auto-scroll
   */
  scrollToBottom(): void {
    this.scrollOffset = Math.max(0, this.entries.length - this.maxVisibleEntries);
    this.updateScroll();
  }

  /**
   * Scrolls to the top (oldest entries)
   */
  scrollToTop(): void {
    this.scrollOffset = 0;
    this.updateScroll();
  }

  /* ============================================
   * PUBLIC POSITION AND DISPLAY METHODS
   * ============================================
   */

  /**
   * Sets the log position
   * 
   * @param x - New X position
   * @param y - New Y position
   * 
   * Used by: GameScene.handleResize()
   */
  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
    this.currentX = x;
    this.currentY = y;
    this.updateMask();
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
   * Sets the log scale
   * 
   * @param scale - Scale factor (1 = normal size)
   * 
   * Used by: GameScene.handleResize()
   */
  setScale(scale: number): void {
    this.container.setScale(scale);
    this.currentScale = scale;
    this.updateMask();
    this.maxVisibleEntries = this.calculateMaxVisibleEntries();
    this.scrollToBottom();
  }

  /**
   * Sets the depth (z-index) for layering
   * 
   * @param depth - Depth value
   * 
   * Used by: GameScene (for proper layering)
   */
  setDepth(depth: number): void {
    this.container.setDepth(depth);
  }

  /**
   * Sets visibility
   * 
   * @param visible - Whether the log should be visible
   */
  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
    this.maskGraphics.setVisible(visible);
    if (!visible) {
      this.toggleQuickChatOptions(false);
    }
  }

  /**
   * Sets alpha (transparency)
   * 
   * @param alpha - Alpha value (0-1)
   */
  setAlpha(alpha: number): void {
    this.container.setAlpha(alpha);
  }

  /**
   * Gets the main container
   * 
   * @returns The Phaser container
   */
  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  /**
   * Gets the log dimensions
   * 
   * @returns Object with width and height
   * 
   * Used by: GameScene (for layout calculations)
   */
  getDimensions(): { width: number; height: number } {
    return { width: LOG_WIDTH, height: LOG_HEIGHT };
  }

  /**
   * Destroys the component and cleans up resources
   * 
   * Used by: GameScene.shutdown()
   */
  destroy(): void {
    if (this.boundWheelHandler) {
      this.scene.input.off('wheel', this.boundWheelHandler);
      this.boundWheelHandler = undefined;
    }
    // Clean up background texture
    if (this.backgroundSprite) {
      const textureKey = this.backgroundSprite.texture.key;
      this.backgroundSprite.destroy();
      this.scene.textures.remove(textureKey);
    }
    
    this.maskGraphics.destroy();
    this.container.destroy();
  }
}

/* ============================================
 * FACTORY FUNCTION
 * ============================================
 */

/**
 * Creates an EventLogComponent instance
 * 
 * @param scene - The Phaser scene
 * @param x - X position
 * @param y - Y position
 * @returns New EventLogComponent instance
 * 
 * Used by: GameScene.createEventLog()
 */
export function createEventLog(
  scene: Phaser.Scene,
  x: number,
  y: number
): EventLogComponent {
  return new EventLogComponent(scene, x, y);
}

/* ============================================
 * EXPORTS
 * ============================================
 */

/** Export dimensions for layout calculations */
export { LOG_WIDTH, LOG_HEIGHT };
