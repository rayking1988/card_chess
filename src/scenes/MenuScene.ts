/**
 * @fileoverview MenuScene - Main menu with name input and P2P matchmaking
 * 
 * This scene provides the game's entry point with player name input,
 * matchmaking queue functionality, and external links (Ko-fi, bug reports).
 * Uses Trystero for P2P WebRTC connections.
 * 
 * Requirements addressed:
 * - 1.1: Display main menu with name input field
 * - 1.2: Store player name in localStorage
 * - 1.3: Connect to Trystero P2P network on "Join Queue"
 * - 1.4: Establish direct WebRTC connection
 * - 1.5: Start new game with random color assignment
 * - 1.6: Display Ko-fi donation button
 * - 1.7: Display Discord redirect link
 * 
 * @module scenes/MenuScene
 * @requires phaser
 * @requires managers/NetworkManager
 * @requires managers/GameStateManager
 * 
 * Used by: main.ts (scene registration), GameScene (return to menu)
 */

import Phaser from 'phaser';
import { NetworkManager, ConnectionState } from '../managers/NetworkManager';
import type { PlayerColor } from '../managers/GameStateManager';
import { NETWORK, DISPLAY, ANIMATION, SCALE, VERSION } from '../config';
import { isElectron, quitApp } from '../utils/platform';

/* ============================================
 * CONFIGURATION CONSTANTS
 * ============================================
 */

/** LocalStorage key for persisting player name (Requirement 1.2) */
const STORAGE_KEY = NETWORK.STORAGE_KEY;

/** Default room ID for matchmaking lobby */
const DEFAULT_ROOM_ID = NETWORK.DEFAULT_ROOM_ID;

/** Ko-fi donation page URL (Requirement 1.6) */
const KOFI_URL = NETWORK.KOFI_URL;

/** GitHub issues page for bug reports */
const BUG_REPORT_URL = NETWORK.BUG_REPORT_URL;

/** Base design height for UI scaling calculations */
const BASE_HEIGHT = DISPLAY.GAME_HEIGHT;

/** How-to-play content configuration path */
const HOW_TO_PLAY_CONFIG_URL = 'how-to-play/config.json';

interface HowToPlayTabConfig {
  id: string;
  label: string;
  markdown: string;
}

interface HowToPlayConfig {
  title?: string;
  defaultTabId?: string;
  tabs: HowToPlayTabConfig[];
}

/* ============================================
 * MENU SCENE CLASS
 * ============================================ */

/**
 * MenuScene - Main menu with matchmaking functionality
 * 
 * Provides the game's main menu interface with:
 * - Player name input with localStorage persistence
 * - P2P matchmaking queue via Trystero
 * - External links (Ko-fi, bug reports)
 * - Animated waiting state during matchmaking
 * 
 * Flow:
 * 1. Player enters name (saved to localStorage)
 * 2. Player clicks "Join Queue"
 * 3. NetworkManager connects to P2P room
 * 4. When peer found, colors assigned randomly
 * 5. Transition to GameScene with connection data
 * 
 * Used by: main.ts, GameScene (return to menu)
 */
export class MenuScene extends Phaser.Scene {
  /** Network manager for P2P connections */
  private networkManager: NetworkManager | null = null;
  
  /** HTML input element for name entry */
  private nameInput: HTMLInputElement | null = null;
  
  /** Current player name */
  private playerName: string = '';
  
  /** Current connection state */
  private connectionState: ConnectionState = 'disconnected';
  
  /** Assigned player color after matchmaking */
  private localColor: PlayerColor | null = null;
  
  /** Background image */
  private background!: Phaser.GameObjects.Image;
  
  /** Container for all UI elements (for centering) */
  private uiContainer!: Phaser.GameObjects.Container;
  
  /** Join queue button */
  private joinButton!: Phaser.GameObjects.Container;
  
  /** Status text for matchmaking feedback */
  private statusText!: Phaser.GameObjects.Text;
  
  /** Cancel queue button (shown while waiting) */
  private cancelButton!: Phaser.GameObjects.Container;

  /** Whether the client is waiting for a match */
  private isWaitingForMatch: boolean = false;

  /** How To Play button */
  private howToPlayButton!: Phaser.GameObjects.Container;

  /** How To Play overlay root */
  private howToPlayOverlay: HTMLDivElement | null = null;

  /** How To Play panel element */
  private howToPlayPanel: HTMLDivElement | null = null;

  /** How To Play tabs container */
  private howToPlayTabs: HTMLDivElement | null = null;

  /** How To Play content container */
  private howToPlayContent: HTMLDivElement | null = null;

  /** How To Play close button */
  private howToPlayCloseButton: HTMLButtonElement | null = null;

  /** How To Play style tag */
  private howToPlayStyleTag: HTMLStyleElement | null = null;

