/**
 * @fileoverview EndScene - Victory/Defeat/Draw screen with rematch functionality
 * 
 * This scene displays the game result and provides options for rematch
 * or returning to the main menu. Handles P2P rematch negotiation.
 * 
 * Requirements addressed:
 * - 3.9: Display victory/defeat/draw message
 * - 3.9: Show rematch button
 * - 3.9: Show return to menu button
 * - 3.9: Send rematch request via P2P
 * - 3.9: Handle accept/decline
 * - 3.9: Reset game state on rematch
 * 
 * @module scenes/EndScene
 * @requires phaser
 * @requires managers/GameStateManager
 * @requires managers/NetworkManager
 * @requires components/Clock
 * 
 * Used by: GameScene (game end transition)
 */

import Phaser from 'phaser';
import type { PlayerColor } from '../managers/GameStateManager';
import { formatTime } from '../components/Clock';
import { NetworkManager, GameAction } from '../managers/NetworkManager';

/* ============================================
 * TYPE DEFINITIONS
 * ============================================
 */

/**
 * Data passed from GameScene when transitioning to EndScene
 * 
 * @property winner - Winning player color, or null for draw
 * @property reason - Text description of how the game ended
 * @property localColor - Local player's color
 * @property playerName - Local player's name
 * @property opponentName - Opponent's name
 * @property finalStats - Optional game statistics
 * @property networkManager - Network manager for rematch functionality
 */
interface EndSceneData {
  winner: PlayerColor | null;
  reason: string;
  localColor: PlayerColor;
  playerName: string;
  opponentName: string;
  finalStats?: {
    turnNumber: number;
    localClock: number;
    opponentClock: number;
  };
  networkManager: NetworkManager | null;
}

/**
 * States for the rematch negotiation flow
 * 
 * Values:
 * - 'idle': No rematch request active
 * - 'waiting': Local player sent request, waiting for response
 * - 'received': Received request from opponent
 * - 'accepted': Rematch accepted, starting new game
 * - 'declined': Rematch was declined
 */
type RematchState = 'idle' | 'waiting' | 'received' | 'accepted' | 'declined';

/* ============================================
 * END SCENE CLASS
 * ============================================
 */

/**
 * EndScene - Victory/Defeat/Draw screen with rematch options
 * 
 * Displays the game result with:
 * - Large result text (VICTORY/DEFEAT/DRAW)
 * - Reason for game end
 * - Game statistics (turns, clock times)
 * - Rematch button with P2P negotiation
 * - Return to menu button
 * 
 * Rematch flow:
 * 1. Player clicks REMATCH
 * 2. Request sent to opponent via P2P
 * 3. Opponent sees accept/decline buttons
 * 4. If both accept, new game starts with swapped colors
 * 
 * @example
 * // Transition from GameScene
 * this.scene.start('EndScene', {
 *   winner: 'white',
 *   reason: 'King captured!',
 *   localColor: 'white',
 *   playerName: 'Player1',
 *   opponentName: 'Player2',
 *   networkManager: this.networkManager
 * });
 * 
 * Used by: GameScene (game end)
 */
export class EndScene extends Phaser.Scene {
  /* ----------------------------------------
   * Game Result Data
   * ---------------------------------------- */
  
  /** Winning player color, or null for draw */
  private winner: PlayerColor | null = null;
  
  /** Text description of how the game ended */
  private reason: string = '';
  
  /** Local player's color */
  private localColor: PlayerColor = 'white';
  
  /** Local player's name */
  private playerName: string = 'Player';
  
  /** Opponent's name */
  private opponentName: string = 'Opponent';
  
  /** Final game statistics */
  private finalStats: EndSceneData['finalStats'] | null = null;
  
  /** Network manager for rematch functionality */
  private networkManager: NetworkManager | null = null;
  
  /* ----------------------------------------
   * Rematch State
   * ---------------------------------------- */
  
  /** Current state of rematch negotiation */
  private rematchState: RematchState = 'idle';
  
  /* ----------------------------------------
   * UI Elements
   * ---------------------------------------- */
  
  /** Rematch button container */
  private rematchButton: Phaser.GameObjects.Container | null = null;
  
  /** Status text for rematch state feedback */
  private statusText: Phaser.GameObjects.Text | null = null;
  
