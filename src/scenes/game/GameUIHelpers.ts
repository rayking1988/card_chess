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

const PILE_STACK_OFFSET_X = -1.8;
const PILE_STACK_OFFSET_Y = -3.2;

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
  
  const label = text.trim();
  const buttonText = scene.add.text(0, -5, label.toUpperCase(), {
    fontFamily: 'BoldPixels, Arial',
    fontSize: '30px',
    color: '#ffffff',
    stroke: '#000000ff',
    strokeThickness: 8
  }).setOrigin(0.5);
  buttonText.setVisible(label.length > 0);
  
  container.add([bgNormal, bgPressed, buttonText]);
  
  const hitWidth = bgNormal.width;
  const hitHeight = bgNormal.height;
  container.setSize(hitWidth, hitHeight);
  container.setInteractive({ useHandCursor: true });
  container.setData('baseScale', 1);
  container.setData('label', buttonText);
  container.setData('bgNormal', bgNormal);
  container.setData('bgPressed', bgPressed);
  
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
 * Creates a stack of card images for deck/discard pile visual depth
 * 
 * @param scene - Phaser scene
 * @param x - X position for pile center
 * @param y - Y position for pile center
 * @param scale - Scale factor for card images
 * @param maxLayers - Maximum number of visual layers
 * @param alpha - Opacity for card images
 * @param texture - Texture key for cards (default: 'card_back')
 * @returns Array of card images for the pile
 */
export function createPileStack(
  scene: Phaser.Scene,
  x: number,
  y: number,
  scale: number,
  maxLayers: number,
  alpha: number,
  texture: string = 'card_back'
): Phaser.GameObjects.Image[] {
  const stack: Phaser.GameObjects.Image[] = [];
  for (let i = 0; i < maxLayers; i++) {
    const card = scene.add.image(x, y, texture);
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
 * The bottom of the pile stays fixed - cards stack upward from the base position
 * 
 * @param stack - Array of card back images for the pile
 * @param x - Base X position for pile center
 * @param y - Base Y position for pile BOTTOM (cards stack upward from here)
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
  const offsetX = PILE_STACK_OFFSET_X * scale;
  const offsetY = PILE_STACK_OFFSET_Y * scale;
  
  for (let i = 0; i < stack.length; i++) {
    const card = stack[i];
    if (i < layers) {
      // Stack cards from bottom (i=0) upward
      // Each layer is offset up and left from the previous
      card.setPosition(x + i * offsetX, y + i * offsetY);
      card.setScale(scale);
      card.setAlpha(alpha);
      card.setVisible(true);
    } else {
      card.setVisible(false);
    }
  }
}

/**
 * Gets the top-most card position for a pile stack.
 *
 * @param x - Base X position for pile center
 * @param y - Base Y position for pile bottom
 * @param scale - Scale factor for card images
 * @param count - Number of cards in the pile
 * @returns Top-most card position for the pile
 */
export function getPileTopPosition(
  x: number,
  y: number,
  scale: number,
  count: number
): { x: number; y: number } {
  const layers = getPileLayerCount(count);
  if (layers <= 0) {
    return { x, y };
  }
  const offsetX = PILE_STACK_OFFSET_X * scale;
  const offsetY = PILE_STACK_OFFSET_Y * scale;
  const offsetIndex = Math.max(0, layers - 1);
  return {
    x: x + offsetIndex * offsetX,
    y: y + offsetIndex * offsetY
  };
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
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const curveFactor = 0.25;
  const controlX = midX - dy * curveFactor;
  const controlY = midY + dx * curveFactor;

  arrow.lineStyle(lineWidth, color, 0.9);
  arrow.beginPath();
  arrow.moveTo(from.x, from.y);

  const segments = Math.max(20, Math.floor(distance / 10));
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const invT = 1 - t;
    const x = invT * invT * from.x + 2 * invT * t * controlX + t * t * to.x;
    const y = invT * invT * from.y + 2 * invT * t * controlY + t * t * to.y;
    arrow.lineTo(x, y);
  }
  arrow.strokePath();

  const tangentX = 2 * (to.x - controlX);
  const tangentY = 2 * (to.y - controlY);
  const angle = Math.atan2(tangentY, tangentX);
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