  /** Cached How To Play config */
  private howToPlayConfig: HowToPlayConfig | null = null;

  /** Tab buttons by ID */
  private howToPlayTabButtons: Map<string, HTMLButtonElement> = new Map();

  /** Active tab ID */
  private activeHowToPlayTabId: string | null = null;

  /** Gets the active how-to-play tab ID */
  public getActiveHowToPlayTabId(): string | null {
    return this.activeHowToPlayTabId;
  }

  constructor() {
    super({ key: 'MenuScene' });
  }

  /**
   * Creates all scene elements
   * 
   * Used by: Phaser scene lifecycle
   */
  create(): void {
    const { width, height } = this.scale;

    this.isWaitingForMatch = false;
    this.connectionState = 'disconnected';
    this.localColor = null;
    this.dotCount = 0;
    this.stopWaitingAnimation();
    
    // Add room background - scale to cover entire viewport
    if (this.textures.exists('room_background')) {
      this.background = this.add.image(width / 2, height / 2, 'room_background');
      this.background.setDepth(-1);
      this.scaleBackgroundToCover();
    }
    
    // Create UI container centered on screen
    this.uiContainer = this.add.container(width / 2, height / 2);
    
    // Load player name from localStorage (Requirement 1.2)
    this.loadPlayerName();
    
    // Create UI elements (positioned relative to center, using base dimensions)
    this.createTitle();
    this.createNameInput();
    this.createHowToPlayButton();
    this.createJoinButton();
    this.createBugReportButton();
    this.createBottomButton(); // Ko-fi or Exit depending on platform
    this.createStatusText();
    this.createCancelButton();
    this.setWaitingState(false);
    
    // Initialize network manager
    this.networkManager = new NetworkManager();
    this.setupNetworkCallbacks();
    
    // Handle resize
    this.scale.on('resize', this.handleResize, this);
  }
  
  /**
   * Scales background to cover entire viewport (may crop edges)
   * 
   * @private
   */
  private scaleBackgroundToCover(): void {
    if (!this.background) return;
    
    const { width, height } = this.scale;
    const bgWidth = this.background.width;
    const bgHeight = this.background.height;
    
    // Scale to cover (like CSS background-size: cover)
    const scaleX = width / bgWidth;
    const scaleY = height / bgHeight;
    const scale = Math.max(scaleX, scaleY);
    
    this.background.setScale(scale);
    this.background.setPosition(width / 2, height / 2);
  }
  
  /**
   * Handles window resize events
   * 
   * @param gameSize - New game dimensions
   * @private
   */
  private handleResize(gameSize: Phaser.Structs.Size): void {
    const width = gameSize.width;
    const height = gameSize.height;
    
    // Reposition background to cover
    this.scaleBackgroundToCover();
    
    // Reposition UI container to center
    if (this.uiContainer) {
      this.uiContainer.setPosition(width / 2, height / 2);
    }
    
    // Reposition HTML input
    this.positionNameInput();
    this.positionHowToPlayOverlay();
  }

  /**
   * Loads player name from localStorage
   * Requirement 1.2
   * 
   * @private
   */
  private loadPlayerName(): void {
    const savedName = localStorage.getItem(STORAGE_KEY);
    if (savedName) {
      this.playerName = savedName;
    }
  }

  /**
   * Saves player name to localStorage
   * 
   * @param name - Name to save
   * @private
   */
  private savePlayerName(name: string): void {
    const trimmed = name.slice(0, NETWORK.MAX_NAME_LENGTH);
    this.playerName = trimmed;
    localStorage.setItem(STORAGE_KEY, trimmed);
  }

  /**
   * Creates the title and subtitle text
   * 
   * @private
   */
  private createTitle(): void {
    const title = this.add.text(0, -BASE_HEIGHT * 0.35, 'CARD CHESS', {
      fontFamily: 'BoldPixels, Arial',
      fontSize: '72px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 15
    }).setOrigin(0.5);
    this.uiContainer.add(title);

    const sup_title = this.add.text(title.width/2, -BASE_HEIGHT * 0.39, `${VERSION.MAIN}-${VERSION.MAJOR}.${VERSION.MINOR}.${VERSION.INCREMENTAL}`, {
      fontFamily: 'BoldPixels, Arial',
      fontSize: '15px',
      color: '#e7a20d',
      stroke: '#000000',
      strokeThickness: 15
    }).setOrigin(0.5);
    this.uiContainer.add(sup_title);
    
    // Subtitle
    const subtitle = this.add.text(0, -BASE_HEIGHT * 0.28, 'CHESS MEETS CARDS', {
      fontFamily: 'BoldPixels, Arial',
      fontSize: '36px',
      color: '#cccccc',
      stroke: '#000000',
      strokeThickness: 5
    }).setOrigin(0.5);
    this.uiContainer.add(subtitle);
  }

