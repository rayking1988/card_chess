/**
 * @fileoverview GameScene animation helpers
 *
 * @module scenes/game/GameSceneAnimations
 */

import Phaser from 'phaser';
import { Square, Color, PieceSymbol } from 'chess.js';
import { CardComponent } from '../../components/Card';
import type { Card } from '../../managers/GameStateManager';
import { drawTargetArrow } from './GameUIHelpers';
import { hex } from '../../utils/colors';
import type { GameScene } from '../GameScene';

/**
 * Converts a chess square to pixel coordinates
 * Accounts for board position and flipping
 *
 * @param square - Chess square notation (e.g., 'e4')
 * @returns Pixel coordinates or null if layout not ready
 */
export function getSquarePixel(this: GameScene, square: Square): { x: number; y: number } | null {
  if (!this.currentLayout) return null;

  const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = 8 - parseInt(square[1], 10);
  let col = file;
  let row = rank;

  if (this.localColor === 'black') {
    col = 7 - col;
    row = 7 - row;
  }

  return {
    x: this.boardTopLeft.x + col * this.boardSquareSize + this.boardSquareSize / 2,
    y: this.boardTopLeft.y + row * this.boardSquareSize + this.boardSquareSize / 2
  };
}

/**
 * Gets the world position of a container
 * Accounts for parent transforms
 *
 * @param container - Container to get position of
 * @returns World coordinates
 */
export function getWorldPosition(this: GameScene, container: Phaser.GameObjects.Container): { x: number; y: number } {
  const matrix = container.getWorldTransformMatrix();
  const point = new Phaser.Math.Vector2();
  matrix.transformPoint(0, 0, point);
  return { x: point.x, y: point.y };
}

/**
 * Animates a card being played
 * Card moves from hand to display position, shows target arrow, then moves to discard
 *
 * @param cardData - Card data (null for face-down)
 * @param side - Which player played the card
 * @param target - Optional target square for the card effect
 */
export function animateCardPlay(
  this: GameScene,
  cardData: Card | null,
  side: 'local' | 'opponent',
  target?: Square,
  onComplete?: () => void
): void {
  const layout = this.currentLayout;
  if (!layout) return;

  let startX = side === 'local' ? layout.cardHandX : layout.opponentHandX;
  let startY = side === 'local' ? layout.cardHandY : layout.opponentHandY;

  if (side === 'local' && cardData) {
    const cardComponent = this.cardHand.getCardComponent(cardData.id);
    if (cardComponent) {
      const worldPos = this.getWorldPosition(cardComponent.getContainer());
      startX = worldPos.x;
      startY = worldPos.y;
    }
  }

  const displayScale = 0.9 * layout.panelScale;
  // Always show card face-up (not face-down) during animation
  const animCard = new CardComponent(this, startX, startY, cardData, false, displayScale);
  animCard.setDepth(50);
  const cardContainer = animCard.getContainer();
  const displayPos = { x: layout.playedCardX, y: layout.playedCardY };
  
  // Calculate discard pile position - match the actual top card position from positionLeftPanel
  const discardX = layout.leftPanelX;
  const discardY = side === 'local' 
    ? layout.playerDiscardY 
    : layout.opponentDiscardY;

  // For local cards, lockDiscardTop is called by the caller before playCard
  // For opponent cards, lock here since there's no game state update
  if (side === 'opponent') {
    this.lockDiscardTop(side);
  }

  this.tweens.add({
    targets: cardContainer,
    x: displayPos.x,
    y: displayPos.y,
    scaleX: displayScale,
    scaleY: displayScale,
    duration: 280,
    ease: 'Quad.easeOut',
    onComplete: () => {
      const targetPos = target ? this.getSquarePixel(target) : null;
      const arrow = targetPos
        ? drawTargetArrow(this, displayPos, targetPos, hex('#ffcc00'), 18 * layout.panelScale, 4 * layout.panelScale)
        : null;

      this.time.delayedCall(3000, () => {
        arrow?.destroy();
        // Animate card flying to discard pile
        this.tweens.add({
          targets: cardContainer,
          x: discardX,
          y: discardY,
          scaleX: displayScale * 0.6,
          scaleY: displayScale * 0.6,
          alpha: 0.7,
          duration: 320,
          ease: 'Quad.easeIn',
          onComplete: () => {
            animCard.destroy();
            // Call the completion callback (adds card to discard)
            onComplete?.();
            this.releaseDiscardTop(side);
          }
        });
      });
    }
  });
}

/**
 * Animates a piece moving on the board
 * Creates a ghost image that moves from source to destination
 *
 * @param from - Source square
 * @param to - Destination square
 * @param movingPiece - Piece being moved
 * @param capturedPiece - Piece being captured (if any)
 */
export function animatePieceMove(
  this: GameScene,
  from: Square,
  to: Square,
  movingPiece: { type: PieceSymbol; color: Color },
  capturedPiece?: { type: PieceSymbol; color: Color } | null
): void {
  const fromPos = this.getSquarePixel(from);
  const toPos = this.getSquarePixel(to);
  const textureKey = this.chessBoard.getPieceTextureKey(movingPiece.type, movingPiece.color);

  if (!fromPos || !toPos || !textureKey) return;

  const ghost = this.add.image(fromPos.x, fromPos.y, textureKey);
  ghost.setScale(this.boardScale * 1.1);
  ghost.setDepth(30);

  const targetSprite = this.chessBoard.getPieceSprite(to);
  if (targetSprite) {
    targetSprite.setAlpha(0);
  }

  if (capturedPiece) {
    this.animatePieceDestroy(capturedPiece, to);
  }

  this.animations.moveTo(ghost, toPos.x, toPos.y, {
    duration: 300,
    onComplete: () => {
      if (targetSprite) {
        targetSprite.setAlpha(1);
      }
      ghost.destroy();
    }
  });
}

/**
 * Animates a piece being deployed (placed on board)
 * Uses pop-in animation
 *
 * @param square - Square where piece was deployed
 */
export function animatePieceDeploy(this: GameScene, square: Square): void {
  const sprite = this.chessBoard.getPieceSprite(square);
  if (!sprite) return;

  const targetScale = sprite.scaleX || this.boardScale * 1.1;
  this.animations.popIn(sprite, targetScale);
}

/**
 * Animates a piece being destroyed (removed from board)
 * Creates a ghost image that fades out
 *
 * @param piece - Piece being destroyed
 * @param square - Square where piece was located
 */
export function animatePieceDestroy(this: GameScene, piece: { type: PieceSymbol; color: Color }, square: Square): void {
  const textureKey = this.chessBoard.getPieceTextureKey(piece.type, piece.color);
  const pos = this.getSquarePixel(square);
  if (!textureKey || !pos) return;

  const ghost = this.add.image(pos.x, pos.y, textureKey);
  ghost.setScale(this.boardScale * 1.1);
  ghost.setDepth(35);
  this.animations.animatePieceDestroy(ghost, square, {}, () => ghost.destroy());
}
