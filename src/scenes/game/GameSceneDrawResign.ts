/**
 * @fileoverview GameScene offer draw and resign helpers
 *
 * @module scenes/game/GameSceneDrawResign
 */

import Phaser from 'phaser';
import type { GameScene } from '../GameScene';

function getButtonLabel(button?: Phaser.GameObjects.Container | null): Phaser.GameObjects.Text | null {
  if (!button) return null;
  return (button.getData('label') as Phaser.GameObjects.Text | undefined) ?? null;
}

function setButtonState(
  button: Phaser.GameObjects.Container | undefined,
  text: string,
  color: string,
  enabled: boolean
): void {
  if (!button) return;
  const label = getButtonLabel(button);
  if (label) {
    label.setText(text.toUpperCase());
    label.setColor(color);
  }
  if (enabled) {
    button.setInteractive({ useHandCursor: true });
    button.setAlpha(1);
  } else {
    button.disableInteractive();
    button.setAlpha(0.7);
  }
}

export function updateDrawResignButtons(this: GameScene): void {
  if (this.opponentOfferedDraw) {
    setButtonState(this.offerDrawButton, 'Accept Draw', '#66ff66', true);
  } else if (this.localOfferedDraw) {
    setButtonState(this.offerDrawButton, 'Draw Offered', '#cccccc', false);
  } else {
    setButtonState(this.offerDrawButton, 'Offer Draw', '#ffffff', true);
  }

  if (this.isResignConfirm) {
    setButtonState(this.resignButton, 'Are You Sure?', '#ffcc66', true);
  } else {
    setButtonState(this.resignButton, 'Resign', '#ffffff', true);
  }
}

export function handleOfferDraw(this: GameScene): void {
  if (this.gameStateManager.getPhase() !== 'playing') return;

  if (this.opponentOfferedDraw) {
    this.opponentOfferedDraw = false;
    this.localOfferedDraw = false;
    this.updateDrawResignButtons();
    if (this.networkManager) {
      this.networkManager.sendAcceptDraw();
    }
    this.handleGameEnd(null, 'Draw agreed');
    return;
  }

  if (this.localOfferedDraw) return;

  this.localOfferedDraw = true;
  this.updateDrawResignButtons();
  this.logEvent('system', 'Offered a draw');
  if (this.networkManager) {
    this.networkManager.sendOfferDraw();
  } else {
    this.handleGameEnd(null, 'Draw agreed');
  }
}

export function handleResignClick(this: GameScene): void {
  if (this.gameStateManager.getPhase() !== 'playing') return;

  if (!this.isResignConfirm) {
    this.isResignConfirm = true;
    this.updateDrawResignButtons();
    return;
  }

  this.isResignConfirm = false;
  this.updateDrawResignButtons();
  const opponentColor = this.localColor === 'white' ? 'black' : 'white';
  this.logEvent('system', 'You resigned');
  if (this.networkManager) {
    this.networkManager.sendResign();
  }
  this.handleGameEnd(opponentColor, 'Resigned');
}

export function handleOpponentOfferDraw(this: GameScene): void {
  this.opponentOfferedDraw = true;
  this.updateDrawResignButtons();
  this.logEvent('system', `${this.opponentName} offered a draw`);
}

export function handleOpponentAcceptDraw(this: GameScene): void {
  this.opponentOfferedDraw = false;
  this.localOfferedDraw = false;
  this.updateDrawResignButtons();
  this.handleGameEnd(null, 'Draw agreed');
}

export function handleOpponentResign(this: GameScene): void {
  this.logEvent('system', `${this.opponentName} resigned`);
  this.handleGameEnd(this.localColor, 'Opponent resigned');
}

/**
 * Resets draw/resign button states when a move is made
 * Called after a player makes a move to clear any pending draw offers or resign confirmations
 */
export function resetDrawResignState(this: GameScene): void {
  this.localOfferedDraw = false;
  this.opponentOfferedDraw = false;
  this.isResignConfirm = false;
  this.updateDrawResignButtons();
}