  /**
   * Creates the HTML name input field
   * Requirement 1.1
   * 
   * @private
   */
  private createNameInput(): void {
    // Label
    const label = this.add.text(0, -BASE_HEIGHT * 0.15, 'ENTER YOUR NAME:', {
      fontFamily: 'BoldPixels, Arial',
      fontSize: '28px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);
    this.uiContainer.add(label);
    
    // Create HTML input element with pixel art styling
    this.nameInput = document.createElement('input');
    this.nameInput.type = 'text';
    this.nameInput.placeholder = 'Player Name';
    this.nameInput.value = this.playerName;
    this.nameInput.maxLength = NETWORK.MAX_NAME_LENGTH;
    this.nameInput.style.cssText = `
      position: absolute;
      font-family: 'BoldPixels', Arial, sans-serif;
      font-size: 30px;
      padding: 15px 20px;
      border: 4px solid #000000ff;
      border-radius: 8px;
      background-color: #23211fff;
      color: rgba(219, 166, 22, 1);
      text-align: center;
      width: 320px;
      outline: none;
      box-shadow: 
        inset 0 0 0 2px #2a1a0a,
        inset 0 0 0 4px #1d1b1aff,
        4px 4px 0 0 #1a0a00;
      image-rendering: pixelated;
      text-shadow: 2px 2px 0 #1a0a00;
      letter-spacing: 2px;
    `;
    
    this.nameInput.addEventListener('input', () => {
      if (!this.nameInput) return;
      const trimmed = this.nameInput.value.slice(0, NETWORK.MAX_NAME_LENGTH);
      if (this.nameInput.value !== trimmed) {
        this.nameInput.value = trimmed;
      }
      this.savePlayerName(trimmed);
    });

    this.nameInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      if (this.isWaitingForMatch) return;
      event.preventDefault();
      this.onJoinQueue();
    });
    
    document.body.appendChild(this.nameInput);
    this.positionNameInput();
  }

  /**
   * Positions the HTML input element to match Phaser canvas
   * 
   * @private
   */
  private positionNameInput(): void {
    if (!this.nameInput) return;
    
    const canvas = this.game.canvas;
    const canvasRect = canvas.getBoundingClientRect();
    const { width, height } = this.scale;
    
    // Input is at center + offset
    const inputX = width / 2;
    const inputY = height / 2 - BASE_HEIGHT * 0.08;
    
    this.nameInput.style.left = `${canvasRect.left + (inputX / width) * canvasRect.width - 160}px`;
    this.nameInput.style.top = `${canvasRect.top + (inputY / height) * canvasRect.height - 30}px`;
  }

  /**
   * Creates the How To Play button
   *
   * @private
   */
  private createHowToPlayButton(): void {
    this.howToPlayButton = this.createImageButton(
      0,
      BASE_HEIGHT * 0.08,
      'HOW TO PLAY',
      'green_button',
      '_button_pressed',
      () => {
        void this.onHowToPlay();
      }
    );
    this.uiContainer.add(this.howToPlayButton);
  }

  /**
   * Creates the Join Queue button
   * 
   * @private
   */
  private createJoinButton(): void {
    this.joinButton = this.createImageButton(
      0,
      BASE_HEIGHT * 0.2,
      'JOIN THE QUEUE',
      'blue_button',
      'blue_button_pressed',
      () => this.onJoinQueue()
    );
    this.uiContainer.add(this.joinButton);
  }

  /**
   * Creates the Bug Report button
   * 
   * @private
   */
  private createBugReportButton(): void {
    const btn = this.createImageButton(
      0,
      BASE_HEIGHT * 0.32,
      'REPORT A BUG',
      'yellow_button',
      'yellow_button_pressed',
      () => this.openExternalLink(BUG_REPORT_URL)
    );
    this.uiContainer.add(btn);
  }

  /**
   * Creates the bottom button - Ko-fi for web, Exit for Electron
   * 
   * @private
   */
  private createBottomButton(): void {
    if (isElectron()) {
      // In Electron app, show Exit button
      this.createExitButton();
    } else {
      // In web browser, show Ko-fi button
      this.createKofiButton();
    }
  }

  /**
   * Creates the Ko-fi donation button
   * Requirement 1.6
   * 
   * @private
   */
  private createKofiButton(): void {
    const btn = this.createImageButton(
      0,
      BASE_HEIGHT * 0.44,
      'SUPPORT ON KO-FI',
      'brown_button',
      'brown_button_pressed',
      () => this.openExternalLink(KOFI_URL)
    );
    this.uiContainer.add(btn);
  }

