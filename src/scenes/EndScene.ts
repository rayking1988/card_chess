/**
 * EndScene - Victory/Defeat/Draw screen with rematch and menu options
 * 
 * Requirements: 3.9
 * - Display victory/defeat/draw message
 * - Show rematch button
 * - Show return to menu button
 * - Send rematch request via P2P
 * - Handle accept/decline
 * - Reset game state on rematch
 */

import Phaser from 'phaser';
import type { PlayerColor } from '../managers/GameStateManager';
import { NetworkManager, GameAction } from '../managers/NetworkManager';

interface EndSceneData {
  winner: PlayerColor | null;
  reason: string;
  localColor: PlayerColor;
  playerName: string;
  opponentName: string;
  networkManager: NetworkManager | null;
}

type RematchState = 'idle' | 'waiting' | 'received' | 'accepted' | 'declined';

export class EndScene extends Phaser.Scene {
  private winner: PlayerColor | null = null;
  private reason: string = '';
  private localColor: PlayerColor = 'white';
  private playerName: string = 'Player';
  private opponentName: string = 'Opponent';
  private networkManager: NetworkManager | null = null;
  
  // Rematch state
  private rematchState: RematchState = 'idle';
  
  // UI Elements
  private rematchButton: Phaser.GameObjects.Container | null = null;
  private statusText: Phaser.GameObjects.Text | null = null;
  private acceptButton: Phaser.GameObjects.Container | null = null;
  private declineButton: Phaser.GameObjects.Container | null = null;
  private rematchRequestContainer: Phaser.GameObjects.Container | null = null;

  constructor() {
    super({ key: 'EndScene' });
  }

  init(data: EndSceneData): void {
    this.winner = data?.winner ?? null;
    this.reason = data?.reason ?? 'Game Over';
    this.localColor = data?.localColor ?? 'white';
    this.playerName = data?.playerName ?? 'Player';
    this.opponentName = data?.opponentName ?? 'Opponent';
    this.networkManager = data?.networkManager ?? null;
    this.rematchState = 'idle';
  }

  create(): void {
    const { width, height } = this.scale;
    
    // Add background
    if (this.textures.exists('background')) {
      this.add.image(width / 2, height / 2, 'background')
        .setDisplaySize(width, height);
    } else {
      this.cameras.main.setBackgroundColor(0x1a472a);
    }

    // Determine result
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
    this.add.text(width / 2, height * 0.25, resultText, {
      fontFamily: 'BoldPixels, Arial',
      fontSize: '72px',
      color: resultColor,
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);
    
    // Reason text
    this.add.text(width / 2, height * 0.38, this.reason, {
      fontFamily: 'BoldPixels, Arial',
      fontSize: '28px',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    // Player info
    const winnerName = this.winner === 'white' 
      ? (this.localColor === 'white' ? this.playerName : this.opponentName)
      : this.winner === 'black'
        ? (this.localColor === 'black' ? this.playerName : this.opponentName)
        : null;
    
    if (winnerName) {
      this.add.text(width / 2, height * 0.48, `Winner: ${winnerName}`, {
        fontFamily: 'BoldPixels, Arial',
        fontSize: '24px',
        color: '#cccccc'
      }).setOrigin(0.5);
    }
    
    // Status text for rematch state
    this.statusText = this.add.text(width / 2, height * 0.55, '', {
      fontFamily: 'BoldPixels, Arial',
      fontSize: '20px',
      color: '#ffcc00'
    }).setOrigin(0.5);
    
    // Rematch button
    this.rematchButton = this.createButton(
      width / 2,
      height * 0.65,
      'REMATCH',
      0x4a7c59,
      () => this.handleRematchRequest()
    );
    
    // Return to menu button
    this.createButton(
      width / 2,
      height * 0.78,
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
   * Create the rematch request UI (accept/decline buttons)
   */
  private createRematchRequestUI(width: number, height: number): void {
    this.rematchRequestContainer = this.add.container(width / 2, height * 0.65);
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

  /**
   * Setup network callbacks for rematch flow
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

  /**
   * Handle local player requesting rematch
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
   * Handle receiving rematch request from opponent
   */
  private handleRematchReceived(): void {
    // If we were also waiting, auto-accept
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
   * Handle accepting rematch
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
   * Handle declining rematch
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
   * Handle opponent accepting rematch
   */
  private handleRematchAccepted(): void {
    this.rematchState = 'accepted';
    this.updateStatus('Opponent accepted! Starting...', '#66ff66');
    
    // Start new game
    this.startRematch();
  }

  /**
   * Handle opponent declining rematch
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
   * Start a rematch game
   */
  private startRematch(): void {
    // Swap colors for rematch (optional - could keep same colors)
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
   * Handle returning to main menu
   */
  private handleReturnToMenu(): void {
    // Disconnect from P2P
    this.networkManager?.leaveRoom();
    
    this.scene.start('MenuScene');
  }

  /**
   * Update status text
   */
  private updateStatus(text: string, color: string): void {
    if (this.statusText) {
      this.statusText.setText(text);
      this.statusText.setColor(color);
    }
  }

  /**
   * Hide main buttons (rematch and menu)
   */
  private hideMainButtons(): void {
    if (this.rematchButton) {
      this.rematchButton.setVisible(false);
    }
  }

  /**
   * Show main buttons
   */
  private showMainButtons(): void {
    if (this.rematchButton) {
      this.rematchButton.setVisible(true);
      this.rematchButton.setInteractive({ useHandCursor: true });
      this.rematchButton.setAlpha(1);
    }
  }

  /**
   * Show rematch request UI
   */
  private showRematchRequestUI(): void {
    if (this.rematchRequestContainer) {
      this.rematchRequestContainer.setVisible(true);
    }
  }

  /**
   * Hide rematch request UI
   */
  private hideRematchRequestUI(): void {
    if (this.rematchRequestContainer) {
      this.rematchRequestContainer.setVisible(false);
    }
  }

  /**
   * Create a button
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
   * Create a button for use inside a container
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

  /**
   * Clean up when scene shuts down
   */
  shutdown(): void {
    // Remove network callbacks to prevent memory leaks
    // The network manager will be reused or cleaned up by the next scene
  }
}
