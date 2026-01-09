/**
 * EventLog Component - Scrollable action history display
 * 
 * Requirements: 12.1, 12.2, 12.3
 * - 12.1: Display on the left side of the chess board
 * - 12.2: Show all game actions with player attribution
 * - 12.3: Be scrollable to view history
 */

import Phaser from 'phaser';

// EventLog dimensions
const LOG_WIDTH = 300;
const LOG_HEIGHT = 600;
const ENTRY_HEIGHT = 30;
const PADDING = 10;
const MASK_VERTICAL_MARGIN = 35;

export interface LogEntry {
  id: string;
  player: 'white' | 'black' | 'system';
  message: string;
  displayName?: string;
  timestamp: number;
}

/**
 * EventLogComponent - Phaser visual component for game action history
 */
export class EventLogComponent {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private backgroundGraphics: Phaser.GameObjects.Graphics;
  private maskGraphics: Phaser.GameObjects.Graphics;
  private entriesContainer: Phaser.GameObjects.Container;
  private titleText: Phaser.GameObjects.Text;
  private scrollUpButton: Phaser.GameObjects.Text;
  private scrollDownButton: Phaser.GameObjects.Text;
  
  private entries: LogEntry[] = [];
  private entryTexts: Phaser.GameObjects.Text[] = [];
  private entryBackgrounds: Phaser.GameObjects.Graphics[] = [];
  private scrollOffset: number = 0;
  private entryIdCounter: number = 0;
  private currentScale: number = 1;
  private currentX: number;
  private currentY: number;
  private maxVisibleEntries: number = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number
  ) {
    this.scene = scene;
    
    this.container = scene.add.container(x, y);
    this.currentX = x;
    this.currentY = y;
    
    // Background
    this.backgroundGraphics = scene.add.graphics();
    this.container.add(this.backgroundGraphics);
    this.drawBackground();
    
    // Title
    this.titleText = scene.add.text(0, -LOG_HEIGHT / 2 + 15, 'Event Log', {
      fontSize: '14px',
      fontFamily: 'BoldPixels, Arial',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.container.add(this.titleText);
    
    // Entries container (will be masked)
    this.entriesContainer = scene.add.container(0, 0);
    this.container.add(this.entriesContainer);
    
    // Create mask for scrolling
    this.maskGraphics = scene.add.graphics();
    this.updateMask();
    const mask = this.maskGraphics.createGeometryMask();
    this.entriesContainer.setMask(mask);
    
    // Scroll buttons
    this.scrollUpButton = scene.add.text(
      LOG_WIDTH / 2 - 20,
      -LOG_HEIGHT / 2 + 40,
      '▲',
      {
        fontSize: '16px',
        fontFamily: 'Arial',
        color: '#888888'
      }
    ).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.scrollUpButton.on('pointerdown', () => this.scrollUp());
    this.scrollUpButton.on('pointerover', () => this.scrollUpButton.setColor('#ffffff'));
    this.scrollUpButton.on('pointerout', () => this.scrollUpButton.setColor('#888888'));
    this.container.add(this.scrollUpButton);
    
    this.scrollDownButton = scene.add.text(
      LOG_WIDTH / 2 - 20,
      LOG_HEIGHT / 2 - 25,
      '▼',
      {
        fontSize: '16px',
        fontFamily: 'Arial',
        color: '#888888'
      }
    ).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.scrollDownButton.on('pointerdown', () => this.scrollDown());
    this.scrollDownButton.on('pointerover', () => this.scrollDownButton.setColor('#ffffff'));
    this.scrollDownButton.on('pointerout', () => this.scrollDownButton.setColor('#888888'));
    this.container.add(this.scrollDownButton);
    
    // Enable mouse wheel scrolling
    this.setupMouseWheelScroll();

    this.maxVisibleEntries = this.calculateMaxVisibleEntries();
  }

  /**
   * Draw the background panel
   */
  private drawBackground(): void {
    this.backgroundGraphics.clear();
    
    // Semi-transparent background
    this.backgroundGraphics.fillStyle(0x1a1a2e, 0.9);
    this.backgroundGraphics.fillRoundedRect(
      -LOG_WIDTH / 2,
      -LOG_HEIGHT / 2,
      LOG_WIDTH,
      LOG_HEIGHT,
      8
    );
    
    // Border
    this.backgroundGraphics.lineStyle(2, 0x4a4a6e, 1);
    this.backgroundGraphics.strokeRoundedRect(
      -LOG_WIDTH / 2,
      -LOG_HEIGHT / 2,
      LOG_WIDTH,
      LOG_HEIGHT,
      8
    );
    
    // Title separator
    this.backgroundGraphics.lineStyle(1, 0x4a4a6e, 0.5);
    this.backgroundGraphics.lineBetween(
      -LOG_WIDTH / 2 + PADDING,
      -LOG_HEIGHT / 2 + 30,
      LOG_WIDTH / 2 - PADDING,
      -LOG_HEIGHT / 2 + 30
    );
  }

  /**
   * Setup mouse wheel scrolling
   */
  private setupMouseWheelScroll(): void {
    this.scene.input.on('wheel', (
      _pointer: Phaser.Input.Pointer,
      _gameObjects: Phaser.GameObjects.GameObject[],
      _deltaX: number,
      deltaY: number
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
    });
  }

  /**
   * Add a new log entry
   * @param player Player who performed the action
   * @param message Action description
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
   * Create text object for an entry
   */
  private createEntryText(entry: LogEntry, index: number): void {
    // Player color indicator
    let color: string;
    let prefix: string;
    let backgroundColor: number;
    
    switch (entry.player) {
      case 'white':
        color = '#ffffff';
        prefix = '[W] ';
        backgroundColor = 0x2a2f45;
        break;
      case 'black':
        color = '#dddddd';
        prefix = '[B] ';
        backgroundColor = 0x3a2a2a;
        break;
      case 'system':
        color = '#ffff44';
        prefix = '[SYS] ';
        backgroundColor = 0x3a3a1a;
        break;
    }
    const label = entry.displayName ? `${entry.displayName}: ` : '';
    const y = -LOG_HEIGHT / 2 + 40 + (index * ENTRY_HEIGHT);

    const bg = this.scene.add.graphics();
    bg.fillStyle(backgroundColor, 0.22);
    bg.fillRoundedRect(
      -LOG_WIDTH / 2 + PADDING,
      y - 2,
      LOG_WIDTH - PADDING * 2 - 8,
      ENTRY_HEIGHT - 6,
      4
    );
    this.entryBackgrounds.push(bg);
    this.entriesContainer.add(bg);

    const text = this.scene.add.text(
      -LOG_WIDTH / 2 + PADDING + 5,
      y,
      prefix + label + entry.message,
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
   * Scroll up
   */
  scrollUp(): void {
    if (this.scrollOffset > 0) {
      this.scrollOffset--;
      this.updateScroll();
    }
  }

  /**
   * Scroll down
   */
  scrollDown(): void {
    const maxScroll = Math.max(0, this.entries.length - this.maxVisibleEntries);
    if (this.scrollOffset < maxScroll) {
      this.scrollOffset++;
      this.updateScroll();
    }
  }

  /**
   * Scroll to bottom (most recent entries)
   */
  scrollToBottom(): void {
    this.scrollOffset = Math.max(0, this.entries.length - this.maxVisibleEntries);
    this.updateScroll();
  }

  /**
   * Scroll to top (oldest entries)
   */
  scrollToTop(): void {
    this.scrollOffset = 0;
    this.updateScroll();
  }

  /**
   * Update scroll position
   */
  private updateScroll(): void {
    this.entriesContainer.y = -this.scrollOffset * ENTRY_HEIGHT;
    
    // Update scroll button visibility
    this.scrollUpButton.setAlpha(this.scrollOffset > 0 ? 1 : 0.3);
    const maxScroll = Math.max(0, this.entries.length - this.maxVisibleEntries);
    this.scrollDownButton.setAlpha(this.scrollOffset < maxScroll ? 1 : 0.3);
  }

  /**
   * Clear all entries
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
   * Get all entries
   */
  getEntries(): LogEntry[] {
    return [...this.entries];
  }

  /**
   * Get entry count
   */
  getEntryCount(): number {
    return this.entries.length;
  }

  /**
   * Import entries (for P2P sync)
   */
  importEntries(entries: LogEntry[]): void {
    this.clear();
    entries.forEach((entry, index) => {
      this.entries.push(entry);
      this.createEntryText(entry, index);
    });
    this.scrollToBottom();
  }

  /**
   * Set position
   */
  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
    this.currentX = x;
    this.currentY = y;
    this.updateMask();
  }

  /**
   * Get position
   */
  getPosition(): { x: number; y: number } {
    return { x: this.container.x, y: this.container.y };
  }

  /**
   * Set scale
   */
  setScale(scale: number): void {
    this.container.setScale(scale);
    this.currentScale = scale;
    this.updateMask();
    this.maxVisibleEntries = this.calculateMaxVisibleEntries();
    this.scrollToBottom();
  }

  private updateMask(): void {
    const scale = this.currentScale;
    const width = LOG_WIDTH * scale;
    const height = LOG_HEIGHT * scale;
    const padding = PADDING * scale;
    
    this.maskGraphics.clear();
    this.maskGraphics.fillStyle(0xffffff);
    this.maskGraphics.fillRect(
      this.currentX - width / 2 + padding,
      this.currentY - height / 2 + MASK_VERTICAL_MARGIN * scale,
      width - padding * 2,
      height - MASK_VERTICAL_MARGIN * 2 * scale
    );
  }

  private calculateMaxVisibleEntries(): number {
    const visibleHeight = LOG_HEIGHT - MASK_VERTICAL_MARGIN * 2;
    return Math.max(1, Math.floor(visibleHeight / ENTRY_HEIGHT));
  }

  /**
   * Set depth (z-index)
   */
  setDepth(depth: number): void {
    this.container.setDepth(depth);
  }

  /**
   * Set visibility
   */
  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
    this.maskGraphics.setVisible(visible);
  }

  /**
   * Set alpha
   */
  setAlpha(alpha: number): void {
    this.container.setAlpha(alpha);
  }

  /**
   * Get the container
   */
  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  /**
   * Get dimensions
   */
  getDimensions(): { width: number; height: number } {
    return { width: LOG_WIDTH, height: LOG_HEIGHT };
  }

  /**
   * Destroy the component
   */
  destroy(): void {
    this.maskGraphics.destroy();
    this.container.destroy();
  }
}

/**
 * Create an event log component
 */
export function createEventLog(
  scene: Phaser.Scene,
  x: number,
  y: number
): EventLogComponent {
  return new EventLogComponent(scene, x, y);
}

// Export dimensions for layout calculations
export { LOG_WIDTH, LOG_HEIGHT };
