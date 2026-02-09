/**
 * @fileoverview Promotion picker UI helpers
 *
 * @module scenes/game/GameScenePromotion
 */

import { Square, PieceSymbol } from 'chess.js';
import type { PlayerColor } from '../../managers/GameStateManager';
import type { GameScene } from '../GameScene';
import { hex } from '../../utils/colors';
import { calculateLayout } from './GameLayout';

const DEFAULT_PROMOTION_OPTIONS: PieceSymbol[] = ['q', 'r', 'b', 'n'];
const PANEL_BASE_WIDTH = 420;
const PANEL_BASE_HEIGHT = 170;
const PANEL_RADIUS = 10;
const TITLE_FONT_SIZE = 22;
const ICON_BASE_SIZE = 56;

/**
 * Shows a promotion picker overlay and wires a selection handler.
 *
 * @param from - Origin square of the move.
 * @param to - Destination square of the move.
 * @param movingColor - Color of the moving player.
 * @param options - Promotion piece options to display.
 * @param onSelect - Optional callback invoked with selected piece.
 * @param titleText - Optional title text for the picker.
 */
export function showPromotionPicker(
  this: GameScene,
  from: Square,
  to: Square,
  movingColor: PlayerColor,
  options: PieceSymbol[] = DEFAULT_PROMOTION_OPTIONS,
  onSelect?: (piece: PieceSymbol) => void,
  titleText: string = 'Choose Promotion'
): void {
  if (this.promotionOverlay) {
    this.promotionOverlay.destroy();
    this.promotionOverlay = null;
  }

  this.pendingPromotion = { from, to, color: movingColor, options, onSelect, title: titleText };

  const layout = this.currentLayout ?? calculateLayout(this.scale.width, this.scale.height);
  this.currentLayout = layout;
  const { width, height } = this.scale;
  const overlay = this.add.container(0, 0);
  overlay.setDepth(150);

  const backdrop = this.add.rectangle(width / 2, height / 2, width, height, hex('#000000'), 0.6);
  backdrop.setInteractive();
  overlay.add(backdrop);

  const panelWidth = Math.min(width * 0.75, PANEL_BASE_WIDTH * layout.panelScale);
  const panelHeight = Math.min(height * 0.3, PANEL_BASE_HEIGHT * layout.panelScale);
  const panelX = width / 2;
  const panelY = height / 2;

  const panel = this.add.graphics();
  panel.fillStyle(hex('#23211f'), 0.95);
  panel.fillRoundedRect(panelX - panelWidth / 2, panelY - panelHeight / 2, panelWidth, panelHeight, PANEL_RADIUS);
  panel.lineStyle(4, hex('#000000'), 1);
  panel.strokeRoundedRect(panelX - panelWidth / 2, panelY - panelHeight / 2, panelWidth, panelHeight, PANEL_RADIUS);
  panel.lineStyle(2, hex('#2a1a0a'), 1);
  panel.strokeRoundedRect(
    panelX - panelWidth / 2 + 2,
    panelY - panelHeight / 2 + 2,
    panelWidth - 4,
    panelHeight - 4,
    Math.max(0, PANEL_RADIUS - 2)
  );
  panel.lineStyle(2, hex('#1d1b1a'), 1);
  panel.strokeRoundedRect(
    panelX - panelWidth / 2 + 4,
    panelY - panelHeight / 2 + 4,
    panelWidth - 8,
    panelHeight - 8,
    Math.max(0, PANEL_RADIUS - 4)
  );

  const title = this.add.text(panelX, panelY - panelHeight / 2 + 30 * layout.panelScale, titleText, {
    fontSize: `${TITLE_FONT_SIZE * layout.panelScale}px`,
    fontFamily: 'BoldPixels, Arial',
    color: '#dba616',
    stroke: '#000000',
    strokeThickness: 3
  }).setOrigin(0.5);

  overlay.add([panel, title]);

  const iconSpacing = panelWidth / (options.length + 1);
  const iconY = panelY + panelHeight * 0.15;
  const iconSize = ICON_BASE_SIZE * layout.panelScale;
  const handleSelect = onSelect ?? ((piece: PieceSymbol) => this.handleLocalMove(from, to, piece, true));

  options.forEach((piece, index) => {
    const textureKey = this.chessBoard.getPieceTextureKey(piece, movingColor === 'white' ? 'w' : 'b');
    if (!textureKey) return;
    const icon = this.add.image(panelX - panelWidth / 2 + iconSpacing * (index + 1), iconY, textureKey);
    icon.setDisplaySize(iconSize, iconSize);

    icon.setInteractive({ useHandCursor: true });
    icon.on('pointerdown', () => {
      this.hidePromotionPicker();
      handleSelect(piece);
    });
    overlay.add(icon);
  });
  this.promotionOverlay = overlay;
}

/**
 * Hides and clears the promotion picker overlay.
 */
export function hidePromotionPicker(this: GameScene): void {
  if (this.promotionOverlay) {
    this.promotionOverlay.destroy();
    this.promotionOverlay = null;
  }
  this.pendingPromotion = null;
}
