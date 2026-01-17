/**
 * @fileoverview GameScene discard viewer overlay helpers
 *
 * @module scenes/game/GameSceneDiscardViewer
 */

import Phaser from 'phaser';
import { CardComponent } from '../../components/Card';
import { calculateLayout } from './GameLayout';
import type { GameLayout } from './GameTypes';
import { createImageButton } from './GameUIHelpers';
import { hex } from '../../utils/colors';
import type { GameScene } from '../GameScene';
import { DISCARD_VIEWER } from '../../config';

/**
 * Shows the discard pile viewer overlay
 * Displays all cards in the selected discard pile with scrolling
 *
 * @param side - Which discard pile to view ('local' or 'opponent')
 */
export function showDiscardViewer(this: GameScene, side: 'local' | 'opponent'): void {
  const layout = this.currentLayout ?? calculateLayout(this.scale.width, this.scale.height);
  this.currentLayout = layout;

  this.hideDiscardViewer();
  this.discardViewerSide = side;
  this.discardViewerScrollOffset = 0;

  this.discardViewer = this.add.container(0, 0);
  this.discardViewer.setDepth(DISCARD_VIEWER.DEPTH);

  // Using Rectangle for better performance than Graphics
  this.discardViewerBackground = this.add.rectangle(
    layout.width / 2, layout.height / 2,
    layout.width, layout.height,
    hex('#000000'), DISCARD_VIEWER.BACKGROUND_ALPHA
  );
  this.discardViewerBackground.setInteractive();
  this.discardViewerBackground.on('pointerdown', () => this.hideDiscardViewer());
  this.discardViewer.add(this.discardViewerBackground);

  this.discardViewerPanel = this.add.graphics();
  this.discardViewer.add(this.discardViewerPanel);

  const title = side === 'local' ? 'Your Discard Pile' : `${this.opponentName} Discard Pile`;
  this.discardViewerTitleText = this.add.text(0, 0, title, {
    fontFamily: 'BoldPixels, Arial',
    fontSize: `${DISCARD_VIEWER.TITLE_FONT_SIZE * layout.panelScale}px`,
    color: '#dba616'
  }).setOrigin(0.5, 0.5);
  this.discardViewer.add(this.discardViewerTitleText);

  this.discardViewerCloseButton = createImageButton(this,
    0,
    0,
    '',
    'cross_close',
    'cross_close',
    () => this.hideDiscardViewer()
  );
  this.discardViewerCloseButton.setData('baseScale', layout.panelScale * DISCARD_VIEWER.CLOSE_BUTTON_SCALE);
  this.discardViewerCloseButton.setScale(layout.panelScale * DISCARD_VIEWER.CLOSE_BUTTON_SCALE);
  this.discardViewer.add(this.discardViewerCloseButton);

  this.discardViewerContent = this.add.container(0, 0);
  this.discardViewerMask = this.add.graphics();
  this.discardViewerMask.setVisible(false);
  this.discardViewer.add(this.discardViewerMask);
  this.discardViewer.add(this.discardViewerContent);

  this.layoutDiscardViewer(layout);
  this.buildDiscardViewerCards(layout);
  this.cardHand?.disableInteraction();
}

/**
 * Hides the discard pile viewer overlay
 * Cleans up all viewer elements and re-enables interaction
 */
export function hideDiscardViewer(this: GameScene): void {
  this.discardViewerCards.forEach(card => card.destroy());
  this.discardViewerCards = [];
  this.discardViewerPreviewCard?.destroy();
  this.discardViewerPreviewCard = null;
  this.discardViewerContent?.destroy();
  this.discardViewerMask?.destroy();
  this.discardViewerPanel?.destroy();
  this.discardViewerTitleText?.destroy();
  this.discardViewerCloseButton?.destroy();
  this.discardViewerBackground?.destroy();
  this.discardViewer?.destroy();
  this.discardViewer = null;
  this.discardViewerBackground = null;
  this.discardViewerPanel = null;
  this.discardViewerTitleText = null;
  this.discardViewerCloseButton = null;
  this.discardViewerContent = null;
  this.discardViewerMask = null;
  this.discardViewerBounds = null;
  this.discardViewerSide = null;
  this.discardViewerScrollOffset = 0;
  this.discardViewerMaxScroll = 0;
  this.cardHand?.enableInteraction();
}

/**
 * Lays out the discard viewer panel and content area
 *
 * @param layout - Current layout calculations
 */
