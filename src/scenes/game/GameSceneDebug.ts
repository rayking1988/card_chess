/**
 * @fileoverview GameScene debug overlay helpers
 *
 * @module scenes/game/GameSceneDebug
 */

import type { GameScene } from '../GameScene';
import type { GameLayout } from './GameTypes';

/**
 * Creates debug overlay rectangles for visualizing layout sections
 * Each section has a different semi-transparent color
 * Sections are defined by percentage and are adjacent with no gaps
 *
 * @param layout - Current layout calculations
 */
export function createDebugOverlays(this: GameScene, layout: GameLayout): void {
  const alpha = 0.3;

  // Define sections with their colors (matching the section names in layout.sections)
  const sectionColors: Array<{ name: string; color: number }> = [
    { name: 'leftPanel', color: 0x00ff00 },         // Green - Left panel (decks/discards)
    { name: 'board', color: 0xff0000 },             // Red - Board area
    { name: 'rightPanelTop', color: 0x223b88 },     // Deep blue - Opponent panel
    { name: 'rightPanelMiddle', color: 0x2b4e99 },  // Blue - Player panel
    { name: 'rightPanelBottom', color: 0x1a2f66 },  // Dark blue - Controls
    { name: 'eventLogTop', color: 0xffff00 },       // Yellow - Event log
    { name: 'eventLogPreview', color: 0xffbb55 },   // Orange - Preview
    { name: 'topBar', color: 0x00ffff },            // Cyan - Opponent's hand area
    { name: 'bottomBar', color: 0xff00ff },         // Magenta - Player's hand area
  ];

  for (const section of sectionColors) {
    const rect = this.add.rectangle(0, 0, 100, 100, section.color, alpha);
    rect.setDepth(1000); // Above everything
    rect.setOrigin(0, 0); // Origin at top-left for easier positioning
    this.debugOverlays.set(section.name, rect);
  }

  this.updateDebugOverlays(layout);
}

/**
 * Updates debug overlay positions and sizes based on section bounds
 * Sections are percentage-based and adjacent with no gaps
 *
 * @param layout - Current layout calculations
 */
export function updateDebugOverlays(this: GameScene, layout: GameLayout): void {
  const sectionNames = [
    'leftPanel',
    'board',
    'rightPanelTop',
    'rightPanelMiddle',
    'rightPanelBottom',
    'eventLogTop',
    'eventLogPreview',
    'topBar',
    'bottomBar'
  ] as const;

  for (const name of sectionNames) {
    const rect = this.debugOverlays.get(name);
    const bounds = layout.sections[name];
    if (rect && bounds) {
      rect.setPosition(bounds.x, bounds.y);
      rect.setSize(bounds.width, bounds.height);
    }
  }
}