  /**
   * Creates the Exit button for Electron app
   * 
   * @private
   */
  private createExitButton(): void {
    const btn = this.createImageButton(
      0,
      BASE_HEIGHT * 0.32,
      'EXIT GAME',
      'red_button',
      'red_button_pressed',
      () => this.onExitGame()
    );
    this.uiContainer.add(btn);
  }

  /**
   * Handles Exit button click - quits the Electron app
   * 
   * @private
   */
  private onExitGame(): void {
    quitApp();
  }

  /**
   * Creates the status text for matchmaking feedback
   * 
   * @private
   */
  private createStatusText(): void {
    this.statusText = this.add.text(0, BASE_HEIGHT * -0.01, '', {
      fontFamily: 'BoldPixels, Arial',
      fontSize: '30px',
      color: '#ffcc00'
    }).setOrigin(0.5);
    this.uiContainer.add(this.statusText);
  }

  /**
   * Creates the cancel button (hidden by default)
   * 
   * @private
   */
  private createCancelButton(): void {
    this.cancelButton = this.createImageButton(
      0,
      BASE_HEIGHT * 0.2,
      'CANCEL',
      'red_button',
      'red_button_pressed',
      () => this.onCancelQueue()
    );
    this.cancelButton.setVisible(false);
    this.uiContainer.add(this.cancelButton);
  }

  /**
   * Opens the How To Play window
   * 
   * @private
   */
  private async onHowToPlay(): Promise<void> {
    this.createHowToPlayOverlay();
    this.setHowToPlayVisible(true);
    await this.loadHowToPlayConfig();
  }

