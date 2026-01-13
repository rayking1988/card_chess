/**
 * @fileoverview GameScene utility helpers
 *
 * @module scenes/game/GameSceneUtils
 */

import type { Card, PlayerColor } from '../../managers/GameStateManager';
import { CARD_DEFINITIONS } from '../../data/cards';
import type { GameScene } from '../GameScene';

/**
 * Refreshes all name displays (clocks, stopwatches, nameplates)
 * Called when opponent name is received via network
 */
export function refreshNameDisplays(this: GameScene): void {
  if (this.opponentClock) {
    this.opponentClock.setLabel(this.opponentName);
  }
  if (this.playerClock) {
    this.playerClock.setLabel(this.playerName);
  }
  if (this.opponentNameText) {
    this.opponentNameText.setText(this.opponentName);
  }
  if (this.playerNameText) {
    this.playerNameText.setText(this.playerName);
  }
  if (this.opponentHandLabelText) {
    this.opponentHandLabelText.setText(`${this.opponentName} Hand`);
  }
  if (this.currentLayout) {
    this.positionNameplates(this.currentLayout);
    this.positionOpponentHand(this.currentLayout);
  }
}

/**
 * Logs an event to the event log
 *
 * @param player - Player color or 'system' for system messages
 * @param message - Message to log
 */
export function logEvent(this: GameScene, player: PlayerColor | 'system', message: string): void {
  const displayName = player === 'system'
    ? undefined
    : player === this.localColor
      ? 'You'
      : this.opponentName;
  this.eventLog.addEntry(player === 'system' ? 'system' : player, message, displayName);
}

/**
 * Gets card data by card name from definitions
 * Used to reconstruct card data from network messages
 *
 * @param name - Card name to look up
 * @returns Card data or null if not found
 */
export function getCardDataByName(this: GameScene, name: string): Card | null {
  const definition = Object.values(CARD_DEFINITIONS).find((def) => def.name === name);
  if (!definition) return null;

  return {
    id: `preview_${name}_${Date.now()}`,
    name: definition.name,
    type: definition.type,
    energyCost: definition.energyCost,
    timeCost: definition.timeCost,
    effect: definition.effect,
    artAsset: definition.artAsset,
    frameColor: definition.frameColor
  };
}
