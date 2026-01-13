/**
 * @fileoverview Promotion picker UI helpers
 *
 * @module scenes/game/GameScenePromotion
 */

import { Square } from 'chess.js';
import type { PlayerColor } from '../../managers/GameStateManager';
import type { GameScene } from '../GameScene';
import { hex } from '../../utils/colors';

const PROMOTION_OPTIONS = ['q', 'r', 'b', 'n'] as const;

export function showPromotionPicker(this: GameScene, from: Square, to: Square, movingColor: PlayerColor): void {
  if (this.promotionOverlay) {
    this.promotionOverlay.destroy();
    this.promotionOverlay = null;
  }

  this.pendingPromotion = { from, to, color: movingColor };

  const { width, height } = this.scale;
  const overlay = this.add.container(0, 0);
  overlay.setDepth(150);

  const backdrop = this.add.rectangle(width / 2, height / 2, width, height, hex('#000000'), 0.6);
  const panelWidth = Math.min(420, width * 0.7);
  const panelHeight = 160;
  const panel = this.add.rectangle(width / 2, height / 2, panelWidth, panelHeight, hex('#1b1b1b'), 0.95);
  panel.setStrokeStyle(2, hex('#4a4a4a'), 1);

  const title = this.add.text(width / 2, height / 2 - 55, 'Choose Promotion', {
    fontSize: '20px',
    fontFamily: 'BoldPixels, Arial',
    color: '#ffffff'
  }).setOrigin(0.5);

  const iconSpacing = panelWidth / (PROMOTION_OPTIONS.length + 1);
  const iconY = height / 2 + 10;
  overlay.add([backdrop, panel, title]);

  PROMOTION_OPTIONS.forEach((piece, index) => {
    const textureKey = this.chessBoard.getPieceTextureKey(piece, movingColor === 'white' ? 'w' : 'b');
    if (!textureKey) return;
    const icon = this.add.image(width / 2 - panelWidth / 2 + iconSpacing * (index + 1), iconY, textureKey);
    icon.setDisplaySize(50, 50);

    icon.setInteractive({ useHandCursor: true });
    icon.on('pointerdown', () => {
      this.hidePromotionPicker();
      this.handleLocalMove(from, to, piece, true); // true = animate promotion moves
    });
    overlay.add(icon);
  });
  this.promotionOverlay = overlay;
}

export function hidePromotionPicker(this: GameScene): void {
  if (this.promotionOverlay) {
    this.promotionOverlay.destroy();
    this.promotionOverlay = null;
  }
  this.pendingPromotion = null;
}
