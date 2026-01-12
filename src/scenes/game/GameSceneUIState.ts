/**
 * @fileoverview GameScene UI state and animation helpers
 *
 * @module scenes/game/GameSceneUIState
 */

import type { StopwatchComponent } from '../../components/Stopwatch';
import type { GameScene } from '../GameScene';
import type { UISnapshot } from './GameTypes';
import type { PlayerColor } from '../../managers/GameStateManager';
import { calculateControlPower } from '../../utils/controlPower';
import { formatTime } from '../../components/Clock';
import { hex } from '../../utils/colors';

function formatStopwatchTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  return safeSeconds.toString().padStart(2, '0');
}

/**
 * Sets up callback for game state changes
 */
export function setupGameStateCallbacks(this: GameScene): void {
  this.gameStateManager.setOnStateChange((_state) => {
    this.updateUIFromState();
  });
}

/**
 * Updates all UI components from current game state
 *
 * Algorithm:
 * 1. Get current state from game state manager
 * 2. Update clocks, stopwatches, energy bar
 * 3. Update deck/discard counts and displays
 * 4. Update hand displays if changed
 * 5. Update chess board if FEN changed
 * 6. Check for discard mode trigger
 * 7. Run UI animations for state changes
 * 8. Send stats to opponent if networked
 *
 * @param options - Options for update behavior
 * @param options.sendStats - Whether to send stats to opponent (default: true)
 */
export function updateUIFromState(this: GameScene, options: { sendStats?: boolean } = {}): void {
  const state = this.gameStateManager.getState();
  const localPlayer = state.players[this.localColor];
  const opponentColor = this.localColor === 'white' ? 'black' : 'white';
  const opponentPlayer = state.players[opponentColor];

  const opponentClock = this.networkManager ? this.opponentClockTime : opponentPlayer.clock;
  const opponentStopwatch = this.networkManager ? this.opponentStopwatchTime : opponentPlayer.stopwatch;
  const opponentMode = this.networkManager ? this.opponentMode : opponentPlayer.mode;
  const opponentDeckCount = this.networkManager ? this.opponentDeckCount : opponentPlayer.deck.length;
  const opponentDiscardCount = this.networkManager ? this.opponentDiscardCount : opponentPlayer.discard.length;
  const opponentHandCount = this.networkManager ? this.opponentHandCount : opponentPlayer.hand.length;
  const opponentEnergy = this.networkManager ? this.opponentEnergy : opponentPlayer.energy;
  const opponentEnergyCap = this.networkManager ? this.opponentEnergyCap : opponentPlayer.energyCap;
  const opponentDisturb = this.networkManager ? this.opponentDisturbTags : opponentPlayer.disturbTags;

  // Update clocks
  this.playerClock.setTime(localPlayer.clock);
  this.opponentClock.setTime(opponentClock);

  // Update active clock indicator
  const isLocalTurn = state.currentTurn === this.localColor;
  this.playerClock.setActive(isLocalTurn);
  this.opponentClock.setActive(!isLocalTurn);
  this.updateTurnOverlay(state.currentTurn);

  // Update stopwatches
  this.playerStopwatch.setTime(localPlayer.stopwatch);
  this.opponentStopwatch.setTime(opponentStopwatch);

  // Update energy bars
  this.energyBar.setEnergy(localPlayer.energy, localPlayer.energyCap);
  this.opponentEnergyBar?.setEnergy(opponentEnergy, opponentEnergyCap);

  // Update Focus/Disturb toggles
  this.playerFocusDisturb.setMode(localPlayer.mode);
  this.opponentFocusDisturb.setMode(opponentMode);

  // Update disturb counters
  this.playerDisturbCounter?.setValue(localPlayer.disturbTags);
  this.opponentDisturbCounter?.setValue(opponentDisturb);

  // Update opponent deck counts
  this.updateOpponentDeckCounts(opponentDeckCount, opponentDiscardCount);

  // Update player deck counts
  this.updatePlayerDeckCounts(localPlayer.deck.length, localPlayer.discard.length);

  // Only reposition left panel if deck/discard counts changed (performance optimization)
  const deckCountsChanged = !this.lastStateSnapshot ||
    this.lastStateSnapshot.localDeck !== localPlayer.deck.length ||
    this.lastStateSnapshot.localDiscard !== localPlayer.discard.length ||
    this.lastStateSnapshot.opponentDeck !== opponentDeckCount ||
    this.lastStateSnapshot.opponentDiscard !== opponentDiscardCount;

  if (deckCountsChanged && this.currentLayout) {
    this.positionLeftPanel(this.currentLayout);
  }
  this.refreshDiscardTopCards();
  if (this.discardViewer && this.currentLayout && deckCountsChanged) {
    this.buildDiscardViewerCards(this.currentLayout);
  }

  // Update hand display if hand changed (e.g., card drawn at turn start)
  if (this.cardHand.getCardCount() !== localPlayer.hand.length) {
    this.updateHandDisplay();
  }

  if (!this.lastStateSnapshot || this.lastStateSnapshot.opponentHand !== opponentHandCount) {
    this.updateOpponentHandDisplay(opponentHandCount);
  }

  // Update card count
  this.updateCardCount();

  if (this.mobileTopNameText) {
    this.mobileTopNameText.setText(this.opponentName);
  }
  if (this.mobileBottomNameText) {
    this.mobileBottomNameText.setText(this.playerName);
  }
  this.mobileTopClockText?.setText(formatTime(opponentClock));
  this.mobileBottomClockText?.setText(formatTime(localPlayer.clock));
  this.mobileTopStopwatchText?.setText(formatStopwatchTime(opponentStopwatch));
  this.mobileBottomStopwatchText?.setText(formatStopwatchTime(localPlayer.stopwatch));
  this.mobileTopEnergyText?.setText(`${opponentEnergy}/${opponentEnergyCap}`);
  this.mobileBottomEnergyText?.setText(`${localPlayer.energy}/${localPlayer.energyCap}`);
  this.mobileTopDisturbText?.setText(`${opponentDisturb}`);
  this.mobileBottomDisturbText?.setText(`${localPlayer.disturbTags}`);

  if (this.currentLayout) {
    this.positionMobileBars(this.currentLayout);
  }

  // Update chess board position
  if (state.boardFEN !== this.chessBoard.getPosition()) {
    this.chessBoard.setPosition(state.boardFEN);
  }

  const snapshot: UISnapshot = {
    localClock: localPlayer.clock,
    opponentClock,
    localStopwatch: localPlayer.stopwatch,
    opponentStopwatch,
    localEnergy: localPlayer.energy,
    localEnergyCap: localPlayer.energyCap,
    currentTurn: state.currentTurn,
    localHand: localPlayer.hand.length,
    opponentHand: opponentHandCount,
    localDeck: localPlayer.deck.length,
    localDiscard: localPlayer.discard.length,
    opponentDeck: opponentDeckCount,
    opponentDiscard: opponentDiscardCount
  };

  if (this.lastStateSnapshot) {
    this.runUIAnimations(this.lastStateSnapshot, snapshot);
  }
  this.lastStateSnapshot = snapshot;

  // Send local player stats to opponent for sync
  if (options.sendStats ?? true) {
    this.sendLocalPlayerStats();
  }
}