  /** Accept rematch button */
  private acceptButton: Phaser.GameObjects.Container | null = null;
  
  /** Decline rematch button */
  private declineButton: Phaser.GameObjects.Container | null = null;
  
  /** Container for rematch request UI */
  private rematchRequestContainer: Phaser.GameObjects.Container | null = null;

  constructor() {
    super({ key: 'EndScene' });
  }

  /* ============================================
   * SCENE LIFECYCLE
   * ============================================ */

  /**
   * Initializes scene with data from GameScene
   * 
   * @param data - Game result data
   * 
   * Used by: Phaser scene lifecycle
   */
  init(data: EndSceneData): void {
    this.winner = data?.winner ?? null;
    this.reason = data?.reason ?? 'Game Over';
    this.localColor = data?.localColor ?? 'white';
    this.playerName = data?.playerName ?? 'Player';
    this.opponentName = data?.opponentName ?? 'Opponent';
    this.finalStats = data?.finalStats ?? null;
    this.networkManager = data?.networkManager ?? null;
    this.rematchState = 'idle';
  }

  /**
   * Creates all scene elements
   * 
   * Algorithm:
   * 1. Set up background
   * 2. Determine and display result (victory/defeat/draw)
   * 3. Show game statistics
   * 4. Create rematch and menu buttons
   * 5. Set up network callbacks for rematch
   * 
   * Used by: Phaser scene lifecycle
   */
  create(): void {
    const { width, height } = this.scale;
    
    // Add background
    if (this.textures.exists('room_background')) {
      const bg = this.add.image(width / 2, height / 2, 'room_background');
      const scale = Math.max(width / bg.width, height / bg.height);
      bg.setScale(scale);
    } else if (this.textures.exists('background')) {
      this.add.image(width / 2, height / 2, 'background')
        .setDisplaySize(width, height);
    } else {
      this.cameras.main.setBackgroundColor(0x1a472a);
    }

    // Determine result text and color
    let resultText: string;
    let resultColor: string;
    
    if (this.winner === null) {
      // Draw
      resultText = 'DRAW';
      resultColor = '#ffff00';
    } else if (this.winner === this.localColor) {
      // Victory
      resultText = 'VICTORY!';
      resultColor = '#00ff00';
    } else {
      // Defeat
      resultText = 'DEFEAT';
      resultColor = '#ff0000';
    }
    
    // Result text (large)
    this.add.text(width / 2, height * 0.23, resultText, {
      fontFamily: 'BoldPixels, Arial',
      fontSize: '72px',
      color: resultColor,
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);
    
    // Reason text
    this.add.text(width / 2, height * 0.34, this.reason, {
      fontFamily: 'BoldPixels, Arial',
      fontSize: '28px',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    // Winner name display
    const winnerName = this.winner === 'white' 
      ? (this.localColor === 'white' ? this.playerName : this.opponentName)
      : this.winner === 'black'
        ? (this.localColor === 'black' ? this.playerName : this.opponentName)
        : null;
    
    if (winnerName) {
      this.add.text(width / 2, height * 0.43, `Winner: ${winnerName}`, {
        fontFamily: 'BoldPixels, Arial',
        fontSize: '24px',
        color: '#cccccc'
      }).setOrigin(0.5);
    }
    
    // Summary panel with game statistics
    this.createSummaryPanel(width, height);
    
    // Status text for rematch state
    this.statusText = this.add.text(width / 2, height * 0.68, '', {
      fontFamily: 'BoldPixels, Arial',
      fontSize: '20px',
      color: '#ffcc00'
    }).setOrigin(0.5);
    
    // Rematch button
    this.rematchButton = this.createButton(
      width / 2,
      height * 0.76,
      'REMATCH',
      0x4a7c59,
      () => this.handleRematchRequest()
    );
    
    // Return to menu button
    this.createButton(
      width / 2,
      height * 0.88,
      'MAIN MENU',
      0x5a5a8a,
      () => this.handleReturnToMenu()
    );
    
    // Create rematch request UI (hidden initially)
    this.createRematchRequestUI(width, height);
    
    // Setup network callbacks for rematch
    this.setupNetworkCallbacks();
  }

  /**
   * Creates the summary panel with game statistics
   * 
   * @param width - Screen width
   * @param height - Screen height
   * @private
   */
  private createSummaryPanel(width: number, height: number): void {
    const panelWidth = Math.min(560, width * 0.8);
    const panelHeight = 130;
    const panelY = height * 0.54;
    
    // Panel background
    const panel = this.add.graphics();
    panel.fillStyle(0x0f0f1f, 0.7);
    panel.fillRoundedRect(width / 2 - panelWidth / 2, panelY - panelHeight / 2, panelWidth, panelHeight, 12);
    panel.lineStyle(2, 0xffffff, 0.2);
    panel.strokeRoundedRect(width / 2 - panelWidth / 2, panelY - panelHeight / 2, panelWidth, panelHeight, 12);
    
    // Determine player names and clock times
    const whiteName = this.localColor === 'white' ? this.playerName : this.opponentName;
    const blackName = this.localColor === 'black' ? this.playerName : this.opponentName;
    const whiteClock = this.finalStats
      ? (this.localColor === 'white' ? this.finalStats.localClock : this.finalStats.opponentClock)
      : 0;
    const blackClock = this.finalStats
      ? (this.localColor === 'black' ? this.finalStats.localClock : this.finalStats.opponentClock)
      : 0;
    
    // White player info
    this.add.text(width / 2 - panelWidth * 0.22, panelY - 20, `White: ${whiteName}`, {
      fontFamily: 'BoldPixels, Arial',
      fontSize: '18px',
      color: '#ffffff'
    }).setOrigin(0, 0.5);
    
    this.add.text(width / 2 + panelWidth * 0.22, panelY - 20, this.finalStats ? formatTime(whiteClock) : '--:--', {
      fontFamily: 'Digital7, "Courier New"',
      fontSize: '22px',
      color: '#ffffff'
    }).setOrigin(1, 0.5);
    
    // Black player info
    this.add.text(width / 2 - panelWidth * 0.22, panelY + 20, `Black: ${blackName}`, {
      fontFamily: 'BoldPixels, Arial',
      fontSize: '18px',
      color: '#cccccc'
    }).setOrigin(0, 0.5);
    
    this.add.text(width / 2 + panelWidth * 0.22, panelY + 20, this.finalStats ? formatTime(blackClock) : '--:--', {
      fontFamily: 'Digital7, "Courier New"',
      fontSize: '22px',
      color: '#cccccc'
    }).setOrigin(1, 0.5);
    
    // Turn count
    if (this.finalStats) {
      this.add.text(width / 2, panelY + panelHeight / 2 - 16, `Turns: ${this.finalStats.turnNumber}`, {
        fontFamily: 'BoldPixels, Arial',
        fontSize: '14px',
        color: '#aaaaaa'
      }).setOrigin(0.5);
    }
  }

  /**
   * Creates the rematch request UI (accept/decline buttons)
   * Shown when opponent requests a rematch
   * 
   * @param width - Screen width
   * @param height - Screen height
   * @private
   */
  private createRematchRequestUI(width: number, height: number): void {
    this.rematchRequestContainer = this.add.container(width / 2, height * 0.76);
    this.rematchRequestContainer.setVisible(false);
    
    // Request text
    const requestText = this.add.text(0, -50, 'Opponent wants a rematch!', {
      fontFamily: 'BoldPixels, Arial',
      fontSize: '24px',
      color: '#ffcc00'
    }).setOrigin(0.5);
    
    // Accept button
    this.acceptButton = this.createButtonForContainer(
      -80, 10,
      'ACCEPT',
      0x4a7c59,
      () => this.handleAcceptRematch(),
      140
    );
    
    // Decline button
    this.declineButton = this.createButtonForContainer(
      80, 10,
      'DECLINE',
      0x8b4513,
      () => this.handleDeclineRematch(),
      140
    );
    
    this.rematchRequestContainer.add([requestText, this.acceptButton, this.declineButton]);
  }

  /* ============================================
   * NETWORK CALLBACKS
   * ============================================ */

  /**
   * Sets up network callbacks for rematch flow
   * 
   * @private
   */
  private setupNetworkCallbacks(): void {
    if (!this.networkManager) return;
    
    this.networkManager.onAction((action: GameAction, _peerId: string) => {
      switch (action.type) {
        case 'REMATCH_REQUEST':
          this.handleRematchReceived();
          break;
        case 'REMATCH_ACCEPT':
          this.handleRematchAccepted();
          break;
        case 'REMATCH_DECLINE':
          this.handleRematchDeclined();
          break;
      }
    });
    
    this.networkManager.onPeerLeft((_peerId: string) => {
      this.updateStatus('Opponent disconnected', '#ff6666');
      this.showMainButtons();
    });
  }

  /* ============================================
   * REMATCH HANDLING
   * ============================================ */

  /**
   * Handles local player requesting rematch
   * Sends request to opponent via P2P
   * 
   * @private
   */
  private handleRematchRequest(): void {
    if (this.rematchState !== 'idle') return;
    
    this.rematchState = 'waiting';
    this.updateStatus('Waiting for opponent...', '#ffcc00');
    
    // Disable rematch button while waiting
    if (this.rematchButton) {
      this.rematchButton.disableInteractive();
      this.rematchButton.setAlpha(0.5);
    }
    
    // Send rematch request via P2P
    this.networkManager?.sendRematchRequest();
  }

  /**
   * Handles receiving rematch request from opponent
   * Shows accept/decline UI
   * 
   * @private
   */
  private handleRematchReceived(): void {
    // If we were also waiting, auto-accept (both players clicked rematch)
    if (this.rematchState === 'waiting') {
      this.handleAcceptRematch();
      return;
    }
    
    this.rematchState = 'received';
    this.updateStatus('', '#ffffff');
    
    // Hide main buttons and show accept/decline
    this.hideMainButtons();
    this.showRematchRequestUI();
  }

  /**
   * Handles accepting rematch
   * Sends accept to opponent and starts new game
   * 
   * @private
   */
  private handleAcceptRematch(): void {
    this.rematchState = 'accepted';
    this.updateStatus('Starting rematch...', '#66ff66');
    
    // Send accept via P2P
    this.networkManager?.sendRematchAccept();
    
    // Start new game
    this.startRematch();
  }

  /**
   * Handles declining rematch
   * Sends decline to opponent and returns to idle state
   * 
   * @private
   */
  private handleDeclineRematch(): void {
    this.rematchState = 'declined';
    
    // Send decline via P2P
    this.networkManager?.sendRematchDecline();
    
    // Show main buttons again
    this.hideRematchRequestUI();
    this.showMainButtons();
    this.updateStatus('Rematch declined', '#ff6666');
    
    // Reset state after delay
    this.time.delayedCall(2000, () => {
      this.rematchState = 'idle';
      this.updateStatus('', '#ffffff');
    });
  }

  /**
   * Handles opponent accepting rematch
   * 
   * @private
   */
  private handleRematchAccepted(): void {
    this.rematchState = 'accepted';
    this.updateStatus('Opponent accepted! Starting...', '#66ff66');
    
    // Start new game
    this.startRematch();
  }

  /**
   * Handles opponent declining rematch
   * 
   * @private
   */
  private handleRematchDeclined(): void {
    this.rematchState = 'idle';
    this.updateStatus('Opponent declined rematch', '#ff6666');
    
    // Re-enable rematch button
    if (this.rematchButton) {
      this.rematchButton.setInteractive({ useHandCursor: true });
      this.rematchButton.setAlpha(1);
    }
    
    // Clear status after delay
    this.time.delayedCall(2000, () => {
      this.updateStatus('', '#ffffff');
    });
  }

  /**
   * Starts a rematch game with swapped colors
   * 
   * @private
   */
  private startRematch(): void {
    // Swap colors for rematch
    const newLocalColor: PlayerColor = this.localColor === 'white' ? 'black' : 'white';
    
    this.time.delayedCall(500, () => {
      this.scene.start('GameScene', {
        playerName: this.playerName,
        localColor: newLocalColor,
        networkManager: this.networkManager,
        opponentName: this.opponentName
      });
    });
  }

  /**
   * Handles returning to main menu
   * Disconnects from P2P network
   * 
   * @private
   */
  private handleReturnToMenu(): void {
    // Disconnect from P2P
    this.networkManager?.leaveRoom();
    
    this.scene.start('MenuScene');
  }

  /* ============================================
   * UI HELPERS
   * ============================================ */

  /**
   * Updates status text
   * 
   * @param text - Status message
   * @param color - Text color
   * @private
   */
  private updateStatus(text: string, color: string): void {
    if (this.statusText) {
      this.statusText.setText(text);
      this.statusText.setColor(color);
    }
  }

  /**
   * Hides main buttons (rematch and menu)
   * 
   * @private
   */
  private hideMainButtons(): void {
    if (this.rematchButton) {
      this.rematchButton.setVisible(false);
    }
  }

  /**
   * Shows main buttons
   * 
   * @private
   */
  private showMainButtons(): void {
    if (this.rematchButton) {
      this.rematchButton.setVisible(true);
      this.rematchButton.setInteractive({ useHandCursor: true });
      this.rematchButton.setAlpha(1);
    }
  }

  /**
   * Shows rematch request UI
   * 
   * @private
   */
  private showRematchRequestUI(): void {
    if (this.rematchRequestContainer) {
      this.rematchRequestContainer.setVisible(true);
    }
  }

  /**
   * Hides rematch request UI
   * 
   * @private
   */
  private hideRematchRequestUI(): void {
    if (this.rematchRequestContainer) {
      this.rematchRequestContainer.setVisible(false);
    }
  }

  /**
   * Creates a button
   * 
   * @param x - X position
   * @param y - Y position
   * @param text - Button label
   * @param color - Background color
   * @param onClick - Click handler
   * @param buttonWidth - Button width
   * @returns Button container
   * @private
   */
  private createButton(
    x: number,
    y: number,
    text: string,
    color: number,
    onClick: () => void,
    buttonWidth: number = 250
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    
    // Button background
    const bg = this.add.graphics();
    bg.fillStyle(color, 1);
    bg.fillRoundedRect(-buttonWidth / 2, -30, buttonWidth, 60, 10);
    bg.lineStyle(3, 0xffffff, 0.3);
    bg.strokeRoundedRect(-buttonWidth / 2, -30, buttonWidth, 60, 10);
    
    // Button text
    const buttonText = this.add.text(0, 0, text, {
      fontFamily: 'BoldPixels, Arial',
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    container.add([bg, buttonText]);
    
    // Make interactive
    container.setSize(buttonWidth, 60);
    container.setInteractive({ useHandCursor: true });
    
    // Hover effects
    container.on('pointerover', () => container.setScale(1.05));
    container.on('pointerout', () => container.setScale(1));
    container.on('pointerdown', () => container.setScale(0.95));
    container.on('pointerup', () => {
      container.setScale(1.05);
      onClick();
    });
    
    return container;
  }

  /**
   * Creates a button for use inside a container
   * 
   * @param x - X position relative to container
   * @param y - Y position relative to container
   * @param text - Button label
   * @param color - Background color
   * @param onClick - Click handler
   * @param buttonWidth - Button width
   * @returns Button container
   * @private
   */
  private createButtonForContainer(
    x: number,
    y: number,
    text: string,
    color: number,
    onClick: () => void,
    buttonWidth: number = 140
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    
    // Button background
    const bg = this.add.graphics();
    bg.fillStyle(color, 1);
    bg.fillRoundedRect(-buttonWidth / 2, -25, buttonWidth, 50, 8);
    bg.lineStyle(2, 0xffffff, 0.3);
    bg.strokeRoundedRect(-buttonWidth / 2, -25, buttonWidth, 50, 8);
    
    // Button text
    const buttonText = this.add.text(0, 0, text, {
      fontFamily: 'BoldPixels, Arial',
      fontSize: '20px',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    container.add([bg, buttonText]);
    
    // Make interactive
    container.setSize(buttonWidth, 50);
    container.setInteractive({ useHandCursor: true });
    
    // Hover effects
    container.on('pointerover', () => container.setScale(1.05));
    container.on('pointerout', () => container.setScale(1));
    container.on('pointerdown', () => container.setScale(0.95));
    container.on('pointerup', () => {
      container.setScale(1.05);
      onClick();
    });
    
    return container;
  }

  /* ============================================
   * CLEANUP
   * ============================================ */

  /**
   * Called when scene shuts down
   * Cleans up resources
   * 
   * Used by: Phaser scene lifecycle
   */
  shutdown(): void {
    // Remove network callbacks to prevent memory leaks
    // The network manager will be reused or cleaned up by the next scene
  }
}
