/**
 * @fileoverview UI helper functions for GameScene
 * 
 * Contains utility functions for creating UI elements like buttons,
 * pile stacks, and interactive components.
 * 
 * @module scenes/game/GameUIHelpers
 */

import Phaser from 'phaser';
import { CardComponent } from '../../components/Card';
import { DECK_SIZE } from '../../managers/DeckManager';
import { MAX_PILE_LAYERS } from './GameConstants';

/**
 * Creates an image-based button with hover and press states
 * 
 * @param scene - Phaser scene
 * @param x - X position for button center
 * @param y - Y position for button center
 * @param text - Button label text
 * @param normalTexture - Texture key for normal state
 * @param pressedTexture - Texture key for pressed state
 * @param onClick - Callback function when button is clicked
 * @returns Container with button elements
 */
export function createImageButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  normalTexture: string,
  pressedTexture: string,
  onClick: () => void
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y);
  
  const bgNormal = scene.add.image(0, 0, normalTexture);
  const bgPressed = scene.add.image(0, 0, pressedTexture);
  bgPressed.setVisible(false);
  
  const buttonText = scene.add.text(0, -2, text, {
    fontFamily: 'BoldPixels, Arial',
    fontSize: '20px',
    color: '#ffffff',
    stroke: '#000000',
    strokeThickness: 2
  }).setOrigin(0.5);
  
  container.add([bgNormal, bgPressed, buttonText]);
  
  const hitWidth = bgNormal.width;
  const hitHeight = bgNormal.height;
  container.setSize(hitWidth, hitHeight);
  container.setInteractive({ useHandCursor: true });
  container.setData('baseScale', 1);
  
  const applyScale = (multiplier: number) => {
    const baseScale = (container.getData('baseScale') as number) ?? 1;
    container.setScale(baseScale * multiplier);
  };
  
  container.on('pointerover', () => {
    applyScale(1.05);
  });
  
  container.on('pointerout', () => {
    applyScale(1);
    bgNormal.setVisible(true);
    bgPressed.setVisible(false);
  });
  
  container.on('pointerdown', () => {
    bgNormal.setVisible(false);
    bgPressed.setVisible(true);
    applyScale(0.98);
  });
  
  container.on('pointerup', () => {
    bgNormal.setVisible(true);
    bgPressed.setVisible(false);
    applyScale(1.05);
    onClick();
  });
  
  return container;
}

/**
 * Creates a stack of card back images for deck/discard pile visual depth
 * 
 * @param scene - Phaser scene
 * @param x - X position for pile center
 * @param y - Y position for pile center
 * @param scale - Scale factor for card images
 * @param maxLayers - Maximum number of visual layers
 * @param alpha - Opacity for card images
 * @returns Array of card back images for the pile
 */
export function createPileStack(
  scene: Phaser.Scene,
  x: number,
  y: number,
  scale: number,
  maxLayers: number,
  alpha: number
): Phaser.GameObjects.Image[] {
  const stack: Phaser.GameObjects.Image[] = [];
  for (let i = 0; i < maxLayers; i++) {
    const card = scene.add.image(x, y, 'card_back');
    card.setScale(scale);
    card.setAlpha(alpha);
    card.setDepth(7 + i);
    card.setVisible(false);
    stack.push(card);
  }
  return stack;
}

/**
 * Calculates number of visual layers to display for a pile based on card count
 * 
 * @param count - Number of cards in the pile
 * @returns Number of visual layers to display (0 to MAX_PILE_LAYERS)
 */
export function getPileLayerCount(count: number): number {
  if (count <= 0) return 0;
  const cardsPerLayer = DECK_SIZE / MAX_PILE_LAYERS;
  const layers = Math.ceil(count / cardsPerLayer);
  return Math.min(MAX_PILE_LAYERS, Math.max(1, Math.min(count, layers)));
}

/**
 * Positions and shows/hides pile stack images based on card count
 * Creates a 3D stacking effect with offset layers
 * 
 * @param stack - Array of card back images for the pile
 * @param x - Base X position for pile center
 * @param y - Base Y position for pile center
 * @param scale - Scale factor for card images
 * @param count - Number of cards in the pile
 * @param alpha - Opacity for card images
 */
export function layoutPileStack(
  stack: Phaser.GameObjects.Image[],
  x: number,
  y: number,
  scale: number,
  count: number,
  alpha: number
): void {
  const layers = getPileLayerCount(count);
  const offsetX = 2 * scale;
  const offsetY = 3 * scale;
  for (let i = 0; i < stack.length; i++) {
    const card = stack[i];
    if (i < layers) {
      const layerOffset = layers - i - 1;
      card.setPosition(x + layerOffset * offsetX, y + layerOffset * offsetY);
      card.setScale(scale);
      card.setAlpha(alpha);
      card.setVisible(true);
    } else {
      card.setVisible(false);
    }
  }
}

/**
 * Makes a CardComponent clickable with proper hit area
 * 
 * @param card - CardComponent to make clickable
 * @param onClick - Callback function when card is clicked
 */
export function makeCardComponentClickable(card: CardComponent, onClick: () => void): void {
  const container = card.getContainer();
  const bounds = container.getBounds();
  const scaleX = container.scaleX || 1;
  const scaleY = container.scaleY || 1;
  const width = bounds.width / scaleX;
  const height = bounds.height / scaleY;
  const hitArea = new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height);
  container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
  container.on('pointerdown', () => onClick());
  if (container.input) {
    container.input.cursor = 'pointer';
  }
}

/**
 * Draws an arrow from one point to another
 * 
 * @param scene - Phaser scene
 * @param from - Start position
 * @param to - End position
 * @param color - Arrow color
 * @param headSize - Size of arrow head
 * @param lineWidth - Width of arrow line
 * @returns Graphics object for the arrow
 */
export function drawTargetArrow(
  scene: Phaser.Scene,
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: number,
  headSize: number,
  lineWidth: number
): Phaser.GameObjects.Graphics {
  const arrow = scene.add.graphics();
  arrow.setDepth(45);
  arrow.lineStyle(lineWidth, color, 0.9);
  arrow.beginPath();
  arrow.moveTo(from.x, from.y);
  arrow.lineTo(to.x, to.y);
  arrow.strokePath();

  const angle = Phaser.Math.Angle.Between(from.x, from.y, to.x, to.y);
  const headLength = headSize;
  const headWidth = headSize * 0.75;

  const tipX = to.x;
  const tipY = to.y;
  const leftX = tipX - headLength * Math.cos(angle) + headWidth * Math.sin(angle);
  const leftY = tipY - headLength * Math.sin(angle) - headWidth * Math.cos(angle);
  const rightX = tipX - headLength * Math.cos(angle) - headWidth * Math.sin(angle);
  const rightY = tipY - headLength * Math.sin(angle) + headWidth * Math.cos(angle);

  arrow.fillStyle(color, 0.95);
  arrow.beginPath();
  arrow.moveTo(tipX, tipY);
  arrow.lineTo(leftX, leftY);
  arrow.lineTo(rightX, rightY);
  arrow.closePath();
  arrow.fillPath();

  return arrow;
}