/**
 * Runs UI animations based on state changes
 * Compares previous and current snapshots to trigger appropriate animations
 *
 * @param prev - Previous UI state snapshot
 * @param next - Current UI state snapshot
 */
export function runUIAnimations(this: GameScene, prev: UISnapshot, next: UISnapshot): void {
  const layout = this.currentLayout;
  if (!layout) return;

  if (prev.currentTurn !== next.currentTurn) {
    this.showTurnBanner(next.currentTurn);
  }

  if (prev.localClock !== next.localClock) {
    this.animations.animateClockChange(
      this.playerClock.getContainer(),
      this.playerClock.getTimeText(),
      prev.localClock,
      next.localClock
    );
    this.createFloatingDelta(
      this.playerClock.getContainer().x,
      this.playerClock.getContainer().y - 50 * layout.panelScale,
      next.localClock - prev.localClock,
      next.localClock - prev.localClock >= 0 ? '#66ff66' : '#ff6666',
      's'
    );
  }

  if (prev.opponentClock !== next.opponentClock) {
    this.animations.animateClockChange(
      this.opponentClock.getContainer(),
      this.opponentClock.getTimeText(),
      prev.opponentClock,
      next.opponentClock
    );
    this.createFloatingDelta(
      this.opponentClock.getContainer().x,
      this.opponentClock.getContainer().y - 50 * layout.panelScale,
      next.opponentClock - prev.opponentClock,
      next.opponentClock - prev.opponentClock >= 0 ? '#66ff66' : '#ff6666',
      's'
    );
  }

  if (prev.localEnergy !== next.localEnergy || prev.localEnergyCap !== next.localEnergyCap) {
    this.animations.animateEnergyChange(
      this.energyBar.getContainer(),
      this.energyBar.getEnergyText(),
      prev.localEnergy,
      next.localEnergy
    );
    if (next.localEnergyCap > prev.localEnergyCap) {
      this.animations.animateEnergyCapIncrease(this.energyBar.getContainer());
    }
  }

  if (prev.localStopwatch !== next.localStopwatch) {
    this.animateStopwatchChange(this.playerStopwatch, prev.localStopwatch, next.localStopwatch);
  }
  if (prev.opponentStopwatch !== next.opponentStopwatch) {
    this.animateStopwatchChange(this.opponentStopwatch, prev.opponentStopwatch, next.opponentStopwatch);
  }

  if (next.localHand > prev.localHand) {
    this.animateCardDraw('local', next.localHand - prev.localHand);
  }

  if (next.opponentHand > prev.opponentHand) {
    this.animateCardDraw('opponent', next.opponentHand - prev.opponentHand);
  }

  if (next.opponentHand < prev.opponentHand && next.opponentDiscard > prev.opponentDiscard) {
    if (this.suppressOpponentHandAnimation > 0) {
      this.suppressOpponentHandAnimation--;
    } else {
      const count = Math.min(prev.opponentHand - next.opponentHand, next.opponentDiscard - prev.opponentDiscard);
      this.animateCardDiscard('opponent', count);
    }
  } else if (this.suppressOpponentHandAnimation > 0 && next.opponentHand === prev.opponentHand) {
    this.suppressOpponentHandAnimation--;
  }
}