  /**
   * Creates the How To Play overlay elements
   *
   * @private
   */
  private createHowToPlayOverlay(): void {
    if (this.howToPlayOverlay) {
      this.positionHowToPlayOverlay();
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'how-to-play-overlay';
    overlay.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      width: 0;
      height: 0;
      display: none;
      z-index: 1000;
      pointer-events: auto;
    `;

    const backdrop = document.createElement('div');
    backdrop.className = 'howto-backdrop';
    backdrop.addEventListener('click', () => this.setHowToPlayVisible(false));

    const panel = document.createElement('div');
    panel.className = 'howto-panel';
    panel.style.cssText = `
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      background-color: #23211f;
      border: 4px solid #000000;
      border-radius: 10px;
      box-shadow:
        inset 0 0 0 2px #2a1a0a,
        inset 0 0 0 4px #1d1b1a,
        6px 6px 0 0 #1a0a00;
      color: #f0eee7;
      font-family: 'BoldPixels', Arial, sans-serif;
      display: flex;
      flex-direction: column;
      padding: 12px;
      box-sizing: border-box;
    `;
    panel.addEventListener('click', (event) => event.stopPropagation());

    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    `;

    const tabs = document.createElement('div');
    tabs.className = 'howto-tabs';

    const closeButton = document.createElement('button');
    closeButton.className = 'howto-close';
    closeButton.textContent = 'CLOSE';
    closeButton.addEventListener('click', () => this.setHowToPlayVisible(false));

    header.appendChild(tabs);
    header.appendChild(closeButton);

    const content = document.createElement('div');
    content.className = 'howto-content';
    content.textContent = 'Loading...';

    panel.appendChild(header);
    panel.appendChild(content);
    overlay.appendChild(backdrop);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    this.howToPlayOverlay = overlay;
    this.howToPlayPanel = panel;
    this.howToPlayTabs = tabs;
    this.howToPlayContent = content;
    this.howToPlayCloseButton = closeButton;

    this.ensureHowToPlayStyles();
    this.positionHowToPlayOverlay();
  }

  /**
   * Injects How To Play styles once
   *
   * @private
   */
  private ensureHowToPlayStyles(): void {
    if (document.getElementById('how-to-play-style')) return;
    const styleTag = document.createElement('style');
    styleTag.id = 'how-to-play-style';
    styleTag.textContent = `
      #how-to-play-overlay .howto-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
      }
      #how-to-play-overlay .howto-tabs {
        display: flex;
        gap: 6px;
        overflow-x: auto;
        flex: 1;
        padding-bottom: 4px;
      }
      #how-to-play-overlay .howto-tabs::-webkit-scrollbar {
        height: 6px;
      }
      #how-to-play-overlay .howto-tab {
        background: #3a2e1a;
        color: #f0eee7;
        border: 2px solid #000000;
        border-radius: 6px;
        padding: 6px 10px;
        font-family: 'BoldPixels', Arial, sans-serif;
        cursor: pointer;
        box-shadow: 3px 3px 0 0 #1a0a00;
        white-space: nowrap;
      }
      #how-to-play-overlay .howto-tab[data-active="true"] {
        background: #dba616;
        color: #1a0a00;
        box-shadow: inset 0 0 0 2px #2a1a0a, 3px 3px 0 0 #1a0a00;
      }
      #how-to-play-overlay .howto-close {
        background: #772525;
        color: #ffffff;
        border: 2px solid #000000;
        border-radius: 6px;
        padding: 6px 10px;
        font-family: 'BoldPixels', Arial, sans-serif;
        cursor: pointer;
        box-shadow: 3px 3px 0 0 #1a0a00;
      }
      #how-to-play-overlay .howto-content {
        flex: 1;
        overflow-y: auto;
        background: #1d1b1a;
        border: 3px solid #000000;
        border-radius: 8px;
        padding: 10px 12px;
        box-sizing: border-box;
        color: #f0eee7;
        line-height: 1.4;
      }
      #how-to-play-overlay .howto-content h1,
      #how-to-play-overlay .howto-content h2,
      #how-to-play-overlay .howto-content h3 {
        margin: 0 0 8px 0;
        color: #ffcc66;
      }
      #how-to-play-overlay .howto-content p {
        margin: 0 0 10px 0;
      }
      #how-to-play-overlay .howto-content ul {
        margin: 0 0 12px 18px;
        padding: 0;
      }
      #how-to-play-overlay .howto-content li {
        margin-bottom: 6px;
      }
      #how-to-play-overlay .howto-content img {
        max-width: 100%;
        height: auto;
        display: block;
        margin: 10px auto;
        border: 2px solid #000000;
        box-shadow: 4px 4px 0 0 #1a0a00;
      }
      #how-to-play-overlay .howto-content code {
        background: #23211f;
        border: 1px solid #000000;
        border-radius: 4px;
        padding: 1px 4px;
      }
      #how-to-play-overlay .howto-content a {
        color: #dba616;
      }
    `;
    document.head.appendChild(styleTag);
    this.howToPlayStyleTag = styleTag;
  }

  /**
   * Positions the How To Play overlay to match the canvas
   *
   * @private
   */
  private positionHowToPlayOverlay(): void {
    if (!this.howToPlayOverlay || !this.howToPlayPanel) return;
    const canvas = this.game.canvas;
    const canvasRect = canvas.getBoundingClientRect();
    const { width, height } = this.scale;
    const scaleX = canvasRect.width / width;
    const scaleY = canvasRect.height / height;
    const panelWidth = Math.min(width * 0.9, 920);
    const panelHeight = Math.min(height * 0.8, 680);

    this.howToPlayOverlay.style.left = `${canvasRect.left}px`;
    this.howToPlayOverlay.style.top = `${canvasRect.top}px`;
    this.howToPlayOverlay.style.width = `${canvasRect.width}px`;
    this.howToPlayOverlay.style.height = `${canvasRect.height}px`;
    this.howToPlayPanel.style.width = `${panelWidth * scaleX}px`;
    this.howToPlayPanel.style.height = `${panelHeight * scaleY}px`;

    const contentFontSize = Math.max(12, Math.round(14 * scaleY));
    if (this.howToPlayContent) {
      this.howToPlayContent.style.fontSize = `${contentFontSize}px`;
    }
    if (this.howToPlayTabs) {
      this.howToPlayTabs.style.fontSize = `${Math.max(11, Math.round(12 * scaleY))}px`;
    }
    if (this.howToPlayCloseButton) {
      this.howToPlayCloseButton.style.fontSize = `${Math.max(11, Math.round(12 * scaleY))}px`;
    }
  }

  /**
   * Toggles How To Play overlay visibility
   *
   * @param visible - Whether to show the overlay
   * @private
   */
  private setHowToPlayVisible(visible: boolean): void {
    if (!this.howToPlayOverlay) return;
    this.howToPlayOverlay.style.display = visible ? 'block' : 'none';
  }

  /**
   * Loads the How To Play tab configuration and builds tabs
   *
   * @private
   */
  private async loadHowToPlayConfig(): Promise<void> {
    if (!this.howToPlayContent || !this.howToPlayTabs) return;
    this.howToPlayContent.textContent = 'Loading...';
    this.howToPlayTabs.innerHTML = '';
    this.howToPlayTabButtons.clear();
    this.activeHowToPlayTabId = null;

    try {
      const response = await fetch(HOW_TO_PLAY_CONFIG_URL, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Failed to load config (${response.status})`);
      }
      const rawConfig = await response.json();
      const rawTabs = Array.isArray(rawConfig?.tabs) ? rawConfig.tabs : [];
      const tabs: HowToPlayTabConfig[] = rawTabs
        .map((tab: HowToPlayTabConfig) => ({
          id: String(tab.id ?? '').trim(),
          label: String(tab.label ?? tab.id ?? '').trim(),
          markdown: String(tab.markdown ?? '').trim()
        }))
        .filter((tab: HowToPlayTabConfig) => tab.id.length > 0 && tab.label.length > 0 && tab.markdown.length > 0);

      if (tabs.length === 0) {
        throw new Error('No tabs defined in config');
      }

      this.howToPlayConfig = {
        title: rawConfig?.title,
        defaultTabId: rawConfig?.defaultTabId,
        tabs
      };

      for (const tab of tabs) {
        const button = document.createElement('button');
        button.className = 'howto-tab';
        button.textContent = tab.label;
        button.addEventListener('click', () => {
          void this.selectHowToPlayTab(tab.id);
        });
        this.howToPlayTabs.appendChild(button);
        this.howToPlayTabButtons.set(tab.id, button);
      }

      const defaultTabId = this.howToPlayConfig.defaultTabId;
      const initialTabId = defaultTabId && this.howToPlayTabButtons.has(defaultTabId)
        ? defaultTabId
        : tabs[0].id;
      await this.selectHowToPlayTab(initialTabId);
    } catch (error) {
      console.error('Failed to load How To Play config:', error);
      this.howToPlayContent.textContent = 'Failed to load How To Play content.';
    }
  }

  /**
   * Switches to the selected How To Play tab
   *
   * @param tabId - Tab identifier to load
   * @private
   */
  private async selectHowToPlayTab(tabId: string): Promise<void> {
    if (!this.howToPlayConfig || !this.howToPlayContent) return;
    const tab = this.howToPlayConfig.tabs.find((entry) => entry.id === tabId);
    if (!tab) return;

    this.activeHowToPlayTabId = tabId;
    for (const [id, button] of this.howToPlayTabButtons.entries()) {
      button.dataset.active = id === tabId ? 'true' : 'false';
    }

    this.howToPlayContent.textContent = 'Loading...';
    try {
      const configUrl = new URL(HOW_TO_PLAY_CONFIG_URL, window.location.href);
      const markdownUrl = new URL(tab.markdown, configUrl).toString();
      const response = await fetch(markdownUrl, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Failed to load tab (${response.status})`);
      }
      const markdown = await response.text();
      this.howToPlayContent.innerHTML = this.renderHowToPlayMarkdown(markdown, markdownUrl);
      this.howToPlayContent.scrollTop = 0;
    } catch (error) {
      console.error('Failed to load How To Play tab:', error);
      this.howToPlayContent.textContent = 'Failed to load this tab.';
    }
  }

