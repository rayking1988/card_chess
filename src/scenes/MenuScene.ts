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

/* ============================================
 * CONFIGURATION CONSTANTS
 * ============================================
 */

/** LocalStorage key for persisting player name (Requirement 1.2) */
const STORAGE_KEY = 'card_chess_player_name';

/** Default room ID for matchmaking lobby */
const DEFAULT_ROOM_ID = 'card-chess-matchmaking-lobby';

/** Ko-fi donation page URL (Requirement 1.6) */
const KOFI_URL = 'https://ko-fi.com/cardchess';

/** GitHub issues page for bug reports */
const BUG_REPORT_URL = 'https://github.com/cardchess/issues';

/** Base design height for UI scaling calculations */
const BASE_HEIGHT = 1080;

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
    this.createJoinButton();
    this.createBugReportButton();
    this.createKofiButton();
    this.createStatusText();
    this.createCancelButton();
    
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
    this.playerName = name;
    localStorage.setItem(STORAGE_KEY, name);
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
    
    // Subtitle
    const subtitle = this.add.text(0, -BASE_HEIGHT * 0.28, 'Chess meets Cards', {
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
    const label = this.add.text(0, -BASE_HEIGHT * 0.15, 'Enter Your Name:', {
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
    this.nameInput.maxLength = 20;
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
      if (this.nameInput) {
        this.savePlayerName(this.nameInput.value);
      }
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
   * Creates the Join Queue button
   * 
   * @private
   */
  private createJoinButton(): void {
    this.joinButton = this.createImageButton(
      0,
      BASE_HEIGHT * 0.07,
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
      BASE_HEIGHT * 0.20,
      'REPORT A BUG',
      'yellow_button',
      'yellow_button_pressed',
      () => this.openExternalLink(BUG_REPORT_URL)
    );
    this.uiContainer.add(btn);
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
      BASE_HEIGHT * 0.32,
      'SUPPORT ON KO-FI',
      'brown_button',
      'brown_button_pressed',
      () => this.openExternalLink(KOFI_URL)
    );
    this.uiContainer.add(btn);
  }

  /**
   * Creates the status text for matchmaking feedback
   * 
   * @private
   */
  private createStatusText(): void {
    this.statusText = this.add.text(0, BASE_HEIGHT * 0.42, '', {
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
      BASE_HEIGHT * 0.07,
      'CANCEL',
      'red_button',
      'red_button_pressed',
      () => this.onCancelQueue()
    );
    this.cancelButton.setVisible(false);
    this.uiContainer.add(this.cancelButton);
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
      container.setScale(1.05);
    });
    
    container.on('pointerout', () => {
      container.setScale(1);
      bgNormal.setVisible(true);
      bgPressed.setVisible(false);
    });
    
    container.on('pointerdown', () => {
      bgNormal.setVisible(false);
      bgPressed.setVisible(true);
      container.setScale(0.98);
    });
    
    container.on('pointerup', () => {
      bgNormal.setVisible(true);
      bgPressed.setVisible(false);
      container.setScale(1.05);
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
    const name = this.nameInput?.value.trim() || '';
    if (name.length < 1) {
      this.statusText.setText('Please enter a name!');
      this.statusText.setColor('#ff6666');
      return;
    }
    
    this.savePlayerName(name);
    this.setWaitingState(true);
    this.statusText.setText('Connecting...');
    this.statusText.setColor('#ffcc00');
    
    try {
      await this.networkManager?.joinRoom(DEFAULT_ROOM_ID);
    } catch (error) {
      console.error('Failed to join room:', error);
      this.statusText.setText('Connection failed. Try again.');
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
      this.statusText.setText('Opponent found! Starting game...');
      this.statusText.setColor('#66ff66');
    });
    
    this.networkManager.onPeerLeft((peerId) => {
      console.log('Peer left:', peerId);
      this.statusText.setText('Opponent disconnected. Waiting...');
      this.statusText.setColor('#ffcc00');
    });
    
    this.networkManager.onColorAssigned((color) => {
      this.localColor = color;
      console.log('Assigned color:', color);
      
      this.time.delayedCall(1000, () => {
        this.startGame();
      });
    });
    
    this.networkManager.onError((error) => {
      console.error('Network error:', error);
      this.statusText.setText('Network error. Try again.');
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
        this.statusText.setText('Connecting to network...');
        this.statusText.setColor('#ffcc00');
        break;
      case 'waiting':
        this.statusText.setText('Waiting for opponent...');
        this.statusText.setColor('#ffcc00');
        this.startWaitingAnimation();
        break;
      case 'connected':
        this.statusText.setText('Opponent found!');
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
      duration: 500,
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
