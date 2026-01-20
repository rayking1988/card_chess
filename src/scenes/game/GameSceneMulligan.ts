/**
 * @fileoverview GameScene mulligan and interaction blocker helpers
 *
 * @module scenes/game/GameSceneMulligan
 */

import { calculateLayout } from './GameLayout';
import { createImageButton } from './GameUIHelpers';
import { hex } from '../../utils/colors';
import type { GameScene } from '../GameScene';
import { INTERACTION_BLOCKER, OVERLAY_LAYOUT } from '../../config';
import { getBoardOverlayMetrics } from './GameSceneOverlays';
import { MULLIGAN_TIME_BASE_COST } from '../../managers/gameState';

function showMulliganWaitingState(scene: GameScene, layout = scene.currentLayout ?? calculateLayout(scene.scale.width, scene.scale.height)): void {
  const { overlayWidth, overlayHeight, overlayX, overlayY } = getBoardOverlayMetrics(scene, layout);

  if (!scene.mulliganBannerRect) {
    scene.mulliganBannerRect = scene.add.rectangle(overlayX, overlayY, overlayWidth, overlayHeight, hex('#ff9a2a'), 0.9);
    scene.mulliganBannerRect.setDepth(120);
  } else {
    scene.mulliganBannerRect.setPosition(overlayX, overlayY);
    scene.mulliganBannerRect.setSize(overlayWidth, overlayHeight);
  }

  const scale = layout.panelScale;
  if (!scene.mulliganTitleText) {
    scene.mulliganTitleText = scene.add.text(overlayX, overlayY - overlayHeight * OVERLAY_LAYOUT.TITLE_Y_OFFSET_FACTOR, 'WAITING FOR OPPONENT...', {
      fontSize: `${OVERLAY_LAYOUT.MULLIGAN_TITLE_FONT_SIZE * scale}px`,
      fontFamily: 'BoldPixels, Arial',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(121);
  } else {
    scene.mulliganTitleText.setPosition(overlayX, overlayY - overlayHeight * OVERLAY_LAYOUT.TITLE_Y_OFFSET_FACTOR);
    scene.mulliganTitleText.setFontSize(OVERLAY_LAYOUT.MULLIGAN_TITLE_FONT_SIZE * scale);
    scene.mulliganTitleText.setText('Waiting for opponent...');
  }

  if (scene.mulliganButton) {
    scene.mulliganButton.destroy();
    scene.mulliganButton = null;
  }
  if (scene.readyButton) {
    scene.readyButton.destroy();
    scene.readyButton = null;
  }
}

/**
 * Refreshes interaction blockers to cover everything except the event log
 */
export function refreshInteractionBlockers(this: GameScene): void {
  if (!this.interactionBlockersActive || !this.eventLog) return;

  const { width, height } = this.scale;
  const bounds = this.eventLog.getContainer().getBounds();
  let left = bounds.x;
  let right = bounds.x + bounds.width;
  let top = bounds.y;
  let bottom = bounds.y + bounds.height;

  if (this.interactionBlockersAllowPreview) {
    const layout = this.currentLayout ?? calculateLayout(width, height);
    this.currentLayout = layout;
    const preview = layout.sections.eventLogPreview;
    left = Math.min(left, preview.x);
    right = Math.max(right, preview.x + preview.width);
    top = Math.min(top, preview.y);
    bottom = Math.max(bottom, preview.y + preview.height);
  }

  left = Math.max(0, Math.min(width, left));
  right = Math.max(0, Math.min(width, right));
  top = Math.max(0, Math.min(height, top));
  bottom = Math.max(0, Math.min(height, bottom));
  const middleHeight = Math.max(0, bottom - top);

  this.interactionBlockers.forEach(rect => rect.destroy());
  this.interactionBlockers = [];

  const addBlocker = (x: number, y: number, w: number, h: number): void => {
    if (w <= 0 || h <= 0) return;
    const rect = this.add.rectangle(x, y, w, h, hex('#000000'), INTERACTION_BLOCKER.ALPHA);
    rect.setDepth(INTERACTION_BLOCKER.DEPTH);
    rect.setInteractive();
    this.interactionBlockers.push(rect);
  };

  addBlocker(width / 2, top / 2, width, top);
  addBlocker(width / 2, bottom + (height - bottom) / 2, width, height - bottom);
  if (middleHeight > 0) {
    addBlocker(left / 2, top + middleHeight / 2, left, middleHeight);
    addBlocker(right + (width - right) / 2, top + middleHeight / 2, width - right, middleHeight);
  }
}

/**
 * Clears interaction blockers
 */
export function clearInteractionBlockers(this: GameScene): void {
  this.interactionBlockers.forEach(rect => rect.destroy());
  this.interactionBlockers = [];
  this.interactionBlockersActive = false;
  this.interactionBlockersAllowPreview = false;
}

/**
 * Shows the mulligan phase UI
 * Displays overlay with mulligan and ready buttons
 */
export function showMulliganUI(this: GameScene): void {
  const { width, height } = this.scale;
  const layout = this.currentLayout ?? calculateLayout(width, height);
  const scale = layout.panelScale;
  this.cardHand.setExtraPlayZone({
    x: layout.sections.leftPanel.x,
    y: layout.sections.leftPanel.y,
    width: layout.sections.leftPanel.width,
    height: layout.sections.leftPanel.height
  });

  this.isMobileEventLogVisible = true;
  this.positionEventLog(layout);
  this.interactionBlockersActive = true;
  this.interactionBlockersAllowPreview = true;
  this.refreshInteractionBlockers();
  this.cardHand.disableInteraction();

  const { overlayWidth, overlayHeight, overlayX, overlayY } = getBoardOverlayMetrics(this, layout);
  const buttonLayout = getBoardOverlayMetrics(this, layout);

  if (!this.mulliganBannerRect) {
    this.mulliganBannerRect = this.add.rectangle(overlayX, overlayY, overlayWidth, overlayHeight, hex('#ff9a2a'), 0.5);
    this.mulliganBannerRect.setDepth(120);
  } else {
    this.mulliganBannerRect.setPosition(overlayX, overlayY);
    this.mulliganBannerRect.setSize(overlayWidth, overlayHeight);
  }

  if (!this.mulliganTitleText) {
    this.mulliganTitleText = this.add.text(overlayX, overlayY - overlayHeight * OVERLAY_LAYOUT.TITLE_Y_OFFSET_FACTOR, `RE-DRAW HAND WITH COST OF ${MULLIGAN_TIME_BASE_COST} SECONDS?`, {
      fontSize: `${OVERLAY_LAYOUT.MULLIGAN_TITLE_FONT_SIZE * scale}px`,
      fontFamily: 'BoldPixels, Arial',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(121);
  }

  const buttonScale = scale * OVERLAY_LAYOUT.BUTTON_SCALE_FACTOR;
  const buttonY = buttonLayout.overlayY + buttonLayout.overlayHeight * OVERLAY_LAYOUT.BUTTON_Y_OFFSET_FACTOR;
  const buttonOffset = Math.min(OVERLAY_LAYOUT.BUTTON_X_OFFSET * scale, buttonLayout.overlayWidth * 0.25);

  if (!this.mulliganButton) {
    this.mulliganButton = createImageButton(
      this,
      buttonLayout.overlayX - buttonOffset,
      buttonY,
      'RE-DRAW',
      'yellow_button',
      'yellow_button_pressed',
      () => this.handleMulligan()
    );
    this.mulliganButton.setDepth(122);
  } else {
    this.mulliganButton.setPosition(buttonLayout.overlayX - buttonOffset, buttonY);
  }
  this.mulliganButton.setData('baseScale', buttonScale);
  this.mulliganButton.setScale(buttonScale);

  if (!this.readyButton) {
    this.readyButton = createImageButton(
      this,
      buttonLayout.overlayX + buttonOffset,
      buttonY,
      'KEEP HAND',
      'blue_button',
      'blue_button_pressed',
      () => this.handleReady()
    );
    this.readyButton.setDepth(122);
  } else {
    this.readyButton.setPosition(buttonLayout.overlayX + buttonOffset, buttonY);
  }
  this.readyButton.setData('baseScale', buttonScale);
  this.readyButton.setScale(buttonScale);
}

/**
 * Handles mulligan button click
 * Returns hand to deck, reshuffles, and draws new hand
 * Deducts time cost (10s base, doubles each mulligan)
 */
export function handleMulligan(this: GameScene): void {
  // Return hand to deck and reshuffle
  const hand = this.gameStateManager.getHand(this.localColor);
  const deck = this.gameStateManager.getDeck(this.localColor);

  // Put hand back in deck
  const newDeck = [...deck, ...hand];
  this.gameStateManager.setDeck(this.localColor, newDeck);

  // Clear hand in state (manually update player state)
  const state = this.gameStateManager.getState();
  state.players[this.localColor].hand = [];
  this.gameStateManager.importState(state);

  // Shuffle and draw new hand
  this.gameStateManager.shuffleDeck(this.localColor);
  this.gameStateManager.drawCards(this.localColor, 7, false);

  // Deduct mulligan time cost (Requirement 3.2)
  // Cost doubles each time: 10s, 20s, 40s, 80s, etc.
  const mulliganTimeCost = this.gameStateManager.deductMulliganTimeCost(this.localColor, this.mulliganCount);

  // Increment mulligan counter for next mulligan
  this.mulliganCount++;

  this.logEvent(this.localColor, `Mulligan Cost: ${mulliganTimeCost}s`);

  const nextMulliganCost = MULLIGAN_TIME_BASE_COST * (2 ** this.mulliganCount);

  if (nextMulliganCost >= this.playerClock.getTime()) {
    const { width, height } = this.scale;
    const layout = this.currentLayout ?? calculateLayout(width, height);
    const buttonLayout = getBoardOverlayMetrics(this, layout);

    this.mulliganTitleText?.setText(`NO ENOUGH TIME TO PERFORM MULLIGAN`)
    this.mulliganButton?.destroy();
    this.readyButton?.setPosition(buttonLayout.overlayX);
  } else {
    this.mulliganTitleText?.setText(`RE-DRAW HAND WITH COST OF ${nextMulliganCost} SECONDS?`)
  }
  

  // Send to network
  this.networkManager?.sendMulligan(mulliganTimeCost);

  this.updateUIFromState();
}

/**
 * Handles ready button click
 * Marks local player as ready and checks if game can start
 */
export function handleReady(this: GameScene): void {
  // Mark local player as ready
  this.localPlayerReady = true;

  // Set mulligan count back to 0
  this.mulliganCount=0;

  // Swap to waiting state (keep blockers until both ready)
  showMulliganWaitingState(this);

  this.logEvent(this.localColor, 'Finished mulligan');

  // Send to network
  this.networkManager?.sendReady();

  // Check if both players are ready (or single player mode)
  this.checkGameStart();

  this.updateUIFromState();
}

/**
 * Hides the mulligan UI elements
 */
export function hideMulliganUI(this: GameScene, options: { keepBlockers?: boolean } = {}): void {
  if (this.mulliganButton) {
    this.mulliganButton.destroy();
    this.mulliganButton = null;
  }
  if (this.readyButton) {
    this.readyButton.destroy();
    this.readyButton = null;
  }
  if (this.mulliganBannerRect) {
    this.mulliganBannerRect.destroy();
    this.mulliganBannerRect = null;
  }
  if (this.mulliganTitleText) {
    this.mulliganTitleText.destroy();
    this.mulliganTitleText = null;
  }
  if (this.mulliganInstructionText) {
    this.mulliganInstructionText.destroy();
    this.mulliganInstructionText = null;
  }
  if (!options.keepBlockers) {
    this.clearInteractionBlockers();
    this.cardHand.enableInteraction();
  }
}

/**
 * Checks if both players are ready to start the game
 * In single-player mode, starts immediately when local player is ready
 */
export function checkGameStart(this: GameScene): void {
  // In single player mode (no network), start immediately when local player is ready
  if (!this.networkManager && this.localPlayerReady) {
    this.gameStateManager.startGame();
    this.logEvent('system', 'Game started!');
    // Reset lastTurnOverlayTurn to force the turn overlay to show
    this.lastTurnOverlayTurn = undefined;
    this.hideMulliganUI();
    this.updateUIFromState();
    return;
  }

  // In multiplayer, wait for both players to be ready
  if (this.localPlayerReady && this.opponentPlayerReady) {
    this.gameStateManager.startGame();
    if (this.networkManager?.getIsHost() && !this.hasReportedGameStart) {
      this.hasReportedGameStart = true;
      this.networkManager.reportGameStarted();
    }
    this.logEvent('system', 'Both players ready - Game started!');
    // Reset lastTurnOverlayTurn to force the turn overlay to show
    this.lastTurnOverlayTurn = undefined;
    this.hideMulliganUI();
    this.updateUIFromState();
  }
}
