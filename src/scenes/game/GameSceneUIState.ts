/**
 * @fileoverview GameScene UI state and animation helpers
 *
 * @module scenes/game/GameSceneUIState
 */

import type { ClockComponent } from '../../components/Clock';
import type { DisturbCounterComponent } from '../../components/DisturbCounter';
import type { EnergyBarComponent } from '../../components/EnergyBar';
import type { StopwatchComponent } from '../../components/Stopwatch';
import type { GameScene } from '../GameScene';
import type { UISnapshot } from './GameTypes';
import type { PlayerColor } from '../../managers/GameStateManager';
import { calculateControlPower } from '../../utils/controlPower';
import { formatTime } from '../../components/Clock';
import { hex } from '../../utils/colors';
import { getPileLayerCount } from './GameUIHelpers';
import { LEFT_PANEL_LAYOUT } from '../../config';

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
  const layout = this.currentLayout;
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
    if (!this.lastStateSnapshot) {
      this.updateHandDisplay();
    } else {
      const currentCards = this.cardHand.getCards();
      const currentIds = new Set(currentCards.map(card => card.id));
      const nextIds = new Set(localPlayer.hand.map(card => card.id));
      const added = localPlayer.hand.filter(card => !currentIds.has(card.id));
      const removed = currentCards.filter(card => !nextIds.has(card.id));

      if (added.length > 0 && removed.length === 0) {
        if (layout) {
          const previousDeckCount = this.lastStateSnapshot?.localDeck ?? localPlayer.deck.length;
          const deckScale = LEFT_PANEL_LAYOUT.DECK_SCALE * layout.panelScale;
          const offsetX = -1.8 * deckScale;
          const offsetY = -3.2 * deckScale;
          const layers = getPileLayerCount(previousDeckCount);
          const deckPos = {
            x: layout.leftPanelX + Math.max(0, layers - 1) * offsetX,
            y: layout.playerDeckY + Math.max(0, layers - 1) * offsetY
          };
          this.cardHand.queueDrawCards(added, deckPos);
        } else {
          this.updateHandDisplay();
        }
      } else {
        if (this.cardHand.isAnimatingDraw()) {
          this.cardHand.cancelDrawQueue();
        }
        this.updateHandDisplay();
      }
    }
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

  // Update blocked squares for deployed pieces this turn
  // Deployed pieces cannot be moved on the turn they were deployed
  const deployedPieces = this.gameStateManager.getDeployedPiecesThisTurn(this.localColor);
  this.chessBoard.setBlockedSquares(deployedPieces);

  const snapshot: UISnapshot = {
    localClock: localPlayer.clock,
    opponentClock,
    localStopwatch: localPlayer.stopwatch,
    opponentStopwatch,
    localEnergy: localPlayer.energy,
    localEnergyCap: localPlayer.energyCap,
    opponentEnergy,
    opponentEnergyCap,
    localDisturb: localPlayer.disturbTags,
    opponentDisturb,
    localMode: localPlayer.mode,
    opponentMode,
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
    // Turn overlay is shown via updateTurnOverlay in updateUIFromState
    // No popup banner needed
  }

  const localTimeTransfer = prev.localClock > next.localClock &&
    next.localStopwatch > prev.localStopwatch &&
    (prev.localClock - next.localClock) === (next.localStopwatch - prev.localStopwatch);
  const opponentTimeTransfer = prev.opponentClock > next.opponentClock &&
    next.opponentStopwatch > prev.opponentStopwatch &&
    (prev.opponentClock - next.opponentClock) === (next.opponentStopwatch - prev.opponentStopwatch);

  const localFocusConversion = prev.localMode === 'focus' &&
    prev.localEnergy > 0 &&
    next.localEnergy === 0 &&
    (next.localClock - prev.localClock) === prev.localEnergy;
  const opponentFocusConversion = prev.opponentMode === 'focus' &&
    prev.opponentEnergy > 0 &&
    next.opponentEnergy === 0 &&
    (next.opponentClock - prev.opponentClock) === prev.opponentEnergy;

  const localDisturbConversion = prev.localMode === 'disturb' &&
    prev.localEnergy > 0 &&
    next.localEnergy === 0 &&
    (next.opponentDisturb - prev.opponentDisturb) === prev.localEnergy;
  const opponentDisturbConversion = prev.opponentMode === 'disturb' &&
    prev.opponentEnergy > 0 &&
    next.opponentEnergy === 0 &&
    (next.localDisturb - prev.localDisturb) === prev.opponentEnergy;

  if (localTimeTransfer) {
    this.animateTimeTransfer(
      'local',
      this.playerClock,
      this.playerStopwatch,
      prev.localClock,
      next.localClock,
      prev.localStopwatch,
      next.localStopwatch
    );
  } else if (!localFocusConversion && prev.localClock !== next.localClock) {
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

  if (opponentTimeTransfer) {
    this.animateTimeTransfer(
      'opponent',
      this.opponentClock,
      this.opponentStopwatch,
      prev.opponentClock,
      next.opponentClock,
      prev.opponentStopwatch,
      next.opponentStopwatch
    );
  } else if (!opponentFocusConversion && prev.opponentClock !== next.opponentClock) {
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

  if (!localTimeTransfer && prev.localStopwatch !== next.localStopwatch) {
    this.animateStopwatchChange(this.playerStopwatch, prev.localStopwatch, next.localStopwatch);
  }
  if (!opponentTimeTransfer && prev.opponentStopwatch !== next.opponentStopwatch) {
    this.animateStopwatchChange(this.opponentStopwatch, prev.opponentStopwatch, next.opponentStopwatch);
  }

  if (localFocusConversion) {
    this.animateFocusConversion('local', prev.localEnergy, prev.localClock, next.localClock, next.localEnergyCap);
  } else if (localDisturbConversion) {
    this.animateDisturbConversion(
      'local',
      prev.localEnergy,
      prev.opponentDisturb,
      next.opponentDisturb,
      next.localEnergyCap
    );
  } else if (prev.localEnergy !== next.localEnergy || prev.localEnergyCap !== next.localEnergyCap) {
    this.animateSegmentedEnergyChange('local', this.energyBar, prev.localEnergy, next.localEnergy, next.localEnergyCap);
  }

  if (opponentFocusConversion) {
    this.animateFocusConversion('opponent', prev.opponentEnergy, prev.opponentClock, next.opponentClock, next.opponentEnergyCap);
  } else if (opponentDisturbConversion) {
    this.animateDisturbConversion(
      'opponent',
      prev.opponentEnergy,
      prev.localDisturb,
      next.localDisturb,
      next.opponentEnergyCap
    );
  } else if (prev.opponentEnergy !== next.opponentEnergy || prev.opponentEnergyCap !== next.opponentEnergyCap) {
    if (this.opponentEnergyBar) {
      this.animateSegmentedEnergyChange('opponent', this.opponentEnergyBar, prev.opponentEnergy, next.opponentEnergy, next.opponentEnergyCap);
    }
  }

  if (!localDisturbConversion && !opponentDisturbConversion && prev.localDisturb !== next.localDisturb) {
    this.animateSegmentedDisturbChange('local', this.playerDisturbCounter, prev.localDisturb, next.localDisturb);
  }
  if (!localDisturbConversion && !opponentDisturbConversion && prev.opponentDisturb !== next.opponentDisturb) {
    this.animateSegmentedDisturbChange('opponent', this.opponentDisturbCounter, prev.opponentDisturb, next.opponentDisturb);
  }

  // Local draw animation is handled by CardHand draw queue.

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

  if (side === 'local') {
    return;
  }

  const previousDeckCount = this.lastStateSnapshot?.opponentDeck ?? this.opponentDeckCount;
  const deckScale = LEFT_PANEL_LAYOUT.DECK_SCALE * layout.panelScale;
  const offsetX = -1.8 * deckScale;
  const offsetY = -3.2 * deckScale;
  const layers = getPileLayerCount(previousDeckCount);
  const deckPos = {
    x: layout.leftPanelX + Math.max(0, layers - 1) * offsetX,
    y: layout.opponentDeckY + Math.max(0, layers - 1) * offsetY
  };

  const targetCards = this.opponentHandCards.slice(-count);
  targetCards.forEach(card => card.setAlpha(0));

  const animateNext = (index: number): void => {
    if (index >= targetCards.length) {
      return;
    }

    const target = targetCards[index];
    const matrix = target.getWorldTransformMatrix();
    const point = new Phaser.Math.Vector2();
    matrix.transformPoint(0, 0, point);

    const temp = this.add.image(deckPos.x, deckPos.y, 'card_back');
    temp.setScale(target.scaleX || 1);
    temp.setDepth(30);

    this.tweens.add({
      targets: temp,
      x: point.x,
      y: point.y,
      duration: 600,
      ease: 'Quad.easeOut',
      onComplete: () => {
        temp.destroy();
        target.setAlpha(1);
        this.time.delayedCall(120, () => animateNext(index + 1));
      }
    });
  };

  animateNext(0);
}

/**
 * Animates time transfer from clock to stopwatch (time cost).
 */
export function animateTimeTransfer(
  this: GameScene,
  side: 'local' | 'opponent',
  clock: ClockComponent,
  stopwatch: StopwatchComponent,
  oldClock: number,
  newClock: number,
  oldStopwatch: number,
  newStopwatch: number
): void {
  const diff = oldClock - newClock;
  if (diff <= 0) return;
  const layout = this.currentLayout;
  if (!layout) return;

  const isLocal = side === 'local';
  const existingTween = isLocal ? this.localTimeTransferTween : this.opponentTimeTransferTween;
  existingTween?.stop();

  if (isLocal) {
    this.localClockDeltaText?.destroy();
    this.localStopwatchDeltaText?.destroy();
  } else {
    this.opponentClockDeltaText?.destroy();
    this.opponentStopwatchDeltaText?.destroy();
  }

  clock.setTime(oldClock);
  stopwatch.setTime(oldStopwatch);

  const clockContainer = clock.getContainer();
  const stopwatchContainer = stopwatch.getContainer();
  const clockScale = clockContainer.scaleX || 1;
  const stopwatchScale = stopwatchContainer.scaleX || 1;
  const clockDims = clock.getDimensions();
  const stopwatchDims = stopwatch.getDimensions();
  const clockPos = {
    x: clockContainer.x + (clockDims.width / 2 + 18) * clockScale,
    y: clockContainer.y - 6 * clockScale
  };
  const stopwatchPos = {
    x: stopwatchContainer.x + (stopwatchDims.width / 2 + 18) * stopwatchScale,
    y: stopwatchContainer.y - 6 * stopwatchScale
  };

  const fontSize = 22 * layout.panelScale;
  const clockDelta = this.add.text(clockPos.x, clockPos.y, `-${diff}s`, {
    fontFamily: 'BoldPixels, Arial',
    fontSize: `${fontSize}px`,
    color: '#ff4444',
    stroke: '#000000',
    strokeThickness: 3
  }).setOrigin(0.5);
  const stopwatchDelta = this.add.text(stopwatchPos.x, stopwatchPos.y, `-${diff}s`, {
    fontFamily: 'BoldPixels, Arial',
    fontSize: `${fontSize}px`,
    color: '#ff4444',
    stroke: '#000000',
    strokeThickness: 3
  }).setOrigin(0.5);
  clockDelta.setDepth(2000);
  stopwatchDelta.setDepth(2000);

  if (isLocal) {
    this.localClockDeltaText = clockDelta;
    this.localStopwatchDeltaText = stopwatchDelta;
  } else {
    this.opponentClockDeltaText = clockDelta;
    this.opponentStopwatchDeltaText = stopwatchDelta;
  }

  const duration = Math.min(2200, 250 + diff * 40);
  const tween = this.tweens.addCounter({
    from: 0,
    to: diff,
    duration,
    ease: 'Linear',
    onUpdate: (t) => {
      const value = Math.floor(t.getValue() ?? 0);
      const remaining = Math.max(0, diff - value);
      clock.setTime(oldClock - value);
      stopwatch.setTime(oldStopwatch + value);
      const label = `-${remaining}s`;
      clockDelta.setText(label);
      stopwatchDelta.setText(label);
    },
    onComplete: () => {
      clock.setTime(newClock);
      stopwatch.setTime(newStopwatch);
      clockDelta.destroy();
      stopwatchDelta.destroy();
      if (isLocal) {
        this.localClockDeltaText = undefined;
        this.localStopwatchDeltaText = undefined;
        this.localTimeTransferTween = undefined;
      } else {
        this.opponentClockDeltaText = undefined;
        this.opponentStopwatchDeltaText = undefined;
        this.opponentTimeTransferTween = undefined;
      }
    }
  });

  if (isLocal) {
    this.localTimeTransferTween = tween;
  } else {
    this.opponentTimeTransferTween = tween;
  }
}

/**
 * Animates energy bar change by segments.
 */
export function animateSegmentedEnergyChange(
  this: GameScene,
  side: 'local' | 'opponent',
  component: EnergyBarComponent,
  from: number,
  to: number,
  cap: number
): void {
  if (!component) return;
  const steps = Math.abs(to - from);
  if (steps === 0) {
    component.setEnergy(to, cap);
    return;
  }

  const eventKey = side === 'local' ? 'localEnergyAnimEvent' : 'opponentEnergyAnimEvent';
  this[eventKey as 'localEnergyAnimEvent' | 'opponentEnergyAnimEvent']?.remove(false);

  component.setEnergy(from, cap);
  const step = from < to ? 1 : -1;
  let current = from;
  let stepCount = 0;

  this[eventKey as 'localEnergyAnimEvent' | 'opponentEnergyAnimEvent'] = this.time.addEvent({
    delay: 80,
    repeat: steps - 1,
    callback: () => {
      current += step;
      stepCount += 1;
      component.setEnergy(current, cap);
      if (stepCount >= steps) {
        component.setEnergy(to, cap);
        this[eventKey as 'localEnergyAnimEvent' | 'opponentEnergyAnimEvent'] = undefined;
      }
    }
  });
}

/**
 * Animates disturb counter change by segments.
 */
export function animateSegmentedDisturbChange(
  this: GameScene,
  side: 'local' | 'opponent',
  component: DisturbCounterComponent | undefined,
  from: number,
  to: number
): void {
  if (!component) return;
  const steps = Math.abs(to - from);
  if (steps === 0) {
    component.setValue(to);
    return;
  }

  const eventKey = side === 'local' ? 'localDisturbAnimEvent' : 'opponentDisturbAnimEvent';
  this[eventKey as 'localDisturbAnimEvent' | 'opponentDisturbAnimEvent']?.remove(false);

  component.setValue(from);
  const step = from < to ? 1 : -1;
  let current = from;
  let stepCount = 0;

  this[eventKey as 'localDisturbAnimEvent' | 'opponentDisturbAnimEvent'] = this.time.addEvent({
    delay: 80,
    repeat: steps - 1,
    callback: () => {
      current += step;
      stepCount += 1;
      component.setValue(current);
      if (stepCount >= steps) {
        component.setValue(to);
        this[eventKey as 'localDisturbAnimEvent' | 'opponentDisturbAnimEvent'] = undefined;
      }
    }
  });
}

/**
 * Animates focus mode conversion: energy drains into a time bank, then adds to clock.
 */
export function animateFocusConversion(
  this: GameScene,
  side: 'local' | 'opponent',
  energyAmount: number,
  oldClock: number,
  newClock: number,
  cap: number
): void {
  if (energyAmount <= 0) return;
  const layout = this.currentLayout;
  if (!layout) return;

  const isLocal = side === 'local';
  const energyBar = isLocal ? this.energyBar : this.opponentEnergyBar;
  const clock = isLocal ? this.playerClock : this.opponentClock;
  if (!energyBar || !clock) return;

  const focusEventKey = isLocal ? 'localFocusAnimEvent' : 'opponentFocusAnimEvent';
  const energyEventKey = isLocal ? 'localEnergyAnimEvent' : 'opponentEnergyAnimEvent';
  this[focusEventKey as 'localFocusAnimEvent' | 'opponentFocusAnimEvent']?.remove(false);
  this[energyEventKey as 'localEnergyAnimEvent' | 'opponentEnergyAnimEvent']?.remove(false);

  if (isLocal) {
    this.localFocusTimeBankText?.destroy();
    this.localFocusTimeBankText = undefined;
  } else {
    this.opponentFocusTimeBankText?.destroy();
    this.opponentFocusTimeBankText = undefined;
  }

  energyBar.setEnergy(energyAmount, cap);
  clock.setTime(oldClock);

  const clockContainer = clock.getContainer();
  const clockScale = clockContainer.scaleX || 1;
  const clockDims = clock.getDimensions();
  const bankText = this.add.text(
    clockContainer.x + (clockDims.width / 2 + 18) * clockScale,
    clockContainer.y + 18 * clockScale,
    '+0s',
    {
      fontFamily: 'BoldPixels, Arial',
      fontSize: `${22 * layout.panelScale}px`,
      color: '#66ff66',
      stroke: '#000000',
      strokeThickness: 3
    }
  ).setOrigin(0.5);
  bankText.setDepth(2000);

  if (isLocal) {
    this.localFocusTimeBankText = bankText;
  } else {
    this.opponentFocusTimeBankText = bankText;
  }

  let energyRemaining = energyAmount;
  let bank = 0;
  let drained = 0;
  const stepDelay = 110;

  this[focusEventKey as 'localFocusAnimEvent' | 'opponentFocusAnimEvent'] = this.time.addEvent({
    delay: stepDelay,
    repeat: energyAmount - 1,
    callback: () => {
      energyRemaining -= 1;
      bank += 1;
      drained += 1;
      energyBar.setEnergy(energyRemaining, cap);
      bankText.setText(`+${bank}s`);
      if (drained >= energyAmount) {
        let clockValue = oldClock;
        const transferSteps = bank;
        let transferred = 0;
        const transferEvent = this.time.addEvent({
          delay: stepDelay,
          repeat: Math.max(0, transferSteps - 1),
          callback: () => {
            bank -= 1;
            transferred += 1;
            clockValue += 1;
            clock.setTime(clockValue);
            bankText.setText(`+${bank}s`);
            if (transferred >= transferSteps) {
              clock.setTime(newClock);
              bankText.destroy();
              if (isLocal) {
                this.localFocusTimeBankText = undefined;
                this.localFocusAnimEvent = undefined;
              } else {
                this.opponentFocusTimeBankText = undefined;
                this.opponentFocusAnimEvent = undefined;
              }
            }
          }
        });
        if (isLocal) {
          this.localFocusAnimEvent = transferEvent;
        } else {
          this.opponentFocusAnimEvent = transferEvent;
        }
      }
    }
  });
}

/**
 * Animates disturb mode conversion: energy drains into opponent disturb.
 */
export function animateDisturbConversion(
  this: GameScene,
  side: 'local' | 'opponent',
  energyAmount: number,
  disturbStart: number,
  disturbEnd: number,
  cap: number
): void {
  if (energyAmount <= 0) return;

  const isLocal = side === 'local';
  const energyBar = isLocal ? this.energyBar : this.opponentEnergyBar;
  const disturbCounter = isLocal ? this.opponentDisturbCounter : this.playerDisturbCounter;
  if (!energyBar || !disturbCounter) return;

  const focusEventKey = isLocal ? 'localFocusAnimEvent' : 'opponentFocusAnimEvent';
  const energyEventKey = isLocal ? 'localEnergyAnimEvent' : 'opponentEnergyAnimEvent';
  const disturbEventKey = isLocal ? 'opponentDisturbAnimEvent' : 'localDisturbAnimEvent';
  this[focusEventKey as 'localFocusAnimEvent' | 'opponentFocusAnimEvent']?.remove(false);
  this[energyEventKey as 'localEnergyAnimEvent' | 'opponentEnergyAnimEvent']?.remove(false);
  this[disturbEventKey as 'localDisturbAnimEvent' | 'opponentDisturbAnimEvent']?.remove(false);

  energyBar.setEnergy(energyAmount, cap);
  disturbCounter.setValue(disturbStart);

  let energyRemaining = energyAmount;
  let disturbValue = disturbStart;
  let converted = 0;
  const stepDelay = 110;

  this[focusEventKey as 'localFocusAnimEvent' | 'opponentFocusAnimEvent'] = this.time.addEvent({
    delay: stepDelay,
    repeat: energyAmount - 1,
    callback: () => {
      energyRemaining -= 1;
      disturbValue += 1;
      converted += 1;
      energyBar.setEnergy(energyRemaining, cap);
      disturbCounter.setValue(disturbValue);
      if (converted >= energyAmount) {
        energyBar.setEnergy(0, cap);
        disturbCounter.setValue(disturbEnd);
        if (isLocal) {
          this.localFocusAnimEvent = undefined;
        } else {
          this.opponentFocusAnimEvent = undefined;
        }
      }
    }
  });
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
  this.opponentDeckCountText.setVisible(deckCount > 0);
  this.opponentDiscardCountText.setVisible(discardCount > 0);
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
  this.playerDeckCountText.setVisible(deckCount > 0);
  this.playerDiscardCountText.setVisible(discardCount > 0);
}
