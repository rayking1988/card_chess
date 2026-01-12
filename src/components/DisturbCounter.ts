/**
 * @fileoverview DisturbCounter Component - Shows current Disturb tag count
 *
 * @module components/DisturbCounter
 * @requires phaser
 */

import Phaser from 'phaser';
import { hex } from '../utils/colors';

const COUNTER_WIDTH = 90;
const COUNTER_HEIGHT = 26;
const ICON_RADIUS = 9;

export class DisturbCounterComponent {
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Graphics;
  private iconCircle: Phaser.GameObjects.Arc;
  private iconText: Phaser.GameObjects.Text;
  private countText: Phaser.GameObjects.Text;
  private labelText: Phaser.GameObjects.Text;

  private currentValue: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, label: string = 'Disturb') {
    this.container = scene.add.container(x, y);

    this.background = scene.add.graphics();
    this.background.fillStyle(hex('#151515'), 0.85);
    this.background.lineStyle(2, hex('#6c3a8f'), 0.9);
    this.background.fillRoundedRect(
      -COUNTER_WIDTH / 2,
      -COUNTER_HEIGHT / 2,
      COUNTER_WIDTH,
      COUNTER_HEIGHT,
      6
    );
    this.background.strokeRoundedRect(
      -COUNTER_WIDTH / 2,
      -COUNTER_HEIGHT / 2,
      COUNTER_WIDTH,
      COUNTER_HEIGHT,
      6
    );
    this.container.add(this.background);

    this.iconCircle = scene.add.circle(-COUNTER_WIDTH / 2 + 16, 0, ICON_RADIUS, hex('#7b3fa3'), 1);
    this.container.add(this.iconCircle);
    this.iconText = scene.add.text(-COUNTER_WIDTH / 2 + 16, 0, 'D', {
      fontSize: '12px',
      fontFamily: 'BoldPixels, Arial',
      color: '#ffffff'
    }).setOrigin(0.5);
    this.container.add(this.iconText);

    this.countText = scene.add.text(-COUNTER_WIDTH / 2 + 30, 0, '0', {
      fontSize: '14px',
      fontFamily: 'BoldPixels, Arial',
      color: '#ffffff'
    }).setOrigin(0, 0.5);
    this.container.add(this.countText);

    this.labelText = scene.add.text(0, -22, label, {
      fontSize: '10px',
      fontFamily: 'BoldPixels, Arial',
      color: '#cccccc'
    }).setOrigin(0.5);
    this.labelText.setVisible(label.trim().length > 0);
    this.container.add(this.labelText);
  }

  setValue(value: number): void {
    if (value === this.currentValue) return;
    this.currentValue = value;
    this.countText.setText(`${value}`);
  }

  setLabel(label: string): void {
    this.labelText.setText(label);
    this.labelText.setVisible(label.trim().length > 0);
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
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

  getDimensions(): { width: number; height: number } {
    return { width: COUNTER_WIDTH, height: COUNTER_HEIGHT };
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }
}

export function createDisturbCounter(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string = 'Disturb'
): DisturbCounterComponent {
  return new DisturbCounterComponent(scene, x, y, label);
}