export function layoutDiscardViewer(this: GameScene, layout: GameLayout): void {
  if (!this.discardViewer || !this.discardViewerPanel || !this.discardViewerTitleText || !this.discardViewerCloseButton || !this.discardViewerMask) {
    return;
  }

  const panelWidth = Math.min(layout.width * DISCARD_VIEWER.PANEL_WIDTH_FACTOR, DISCARD_VIEWER.PANEL_MAX_WIDTH * layout.panelScale);
  const panelHeight = Math.min(layout.height * DISCARD_VIEWER.PANEL_HEIGHT_FACTOR, DISCARD_VIEWER.PANEL_MAX_HEIGHT * layout.panelScale);
  const panelX = layout.width / 2;
  const panelY = layout.height / 2;
  const padding = DISCARD_VIEWER.PADDING * layout.panelScale;
  const titleHeight = DISCARD_VIEWER.TITLE_HEIGHT * layout.panelScale;

  this.discardViewerPanel.clear();
  this.discardViewerPanel.fillStyle(hex('#23211f'), DISCARD_VIEWER.PANEL_FILL_ALPHA);
  this.discardViewerPanel.fillRoundedRect(
    panelX - panelWidth / 2,
    panelY - panelHeight / 2,
    panelWidth,
    panelHeight,
    DISCARD_VIEWER.BORDER_RADIUS
  );
  this.discardViewerPanel.lineStyle(4, hex('#000000'), 1);
  this.discardViewerPanel.strokeRoundedRect(
    panelX - panelWidth / 2,
    panelY - panelHeight / 2,
    panelWidth,
    panelHeight,
    DISCARD_VIEWER.BORDER_RADIUS
  );
  this.discardViewerPanel.lineStyle(2, hex('#2a1a0a'), 1);
  this.discardViewerPanel.strokeRoundedRect(
    panelX - panelWidth / 2 + 2,
    panelY - panelHeight / 2 + 2,
    panelWidth - 4,
    panelHeight - 4,
    Math.max(0, DISCARD_VIEWER.BORDER_RADIUS - 2)
  );
  this.discardViewerPanel.lineStyle(2, hex('#1d1b1a'), 1);
  this.discardViewerPanel.strokeRoundedRect(
    panelX - panelWidth / 2 + 4,
    panelY - panelHeight / 2 + 4,
    panelWidth - 8,
    panelHeight - 8,
    Math.max(0, DISCARD_VIEWER.BORDER_RADIUS - 4)
  );

  this.discardViewerTitleText.setPosition(panelX, panelY - panelHeight / 2 + titleHeight * 0.55);
  this.discardViewerTitleText.setFontSize(DISCARD_VIEWER.TITLE_FONT_SIZE * layout.panelScale);

  this.discardViewerCloseButton.setPosition(panelX + panelWidth / 2 - DISCARD_VIEWER.CLOSE_BUTTON_X_OFFSET * layout.panelScale, panelY - panelHeight / 2 + titleHeight * 0.55);
  this.discardViewerCloseButton.setData('baseScale', layout.panelScale * DISCARD_VIEWER.CLOSE_BUTTON_SCALE);
  this.discardViewerCloseButton.setScale(layout.panelScale * DISCARD_VIEWER.CLOSE_BUTTON_SCALE);

  const contentX = panelX - panelWidth / 2 + padding;
  const contentY = panelY - panelHeight / 2 + titleHeight;
  const contentWidth = panelWidth - padding * 2;
  const contentHeight = panelHeight - titleHeight - padding;

  this.discardViewerBounds = { x: contentX, y: contentY, width: contentWidth, height: contentHeight };
  this.discardViewerContentBaseY = contentY;

  this.discardViewerMask.clear();
  this.discardViewerMask.fillStyle(hex('#ffffff'));
  this.discardViewerMask.fillRect(contentX, contentY, contentWidth, contentHeight);

  const mask = this.discardViewerMask.createGeometryMask();
  this.discardViewerContent?.setMask(mask);

  if (this.discardViewerContent) {
    this.discardViewerContent.setPosition(contentX, contentY);
  }

  if (this.discardViewerBackground) {
    // Rectangle uses center origin, so position at center and set size
    this.discardViewerBackground.setPosition(layout.width / 2, layout.height / 2);
    this.discardViewerBackground.setSize(layout.width, layout.height);
  }

  this.updateDiscardViewerScroll();
}

/**
 * Builds card components for the discard viewer
 * Cards are arranged in a grid with scrolling support
 *
 * @param layout - Current layout calculations
 */
