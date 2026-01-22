/**
 * @fileoverview Stopwatch Component - Turn time cost tracker with threshold warnings
 * 
 * This component tracks accumulated time costs during a player's turn.
 * When the stopwatch reaches 60 seconds, the opponent draws a card.
 * Visual feedback warns players as they approach the threshold.
 * 
 * Requirements addressed:
 * - 5.1: Display below the clock using asset ./dist/stopwatch
 * - 5.2: Track accumulated time cost per turn
 * - 5.3: At 60+ seconds, subtract 60 and opponent draws 1 card
 * 
 * @module components/Stopwatch
 * @requires phaser
 */

import Phaser from 'phaser';
import { STOPWATCH, STOPWATCH_COLORS, STOPWATCH_LAYOUT } from '../config';

/* ============================================
 * STOPWATCH CONFIGURATION CONSTANTS
 * ============================================
 */

/** Stopwatch display width in pixels */
const STOPWATCH_WIDTH = STOPWATCH_LAYOUT.WIDTH;

/** Stopwatch display height in pixels */
const STOPWATCH_HEIGHT = STOPWATCH_LAYOUT.HEIGHT;

/** 
 * Threshold in seconds that triggers opponent card draw
 * When stopwatch reaches this value, 60 is subtracted and opponent draws
 */
const THRESHOLD_SECONDS = STOPWATCH.THRESHOLD_SECONDS;

/** Absolute time thresholds for visual warnings (in seconds) */
const WARNING_THRESHOLDS = {
  low: STOPWATCH.WARNING_THRESHOLDS.LOW,
  high: STOPWATCH.WARNING_THRESHOLDS.HIGH
};

/* ============================================
 * UTILITY FUNCTIONS
 * ============================================
 */

/**
 * Formats stopwatch time into two-digit seconds display
 * 
 * @param seconds - Time in seconds to format
 * @returns Two-digit string representation
 */
function formatStopwatchTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  return safeSeconds.toString().padStart(2, '0');
}

/* ============================================
 * STOPWATCH COMPONENT CLASS
 * ============================================
 */

/**
 * StopwatchComponent - Visual turn time tracker
 * 
 * Displays accumulated time cost for the current turn.
 * Provides visual warnings as the player approaches the 60-second threshold.
 * When threshold is crossed, opponent draws a card.
 */
export class StopwatchComponent {
  private container: Phaser.GameObjects.Container;
  private stopwatchSprite: Phaser.GameObjects.Image;
  private timeText: Phaser.GameObjects.Text;
  private currentTime: number = 0;
  private lastDisplayedTime: number = -1;
  private lastWarningLevel: 'none' | 'low' | 'high' = 'none';
  private baseTimeColor: string = '#000000';

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.container = scene.add.container(x, y);
    
    this.stopwatchSprite = scene.add.image(0, 0, 'stopwatch');
    this.stopwatchSprite.setDisplaySize(STOPWATCH_WIDTH, STOPWATCH_HEIGHT);
    this.container.add(this.stopwatchSprite);
    
    this.timeText = scene.add.text(0, 5, '00', {
      fontSize: '28px',
      fontFamily: 'Digital7, "Courier New"',
      color: '#ffffff',
      fontStyle: 'normal'
    }).setOrigin(0.5);
    const maxStopwatchText = '88';
    const initialStopwatchText = this.timeText.text;
    this.timeText.setText(maxStopwatchText);
    const stopwatchTextWidth = this.timeText.width;
    const stopwatchTextHeight = this.timeText.height;
    this.timeText.setText(initialStopwatchText);
    this.timeText.setFixedSize(stopwatchTextWidth, stopwatchTextHeight);
    this.timeText.setStyle({ align: 'center' });
    this.container.add(this.timeText);
    
    this.updateDisplay();
  }

  setTime(seconds: number): void {
    this.currentTime = seconds;
    this.updateDisplay();
  }

  setBaseTimeColor(color: string): void {
    this.baseTimeColor = color;
    this.lastDisplayedTime = -1;
    this.updateDisplay();
  }

  addTime(seconds: number): void {
    this.currentTime += seconds;
    this.updateDisplay();
  }

  reset(): void {
    this.currentTime = 0;
    this.updateDisplay();
  }

  getTime(): number {
    return this.currentTime;
  }

  isThresholdReached(): boolean {
    return this.currentTime >= THRESHOLD_SECONDS;
  }

  getThresholdCrossings(): number {
    return Math.floor(this.currentTime / THRESHOLD_SECONDS);
  }

  private updateDisplay(): void {
    const displayTime = Math.floor(this.currentTime);
    
    // Use absolute thresholds: black < 30, orange 30-49, red >= 50
    let currentWarningLevel: 'none' | 'low' | 'high' = 'none';
    if (this.currentTime >= WARNING_THRESHOLDS.high) {
      currentWarningLevel = 'high';
    } else if (this.currentTime >= WARNING_THRESHOLDS.low) {
      currentWarningLevel = 'low';
    }
    
    const warningChanged = currentWarningLevel !== this.lastWarningLevel;
    const timeChanged = displayTime !== this.lastDisplayedTime;
    
    if (!timeChanged && !warningChanged) {
      return;
    }
    
    if (timeChanged) {
      this.timeText.setText(formatStopwatchTime(this.currentTime));
      this.lastDisplayedTime = displayTime;
    }
    
    if (warningChanged) {
      this.lastWarningLevel = currentWarningLevel;
    }

    if (timeChanged || warningChanged) {
      let timeColor = this.baseTimeColor;
      if (currentWarningLevel === 'high') {
        timeColor = STOPWATCH_COLORS.HIGH;
      } else if (currentWarningLevel === 'low') {
        timeColor = STOPWATCH_COLORS.LOW;
      }
      this.timeText.setColor(timeColor);
    }
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  getPosition(): { x: number; y: number } {
    return { x: this.container.x, y: this.container.y };
  }

  setScale(scale: number): void {
    this.container.setScale(scale);
  }

  setDepth(depth: number): void {
    this.container.setDepth(depth);
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  setAlpha(alpha: number): void {
    this.container.setAlpha(alpha);
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  getTimeText(): Phaser.GameObjects.Text {
    return this.timeText;
  }

  getDimensions(): { width: number; height: number } {
    return { width: STOPWATCH_WIDTH, height: STOPWATCH_HEIGHT };
  }

  destroy(): void {
    this.container.destroy();
  }
}

export function createStopwatch(
  scene: Phaser.Scene,
  x: number,
  y: number
): StopwatchComponent {
  return new StopwatchComponent(scene, x, y);
}

export { THRESHOLD_SECONDS };