  /**
   * Renders markdown content into HTML
   *
   * @param markdown - Markdown source
   * @param baseUrl - Base URL for resolving assets
   * @returns Rendered HTML string
   * @private
   */
  private renderHowToPlayMarkdown(markdown: string, baseUrl: string): string {
    const lines = markdown.replace(/\r/g, '').split('\n');
    const html: string[] = [];
    let inList = false;

    const closeList = () => {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        closeList();
        continue;
      }

      const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
      if (headingMatch) {
        closeList();
        const level = headingMatch[1].length;
        html.push(`<h${level}>${this.renderMarkdownInline(headingMatch[2], baseUrl)}</h${level}>`);
        continue;
      }

      if (/^[-*+]\s+/.test(line)) {
        if (!inList) {
          html.push('<ul>');
          inList = true;
        }
        html.push(`<li>${this.renderMarkdownInline(line.replace(/^[-*+]\s+/, ''), baseUrl)}</li>`);
        continue;
      }

      if (/^(-{3,}|\*{3,})$/.test(line)) {
        closeList();
        html.push('<hr />');
        continue;
      }

      closeList();
      html.push(`<p>${this.renderMarkdownInline(line, baseUrl)}</p>`);
    }

    closeList();
    return html.join('');
  }

  /**
   * Renders inline markdown elements for a line of text
   *
   * @param text - Inline markdown content
   * @param baseUrl - Base URL for resolving links/images
   * @returns HTML string
   * @private
   */
  private renderMarkdownInline(text: string, baseUrl: string): string {
    const segments: string[] = [];
    const tokenRegex = /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    const renderText = (segment: string): string => {
      let html = this.escapeHtml(segment);
      html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
      html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
      return html;
    };

    while ((match = tokenRegex.exec(text)) !== null) {
      segments.push(renderText(text.slice(lastIndex, match.index)));
      if (match[1] !== undefined) {
        const altText = this.escapeHtml(match[1]);
        const url = this.resolveHowToPlayUrl(match[2], baseUrl);
        segments.push(`<img src="${this.escapeHtml(url)}" alt="${altText}" />`);
      } else if (match[3] !== undefined) {
        const label = renderText(match[3]);
        const url = this.resolveHowToPlayUrl(match[4], baseUrl);
        segments.push(`<a href="${this.escapeHtml(url)}" target="_blank" rel="noopener">${label}</a>`);
      }
      lastIndex = match.index + match[0].length;
    }

    segments.push(renderText(text.slice(lastIndex)));
    return segments.join('');
  }

  /**
   * Escapes HTML entities
   *
   * @param value - Raw text
   * @returns Escaped text
   * @private
   */
  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Resolves relative URLs in markdown to absolute URLs
   *
   * @param url - Raw URL from markdown
   * @param baseUrl - Base URL for the markdown file
   * @returns Resolved URL string
   * @private
   */
  private resolveHowToPlayUrl(url: string, baseUrl: string): string {
    const trimmed = url.trim();
    if (/^(https?:|data:|blob:|\/)/.test(trimmed)) {
      return trimmed;
    }
    try {
      return new URL(trimmed, baseUrl).toString();
    } catch {
      return trimmed;
    }
  }

  /**
   * Cleans up How To Play overlay elements
   *
   * @private
   */
  private cleanupHowToPlayOverlay(): void {
    if (this.howToPlayOverlay) {
      this.howToPlayOverlay.remove();
      this.howToPlayOverlay = null;
    }
    this.howToPlayPanel = null;
    this.howToPlayTabs = null;
    this.howToPlayContent = null;
    this.howToPlayCloseButton = null;
    this.howToPlayConfig = null;
    this.howToPlayTabButtons.clear();
    this.activeHowToPlayTabId = null;
    if (this.howToPlayStyleTag) {
      this.howToPlayStyleTag.remove();
      this.howToPlayStyleTag = null;
    }
  }

  /**
   * Helper to create an image-based button
   * 
   * @param x - X position
   * @param y - Y position
   * @param text - Button label
   * @param normalTexture - Normal state texture
   * @param pressedTexture - Pressed state texture
   * @param onClick - Click handler
   * @returns Button container
   * @private
   */
  private createImageButton(
    x: number,
    y: number,
    text: string,
    normalTexture: string,
    pressedTexture: string,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    
    const bgNormal = this.add.image(0, 0, normalTexture);
    const bgPressed = this.add.image(0, 0, pressedTexture);
    bgPressed.setVisible(false);
    
    const buttonText = this.add.text(0, -5, text, {
      fontFamily: 'BoldPixels, Arial',
      fontSize: '30px',
      color: '#ffffff',
      stroke: '#000000ff',
      strokeThickness: 8
    }).setOrigin(0.5);
    
    container.add([bgNormal, bgPressed, buttonText]);
    
    const hitWidth = bgNormal.width;
    const hitHeight = bgNormal.height;
    container.setSize(hitWidth, hitHeight);
    container.setInteractive({ useHandCursor: true });
    
    container.on('pointerover', () => {
      container.setScale(SCALE.BUTTON_HOVER);
    });
    
    container.on('pointerout', () => {
      container.setScale(1);
      bgNormal.setVisible(true);
      bgPressed.setVisible(false);
    });
    
    container.on('pointerdown', () => {
      bgNormal.setVisible(false);
      bgPressed.setVisible(true);
      container.setScale(SCALE.BUTTON_PRESS);
    });
    
    container.on('pointerup', () => {
      bgNormal.setVisible(true);
      bgPressed.setVisible(false);
      container.setScale(SCALE.BUTTON_HOVER);
      onClick();
    });
    
    return container;
  }

  /**
   * Opens an external URL in a new tab
   * 
   * @param url - URL to open
   * @private
   */
  private openExternalLink(url: string): void {
    window.open(url, '_blank');
  }

  /**
   * Handles Join Queue button click
   * 
   * @private
   */
  private async onJoinQueue(): Promise<void> {
    if (this.isWaitingForMatch) return;
    const name = this.nameInput?.value.trim() || '';
    if (name.length < 1) {
      this.statusText.setText('PLEASE ENTER A NAME!');
      this.statusText.setColor('#ff6666');
      return;
    }

    const trimmed = name.slice(0, NETWORK.MAX_NAME_LENGTH);
    if (this.nameInput) {
      this.nameInput.value = trimmed;
    }
    this.savePlayerName(trimmed);
    this.setWaitingState(true);
    this.statusText.setText('CONNECTING...');
    this.statusText.setColor('#ffcc00');
    
    try {
      await this.networkManager?.joinRoom(DEFAULT_ROOM_ID);
    } catch (error) {
      console.error('Failed to join room:', error);
      this.statusText.setText('CONNECTION FAILEDPLEASE TRY AGAIN.');
      this.statusText.setColor('#ff6666');
      this.setWaitingState(false);
    }
  }

  /**
   * Handles Cancel button click
   * 
   * @private
   */
  private onCancelQueue(): void {
    this.networkManager?.leaveRoom();
    this.setWaitingState(false);
    this.statusText.setText('');
  }

  /**
   * Toggles UI between normal and waiting states
   * 
   * @param waiting - Whether waiting for opponent
   * @private
   */
  private setWaitingState(waiting: boolean): void {
    this.isWaitingForMatch = waiting;
    this.joinButton.setVisible(!waiting);
    this.cancelButton.setVisible(waiting);
    
    if (this.nameInput) {
      this.nameInput.disabled = waiting;
      this.nameInput.style.opacity = waiting ? '0.5' : '1';
    }
  }

  /**
   * Sets up callbacks for network events
   * 
   * @private
   */
  private setupNetworkCallbacks(): void {
    if (!this.networkManager) return;
    
    this.networkManager.onConnectionStateChange((state) => {
      this.connectionState = state;
      this.updateStatusFromConnectionState(state);
    });
    
    this.networkManager.onPeerJoined((peerId) => {
      console.log('Peer joined:', peerId);
      this.statusText.setText('OPPONENT FOUND! STARTING GAME...');
      this.statusText.setColor('#66ff66');
    });
    
    this.networkManager.onPeerLeft((peerId) => {
      console.log('Peer left:', peerId);
      this.statusText.setText('OPPONENT DISCONNECTED. WAITING...');
      this.statusText.setColor('#ffcc00');
    });
    
    this.networkManager.onColorAssigned((color) => {
      this.localColor = color;
      console.log('Assigned color:', color);
      
      this.time.delayedCall(ANIMATION.GAME_START_DELAY, () => {
        this.startGame();
      });
    });
    
    this.networkManager.onError((error) => {
      console.error('NETWORK ERROR:', error);
      this.statusText.setText('NETWORK ERROR. PLEASE TRY AGAIN.');
      this.statusText.setColor('#ff6666');
      this.setWaitingState(false);
    });
  }

  /**
   * Updates status text based on connection state
   * 
   * @param state - Current connection state
   * @private
   */
  private updateStatusFromConnectionState(state: ConnectionState): void {
    switch (state) {
      case 'connecting':
        this.statusText.setText('CONNECTING TO NETWORK...');
        this.statusText.setColor('#ffcc00');
        break;
      case 'waiting':
        this.statusText.setText('WAITING FOR OPPONENT...');
        this.statusText.setColor('#ffcc00');
        this.startWaitingAnimation();
        break;
      case 'connected':
        this.statusText.setText('OPPONENT FOUND!');
        this.statusText.setColor('#66ff66');
        this.stopWaitingAnimation();
        break;
      case 'disconnected':
        this.stopWaitingAnimation();
        break;
    }
  }

  /** Tween for waiting dots animation */
  private waitingTween: Phaser.Tweens.Tween | null = null;
  
  /** Counter for animated dots */
  private dotCount: number = 0;

  /**
   * Starts the animated dots in waiting text
   * 
   * @private
   */
  private startWaitingAnimation(): void {
    this.stopWaitingAnimation();
    
    this.waitingTween = this.tweens.add({
      targets: {},
      duration: ANIMATION.WAITING_DOTS_INTERVAL,
      repeat: -1,
      onRepeat: () => {
        this.dotCount = (this.dotCount + 1) % 4;
        const dots = '.'.repeat(this.dotCount);
        if (this.connectionState === 'waiting') {
          this.statusText.setText(`Waiting for opponent${dots}`);
        }
      }
    });
  }

  /**
   * Stops the waiting animation
   * 
   * @private
   */
  private stopWaitingAnimation(): void {
    if (this.waitingTween) {
      this.waitingTween.stop();
      this.waitingTween = null;
    }
  }

  /**
   * Starts the game scene with matchmaking data
   * 
   * @private
   */
  private startGame(): void {
    this.cleanupNameInput();
    
    this.scene.start('GameScene', {
      playerName: this.playerName,
      localColor: this.localColor,
      networkManager: this.networkManager,
      opponentName: 'Opponent'
    });
  }

  /**
   * Removes the HTML input element
   * 
   * @private
   */
  private cleanupNameInput(): void {
    if (this.nameInput) {
      this.nameInput.remove();
      this.nameInput = null;
    }
    this.cleanupHowToPlayOverlay();
    this.scale.off('resize', this.handleResize, this);
  }

  /**
   * Called when scene is shut down
   * 
   * Used by: Phaser scene lifecycle
   */
  shutdown(): void {
    this.cleanupNameInput();
    this.stopWaitingAnimation();
  }

  /**
   * Called when scene is destroyed
   * 
   * Used by: Phaser scene lifecycle
   */
  destroy(): void {
    this.cleanupNameInput();
    this.stopWaitingAnimation();
    this.networkManager?.leaveRoom();
  }
}