export function buildDiscardViewerCards(this: GameScene, layout: GameLayout): void {
  if (!this.discardViewerContent || !this.discardViewerBounds || !this.discardViewerSide) return;

  this.discardViewerCards.forEach(card => card.destroy());
  this.discardViewerCards = [];

  const isOpponent = this.discardViewerSide === 'opponent';
  const localDiscard = this.gameStateManager.getPlayer(this.localColor).discard;
  const rawCards = isOpponent ? this.opponentDiscardCards : localDiscard;
  // Filter out null values - show from bottom to top
  const cards = [...rawCards].filter(c => c !== null);

  const scale = DISCARD_VIEWER.CARD_SCALE * layout.panelScale;
  const spacingX = DISCARD_VIEWER.CARD_SPACING_X * layout.panelScale;
  const spacingY = DISCARD_VIEWER.CARD_SPACING_Y * layout.panelScale;
  this.discardViewerCardSpacingY = spacingY;

  const columns = Math.max(1, Math.floor(this.discardViewerBounds.width / spacingX));
  const totalRows = Math.ceil(cards.length / columns);
  const visibleRows = Math.max(1, Math.floor(this.discardViewerBounds.height / spacingY));
  this.discardViewerMaxScroll = Math.max(0, totalRows - visibleRows);
  this.discardViewerScrollOffset = Math.min(this.discardViewerScrollOffset, this.discardViewerMaxScroll);

  for (let i = 0; i < cards.length; i++) {
    const row = (totalRows - 1) - Math.floor(i / columns);
    const col = i % columns;
    const cardData = cards[i];
    // Always show cards face-up in discard viewer (discard piles are public information)
    const card = new CardComponent(this, 0, 0, cardData, false, scale);
    card.setDepth(DISCARD_VIEWER.CARD_DEPTH);
    const x = col * spacingX + spacingX / 2;
    const y = row * spacingY + spacingY / 2;
    card.setPosition(x, y);
    card.getContainer().setDepth(DISCARD_VIEWER.CARD_DEPTH);
    const container = card.getContainer();
    const bounds = container.getBounds();
    const width = bounds.width / (container.scaleX || 1);
    const height = bounds.height / (container.scaleY || 1);
    const hitArea = new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height);
    container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
    container.on('pointerover', () => {
      this.discardViewerPreviewCard?.destroy();
      const previewScale = 1.35 * layout.panelScale;
      const preview = new CardComponent(this, layout.previewX, layout.previewY, cardData, false, previewScale);
      preview.setDepth(DISCARD_VIEWER.CARD_DEPTH + 20);
      this.discardViewerPreviewCard = preview;
    });
    container.on('pointerout', () => {
      this.discardViewerPreviewCard?.destroy();
      this.discardViewerPreviewCard = null;
    });
    this.discardViewerCards.push(card);
    this.discardViewerContent.add(card.getContainer());
  }

  this.updateDiscardViewerScroll();
}

/**
 * Updates the discard viewer scroll position
 */
export function updateDiscardViewerScroll(this: GameScene): void {
  if (!this.discardViewerContent) return;
  const offset = this.discardViewerScrollOffset * this.discardViewerCardSpacingY;
  this.discardViewerContent.setY(this.discardViewerContentBaseY - offset);
}

/**
 * Handles mouse wheel scrolling in the discard viewer
 *
 * @param _pointer - Phaser pointer (unused)
 * @param _gameObjects - Game objects under pointer (unused)
 * @param _deltaX - Horizontal scroll delta (unused)
 * @param deltaY - Vertical scroll delta
 */
export function handleDiscardViewerWheel(
  this: GameScene,
  _pointer: Phaser.Input.Pointer,
  _gameObjects: Phaser.GameObjects.GameObject[],
  _deltaX: number,
  deltaY: number
): void {
  if (!this.discardViewer || !this.discardViewerBounds) return;
  const pointer = this.input.activePointer;
  if (!this.isPointerInDiscardViewer(pointer)) return;
  const direction = deltaY > 0 ? 1 : -1;
  const nextOffset = Phaser.Math.Clamp(
    this.discardViewerScrollOffset + direction,
    0,
    this.discardViewerMaxScroll
  );
  if (nextOffset !== this.discardViewerScrollOffset) {
    this.discardViewerScrollOffset = nextOffset;
    this.updateDiscardViewerScroll();
  }
}

/**
 * Checks if pointer is within the discard viewer bounds
 *
 * @param pointer - Phaser input pointer
 * @returns true if pointer is inside viewer bounds
 */
export function isPointerInDiscardViewer(this: GameScene, pointer: Phaser.Input.Pointer): boolean {
  if (!this.discardViewerBounds) return false;
  const { x, y, width, height } = this.discardViewerBounds;
  return pointer.x >= x && pointer.x <= x + width &&
    pointer.y >= y && pointer.y <= y + height;
}
