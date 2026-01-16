/**
 * @fileoverview Overlay layout helpers for GameScene
 *
 * @module scenes/game/GameSceneOverlays
 */

import type { GameScene } from '../GameScene';
import type { GameLayout } from './GameTypes';
import { calculateLayout } from './GameLayout';
import { OVERLAY_LAYOUT } from '../../config';

export interface OverlayMetrics {
  overlayX: number;
  overlayY: number;
  overlayWidth: number;
  overlayHeight: number;
}

/**
 * Gets banner overlay metrics aligned to board ranks 4-5.
 *
 * @param scene - GameScene instance
 * @param layout - Optional precomputed layout
 * @returns Overlay metrics
 */
export function getBoardOverlayMetrics(scene: GameScene, layout?: GameLayout): OverlayMetrics {
  const resolvedLayout = layout ?? scene.currentLayout ?? calculateLayout(scene.scale.width, scene.scale.height);
  const overlayWidth = resolvedLayout.boardSize;
  const overlayHeight = scene.boardSquareSize * OVERLAY_LAYOUT.HEIGHT_IN_SQUARES;
  const overlayX = scene.boardTopLeft.x + overlayWidth / 2;
  const overlayY = scene.boardTopLeft.y + scene.boardSquareSize * OVERLAY_LAYOUT.Y_OFFSET_IN_SQUARES + overlayHeight / 2;
  return { overlayX, overlayY, overlayWidth, overlayHeight };
}

/**
 * Gets button overlay metrics aligned to the preview area.
 *
 * @param scene - GameScene instance
 * @param layout - Optional precomputed layout
 * @returns Overlay metrics
 */
export function getPreviewOverlayMetrics(scene: GameScene, layout?: GameLayout): OverlayMetrics {
  const resolvedLayout = layout ?? scene.currentLayout ?? calculateLayout(scene.scale.width, scene.scale.height);
  const previewArea = resolvedLayout.sections.eventLogPreview;
  const overlayWidth = previewArea.width * 0.9;
  const overlayHeight = Math.min(previewArea.height * 0.7, 220 * resolvedLayout.panelScale);
  const overlayX = previewArea.centerX;
  const overlayY = previewArea.y + previewArea.height * 0.08 + overlayHeight / 2;
  return { overlayX, overlayY, overlayWidth, overlayHeight };
}