/**
 * Animates stopwatch value change with bounce and color flash
 *
 * @param component - Stopwatch component to animate
 * @param oldValue - Previous time value
 * @param newValue - New time value
 */
export function animateStopwatchChange(
  this: GameScene,
  component: StopwatchComponent,
  oldValue: number,
  newValue: number
): void {
  const diff = newValue - oldValue;
  if (diff === 0) return;

  const container = component.getContainer();
  const text = component.getTimeText();
  const color = diff > 0 ? '#ffaa44' : '#66aaff';
  const layout = this.currentLayout;
  const offset = layout ? 40 * layout.panelScale : 40;

  this.animations.bounce(container);
  text.setColor(color);

  this.time.delayedCall(300, () => {
    component.setTime(newValue);
  });

  this.createFloatingDelta(
    container.x,
    container.y - offset,
    diff,
    color,
    's'
  );
}

/**
 * Animates cards being drawn from deck to hand
 * Creates temporary card images that arc from deck to hand position
 *
 * @param side - Which player is drawing ('local' or 'opponent')
 * @param count - Number of cards being drawn
 */
export function animateCardDraw(this: GameScene, side: 'local' | 'opponent', count: number): void {
  const layout = this.currentLayout;
  if (!layout || count <= 0) return;

  // Use deck position from layout instead of sprite
  const deckPos = side === 'local' 
    ? { x: layout.leftPanelX, y: layout.playerDeckY }
    : { x: layout.leftPanelX, y: layout.opponentDeckY };
  const handPos = side === 'local'
    ? { x: layout.cardHandX, y: layout.cardHandY - 40 * layout.handScale }
    : { x: layout.opponentHandX, y: layout.opponentHandY + 10 * layout.panelScale };

  const scale = 0.26 * layout.panelScale;
  const spacing = 22 * layout.panelScale;
  const startX = handPos.x - ((Math.min(count, 3) - 1) * spacing) / 2;

  for (let i = 0; i < Math.min(count, 3); i++) {
    const card = this.add.image(deckPos.x, deckPos.y, 'card_back');
    card.setScale(scale);
    card.setDepth(30);

    const toPos = { x: startX + i * spacing, y: handPos.y };
    this.animations.arcMove(card, { x: deckPos.x, y: deckPos.y }, toPos, 120 * layout.panelScale, {
      duration: 350,
      onComplete: () => card.destroy()
    });
  }
}

/**
 * Animates cards being discarded from hand to discard pile
 * Creates temporary card images that move from hand to discard
 *
 * @param side - Which player is discarding ('local' or 'opponent')
 * @param count - Number of cards being discarded
 */
export function animateCardDiscard(this: GameScene, _side: 'local' | 'opponent', count: number): void {
  const layout = this.currentLayout;
  if (!layout || count <= 0) return;
  // Discard fly-in animation removed to avoid showing card backs.
  return;
}

/**
 * Creates a floating delta text that animates upward and fades out
 * Used to show value changes (+5s, -10s, etc.)
 *
 * @param x - X position
 * @param y - Y position
 * @param value - Delta value to display
 * @param color - Text color
 * @param suffix - Optional suffix (e.g., 's' for seconds)
 */
export function createFloatingDelta(
  this: GameScene,
  x: number,
  y: number,
  value: number,
  color: string,
  suffix: string = ''
): void {
  const sign = value >= 0 ? '+' : '';
  const layout = this.currentLayout;
  const fontSize = layout ? 18 * layout.panelScale : 18;
  const text = this.add.text(x, y, `${sign}${value}${suffix}`, {
    fontFamily: 'BoldPixels, Arial',
    fontSize: `${fontSize}px`,
    color,
    stroke: '#000000',
    strokeThickness: 2
  }).setOrigin(0.5);
  text.setDepth(2000);

  this.tweens.add({
    targets: text,
    y: y - 40,
    alpha: 0,
    duration: 800,
    ease: 'Quad.easeOut',
    onComplete: () => text.destroy()
  });
}

