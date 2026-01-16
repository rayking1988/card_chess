/**
 * @fileoverview GameScene discard mode helpers
 *
 * @module scenes/game/GameSceneDiscard
 */

import type { Card } from '../../managers/GameStateManager';
import { MAX_HAND_SIZE } from './GameConstants';
import { calculateLayout } from './GameLayout';
import { hex } from '../../utils/colors';
import type { GameScene } from '../GameScene';
import { OVERLAY_LAYOUT } from '../../config';

/**
 * Enters discard mode when hand exceeds maximum size
 * Shows overlay prompting player to discard cards
 */
export function enterDiscardMode(this: GameScene): void {
  this.isDiscardMode = true;
  this.cardHand.setForceDragMode(true);
  this.cardHand.cancelTargeting();
  const { width, height } = this.scale;
  const layout = this.currentLayout ?? calculateLayout(width, height);
  const scale = layout.panelScale;

  // Semi-transparent overlay (using Rectangle for better performance)
  this.discardOverlay = this.add.rectangle(width / 2, height / 2, width, height, hex('#000000'), 0.3);
  this.discardOverlay.setDepth(45);

  // Prompt text
  const handSize = this.gameStateManager.getHandSize(this.localColor);
  const toDiscard = handSize - MAX_HAND_SIZE;

  this.discardPromptText = this.add.text(
    width / 2, height / 2 - OVERLAY_LAYOUT.DISCARD_PROMPT_Y_OFFSET * scale,
    `Discard ${toDiscard} card(s) to continue`,
    {
      fontSize: `${OVERLAY_LAYOUT.DISCARD_PROMPT_FONT_SIZE * scale}px`,
      fontFamily: 'BoldPixels, Arial',
      color: '#ff6666'
    }
  ).setOrigin(0.5).setDepth(46);

  this.logEvent('system', `Hand size exceeds 7. Discard ${toDiscard} card(s).`);
}

/**
 * Discards a card from hand
 * Called when clicking a card in discard mode
 *
 * @param card - Card to discard
 */
export function discardCard(this: GameScene, card: Card): void {
  // Remove card from hand and add to discard
  const state = this.gameStateManager.getState();
  const playerState = state.players[this.localColor];

  const cardIndex = playerState.hand.findIndex(c => c.id === card.id);
  if (cardIndex !== -1) {
    const [discardedCard] = playerState.hand.splice(cardIndex, 1);
    playerState.discard.push(discardedCard);
    this.gameStateManager.importState(state);

    this.logEvent(this.localColor, `Discarded ${card.name}`);
    this.animateCardDiscard('local', 1);
    this.networkManager?.sendDiscardCards(1);

    // Update hand display
    this.updateHandDisplay();

    // Check if we're done discarding
    if (playerState.hand.length <= MAX_HAND_SIZE) {
      this.exitDiscardMode();

      // Calculate disturb to add to opponent BEFORE endTurn clears energy
      const localPlayer = this.gameStateManager.getPlayer(this.localColor);
      const disturbToAdd = localPlayer.mode === 'disturb' ? localPlayer.energy : 0;
      
      // Send local player stats before ending turn (includes energy before conversion)
      this.sendLocalPlayerStats();
      
      // Now end the turn - this processes mode effects and adds disturb to opponent
      this.gameStateManager.endTurn();
      
      // Send END_TURN to opponent with the disturb amount
      if (this.networkManager) {
        this.networkManager.sendEndTurn(disturbToAdd);
      }
    } else {
      // Update prompt
      const toDiscard = playerState.hand.length - MAX_HAND_SIZE;
      if (this.discardPromptText) {
        this.discardPromptText.setText(`Discard ${toDiscard} card(s) to continue`);
      }
    }
  }

  this.updateUIFromState();
}

/**
 * Exits discard mode
 * Cleans up overlay elements
 */
export function exitDiscardMode(this: GameScene): void {
  this.isDiscardMode = false;
  this.cardHand.setForceDragMode(false);
  this.cardHand.setExtraPlayZone(null);

  if (this.discardOverlay) {
    this.discardOverlay.destroy();
    this.discardOverlay = null;
  }
  if (this.discardPromptText) {
    this.discardPromptText.destroy();
    this.discardPromptText = null;
  }
}
