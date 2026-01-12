/**
 * @fileoverview GameScene connection overlay helpers
 *
 * @module scenes/game/GameSceneConnection
 */

import { calculateLayout } from './GameLayout';
import { createImageButton } from './GameUIHelpers';
import { hex } from '../../utils/colors';
import type { GameScene } from '../GameScene';

/**
 * Shows the connection status overlay
 * Displays message and return to menu button
 * Pauses game interaction while visible
 *
 * @param message - Status message to display
 */
export function showConnectionOverlay(this: GameScene, message: string): void {
  const layout = this.currentLayout ?? calculateLayout(this.scale.width, this.scale.height);
  this.currentLayout = layout;

  if (!this.connectionOverlay) {
    this.connectionOverlay = this.add.container(0, 0);
    this.connectionOverlay.setDepth(200);

    // Using Rectangle for better performance than Graphics
    this.connectionOverlayBackground = this.add.rectangle(
      layout.width / 2, layout.height / 2,
      layout.width, layout.height,
      hex('#000000'), 0.6
    );
    this.connectionOverlay.add(this.connectionOverlayBackground);

    this.connectionOverlayText = this.add.text(layout.width / 2, layout.height / 2 - 40 * layout.panelScale, message, {
      fontFamily: 'BoldPixels, Arial',
      fontSize: `${24 * layout.panelScale}px`,
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: layout.width * 0.7 }
    }).setOrigin(0.5);
    this.connectionOverlay.add(this.connectionOverlayText);

    this.connectionOverlayButton = createImageButton(this,
      layout.width / 2,
      layout.height / 2 + 40 * layout.panelScale,
      'RETURN TO MENU',
      'red_button',
      'red_button_pressed',
      () => {
        this.networkManager?.leaveRoom();
        this.scene.start('MenuScene');
      }
    );
    this.connectionOverlayButton.setData('baseScale', layout.panelScale);
    this.connectionOverlayButton.setScale(layout.panelScale);
    this.connectionOverlay.add(this.connectionOverlayButton);
  } else if (this.connectionOverlayText) {
    this.connectionOverlayText.setText(message);
  }

  this.connectionOverlay?.setVisible(true);
  this.isConnectionPaused = true;
  this.cardHand?.disableInteraction();
}

/**
 * Hides the connection status overlay
 * Resumes game interaction
 */
export function hideConnectionOverlay(this: GameScene): void {
  if (this.connectionOverlay) {
    this.connectionOverlay.setVisible(false);
  }
  this.isConnectionPaused = false;
  this.cardHand?.enableInteraction();
}