/**
 * Shows the turn announcement banner with animation
 * Banner pops in, displays briefly, then fades out
 *
 * @param turn - Which player's turn it is
 */
export function showTurnBanner(this: GameScene, turn: PlayerColor): void {
  if (!this.turnBanner || !this.turnBannerText) return;
  const layout = this.currentLayout;
  if (!layout) return;

  const isLocalTurn = turn === this.localColor;
  const bannerText = isLocalTurn ? 'Your Turn' : `${this.opponentName}'s Turn`;
  const color = isLocalTurn ? '#66ff66' : '#ffcc66';

  this.turnBannerText.setText(bannerText);
  this.turnBannerText.setColor(color);
  const baseScale = layout.panelScale;
  this.turnBanner.setPosition(layout.turnBannerX, layout.turnBannerY);
  this.turnBanner.setVisible(true);
  this.turnBanner.setAlpha(0);
  this.turnBanner.setScale(baseScale * 0.9);

  this.tweens.add({
    targets: this.turnBanner,
    alpha: 1,
    scaleX: baseScale,
    scaleY: baseScale,
    duration: 200,
    ease: 'Back.easeOut',
    onComplete: () => {
      this.tweens.add({
        targets: this.turnBanner,
        alpha: 0,
        y: layout.turnBannerY + 10 * layout.panelScale,
        duration: 400,
        delay: 400,
        ease: 'Quad.easeIn',
        onComplete: () => {
          if (this.turnBanner) {
            this.turnBanner.setVisible(false);
            this.turnBanner.setY(layout.turnBannerY);
          }
        }
      });
    }
  });
}

/**
 * Updates the persistent turn overlay across the board
 *
 * @param turn - Which player's turn it is
 */
export function updateTurnOverlay(this: GameScene, turn: PlayerColor): void {
  if (!this.turnOverlayRect || !this.turnOverlayText) return;
  if (this.lastTurnOverlayTurn === turn) return;
  this.lastTurnOverlayTurn = turn;

  const isLocalTurn = turn === this.localColor;
  const text = isLocalTurn ? 'YOUR TURN' : 'OPPONENT\'S TURN';
  const color = isLocalTurn ? '#3377ff' : '#ff3333';

  this.turnOverlayRect.setFillStyle(hex(color), 0.5);
  this.turnOverlayText.setText(text);
  this.turnOverlayRect.setVisible(true);
  this.turnOverlayText.setVisible(true);

  if (this.turnOverlayHideEvent) {
    this.turnOverlayHideEvent.remove(false);
  }
  this.turnOverlayHideEvent = this.time.delayedCall(1000, () => {
    this.turnOverlayRect?.setVisible(false);
    this.turnOverlayText?.setVisible(false);
  });
}

/**
 * Shows controlled squares overlay while button is held
 */
export function showControlledSquaresOverlay(this: GameScene): void {
  const controlMap = calculateControlPower(this.chessBoard.getWrapper());
  this.chessBoard.renderControlOverlay(controlMap, {
    whiteColor: '#ffffff',
    blackColor: '#000000',
    alpha: 0.5,
    usePowerAlpha: false
  });
}

/**
 * Hides controlled squares overlay
 */
export function hideControlledSquaresOverlay(this: GameScene): void {
  this.chessBoard.clearControlOverlay();
}

/**
 * Toggles mobile event log overlay visibility
 */
export function toggleMobileEventLog(this: GameScene): void {
  this.isMobileEventLogVisible = !this.isMobileEventLogVisible;
  if (this.currentLayout) {
    this.positionEventLog(this.currentLayout);
  }
}

/**
 * Updates opponent's deck and discard count displays
 * Called when receiving network sync data
 *
 * @param deckCount - Number of cards in opponent's deck
 * @param discardCount - Number of cards in opponent's discard pile
 */
export function updateOpponentDeckCounts(this: GameScene, deckCount: number, discardCount: number): void {
  this.opponentDeckCount = deckCount;
  this.opponentDiscardCount = discardCount;
  this.opponentDeckCountText.setText(`${deckCount}`);
  this.opponentDiscardCountText.setText(`${discardCount}`);
}

/**
 * Updates local player's deck and discard count displays
 *
 * @param deckCount - Number of cards in player's deck
 * @param discardCount - Number of cards in player's discard pile
 */
export function updatePlayerDeckCounts(this: GameScene, deckCount: number, discardCount: number): void {
  this.playerDeckCountText.setText(`${deckCount}`);
  this.playerDiscardCountText.setText(`${discardCount}`);
}
