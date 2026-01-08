import Phaser from 'phaser';
import { NetworkManager, ConnectionState } from '../managers/NetworkManager';
import type { PlayerColor } from '../managers/GameStateManager';

/**
 * MenuScene - Main menu with name input and matchmaking
 * 
 * Requirements:
 * - 1.1: Display main menu with name input field
 * - 1.2: Store player name in localStorage
 * - 1.3: Connect to Trystero P2P network on "Join Queue"
 * - 1.4: Establish direct WebRTC connection
 * - 1.5: Start new game with random color assignment
 * - 1.6: Display Ko-fi donation button
 * - 1.7: Display Discord redirect link
 */

const STORAGE_KEY = 'card_chess_player_name';
const DEFAULT_ROOM_ID = 'card-chess-matchmaking-lobby';
const KOFI_URL = 'https://ko-fi.com/cardchess';
const BUG_REPORT_URL = 'https://github.com/cardchess/issues';

// Base design dimensions (UI is designed for this size)
const BASE_HEIGHT = 1080;

export class MenuScene extends Phaser.Scene {
  private networkManager: NetworkManager | null = null;
  private nameInput: HTMLInputElement | null = null;
  private playerName: string = '';
  private connectionState: ConnectionState = 'disconnected';
  private localColor: PlayerColor | null = null;
  
  // UI Elements
  private background!: Phaser.GameObjects.Image;
  private uiContainer!: Phaser.GameObjects.Container;
  private joinButton!: Phaser.GameObjects.Container;
  private statusText!: Phaser.GameObjects.Text;
  private cancelButton!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'MenuScene' });
  }

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
   * Scale background to cover entire viewport (may crop edges)
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
   * Handle window resize
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
   * Load player name from localStorage
   */
  private loadPlayerName(): void {
    const savedName = localStorage.getItem(STORAGE_KEY);
    if (savedName) {
      this.playerName = savedName;
    }
  }

  /**
   * Save player name to localStorage
   */
  private savePlayerName(name: string): void {
    this.playerName = name;
    localStorage.setItem(STORAGE_KEY, name);
  }

  /**
   * Create title text
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
   * Create name input field using HTML input
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
      color: rgba(227, 205, 105, 1);
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
   * Position the HTML input element to match Phaser canvas
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
   * Create Join Queue button
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
   * Create Bug Report button
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
   * Create Ko-fi donation button
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
   * Create status text for matchmaking feedback
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
   * Create cancel button (hidden by default)
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

  private openExternalLink(url: string): void {
    window.open(url, '_blank');
  }

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

  private onCancelQueue(): void {
    this.networkManager?.leaveRoom();
    this.setWaitingState(false);
    this.statusText.setText('');
  }

  private setWaitingState(waiting: boolean): void {
    this.joinButton.setVisible(!waiting);
    this.cancelButton.setVisible(waiting);
    
    if (this.nameInput) {
      this.nameInput.disabled = waiting;
      this.nameInput.style.opacity = waiting ? '0.5' : '1';
    }
  }

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

  private waitingTween: Phaser.Tweens.Tween | null = null;
  private dotCount: number = 0;

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

  private stopWaitingAnimation(): void {
    if (this.waitingTween) {
      this.waitingTween.stop();
      this.waitingTween = null;
    }
  }

  private startGame(): void {
    this.cleanupNameInput();
    
    this.scene.start('GameScene', {
      playerName: this.playerName,
      localColor: this.localColor,
      networkManager: this.networkManager,
      opponentName: 'Opponent'
    });
  }

  private cleanupNameInput(): void {
    if (this.nameInput) {
      this.nameInput.remove();
      this.nameInput = null;
    }
    this.scale.off('resize', this.handleResize, this);
  }

  shutdown(): void {
    this.cleanupNameInput();
    this.stopWaitingAnimation();
  }

  destroy(): void {
    this.cleanupNameInput();
    this.stopWaitingAnimation();
    this.networkManager?.leaveRoom();
  }
}
