/**
 * @fileoverview GameScene card interaction helpers
 *
 * @module scenes/game/GameSceneCards
 */

import { Square, Color, PieceSymbol } from 'chess.js';
import { CardComponent } from '../../components/Card';
import type { Card, PieceType } from '../../managers/GameStateManager';
import { calculateControlPower, playerControlsSquare } from '../../utils/controlPower';
import { makeCardComponentClickable } from './GameUIHelpers';
import type { GameScene } from '../GameScene';

/**
 * Sets up callbacks for card hand interactions
 * Configures target validation and card play handlers
 */
export function setupCardHandCallbacks(this: GameScene): void {
  // Set target validator for piece deployment and destruction
  this.cardHand.setTargetValidator((square, card) => {
    return this.validateCardTarget(card, square);
  });

  // Handle non-targeted card play
  this.cardHand.onCardPlayed = (card: Card) => {
    this.handleLocalCardPlay(card);
  };

  // Handle targeted card play
  this.cardHand.onCardTargeted = (card: Card, target: Square) => {
    this.handleLocalCardPlay(card, target);
  };
}

/**
 * Validates if a card can target a specific square
 * Uses control power to determine valid targets
 *
 * @param card - Card being played
 * @param square - Target square
 * @returns true if target is valid
 */
export function validateCardTarget(this: GameScene, card: Card, square: Square): boolean {
  const controlMap = calculateControlPower(this.chessBoard.getWrapper());
  const playerControls = playerControlsSquare(controlMap, square, this.localColor);

  if (card.effect.action === 'DEPLOY_PIECE') {
    // Can only deploy to empty squares you control
    const piece = this.chessBoard.getWrapper().getPiece(square);
    if (!playerControls || piece) {
      return false;
    }

    // Check if deployment would give check (not allowed)
    const pieceType = (card.effect as { piece: PieceType }).piece;
    const boardFEN = this.chessBoard.getPosition();
    if (this.gameStateManager.wouldDeploymentGiveCheck(square, pieceType, this.localColor, boardFEN)) {
      return false;
    }

    return true;
  } else if (card.effect.action === 'DESTROY_PIECE') {
    // Can only destroy pieces on squares you control
    const piece = this.chessBoard.getWrapper().getPiece(square);
    return playerControls && !!piece;
  }

  return false;
}

/**
 * Handles local player playing a card
 *
 * Algorithm:
 * 1. Validate turn and game state
 * 2. Check if in discard mode (discard instead of play)
 * 3. Validate card can be played (cost, requirements)
 * 4. Execute card effect on board
 * 5. Send to network and update UI
 *
 * @param card - Card being played
 * @param target - Target square (for targeted cards)
 */
export function handleLocalCardPlay(this: GameScene, card: Card, target?: Square): void {
  // Check if it's our turn
  if (!this.gameStateManager.isLocalPlayerTurn()) {
    this.logEvent('system', 'Not your turn!');
    return;
  }

  if (this.isConnectionPaused) {
    this.logEvent('system', 'Connection paused. Waiting for opponent.');
    return;
  }

  // Check if in discard mode
  if (this.isDiscardMode) {
    // In discard mode, clicking a card discards it
    this.discardCard(card);
    return;
  }

  // Check game phase
  if (this.gameStateManager.getPhase() !== 'playing') {
    this.logEvent('system', 'Game not started yet!');
    return;
  }

  // Validate card can be played
  const validation = this.gameStateManager.canPlayCard(card, this.localColor);
  if (!validation.canPlay) {
    this.logEvent('system', validation.reason);
    return;
  }

  // Lock discard display BEFORE playing card to prevent UI update during animation
  this.lockDiscardTop('local');

  // Play the card
  const result = this.gameStateManager.playCard(card.id, this.localColor, target);

  if (result.success) {
    this.logEvent(this.localColor, `Played ${card.name}`);
    // Animation will call releaseDiscardTop when complete
    this.animateCardPlay(card, 'local', target);

    // Handle piece deployment/destruction on board
    if (card.effect.action === 'DEPLOY_PIECE' && target) {
      const piece = (card.effect as { piece: PieceSymbol }).piece;
      const color: Color = this.localColor === 'white' ? 'w' : 'b';
      this.chessBoard.placePiece(target, piece, color);
      this.gameStateManager.setBoardFEN(this.chessBoard.getPosition());
      this.animatePieceDeploy(target);
    } else if (card.effect.action === 'DESTROY_PIECE' && target) {
      const targetPiece = this.chessBoard.getWrapper().getPiece(target);
      this.chessBoard.removePiece(target);
      this.gameStateManager.setBoardFEN(this.chessBoard.getPosition());
      if (targetPiece) {
        this.animatePieceDestroy(targetPiece, target);
      }
    }

    // Send to network with card details for opponent to sync
    const pieceType = card.effect.action === 'DEPLOY_PIECE' ? (card.effect as { piece: PieceSymbol }).piece : undefined;
    this.networkManager?.sendPlayCard(card.id, card.name, target, pieceType, card.effect.action);

    // Update hand display
    this.updateHandDisplay();

    // Check for checkmate/stalemate after card play (Requirement 3.8)
    this.checkGameEndConditions();
  } else {
    // Release lock if card play failed
    this.releaseDiscardTop('local');
    this.logEvent('system', result.message);
  }

  this.updateUIFromState();
}

/**
 * Sets the top card for a discard pile
 *
 * @param side - Which discard pile to update
 * @param cardData - Card data or null to clear
 */
export function setDiscardTopCard(this: GameScene, side: 'local' | 'opponent', cardData: Card | null): void {
  const layout = this.currentLayout;
  if (!layout) return;
  const scale = 0.55 * layout.panelScale;
  const isOpponent = side === 'opponent';
  const existing = isOpponent ? this.opponentDiscardTopCard : this.playerDiscardTopCard;
  const position = isOpponent ? layout.opponentDiscardY : layout.playerDiscardY;

  // Destroy existing top card
  if (existing) {
    existing.destroy();
  }

  // If no card data, clear the reference (don't show card back for unknown cards)
  if (!cardData) {
    if (isOpponent) {
      this.opponentDiscardTopCard = null;
    } else {
      this.playerDiscardTopCard = null;
    }
    return;
  }

  // Create top card - always face-up (discard piles are public information)
  const topCard = new CardComponent(this, 0, 0, cardData, false, scale);
  topCard.setDepth(11);
  topCard.getContainer().setPosition(layout.leftPanelX, position);
  makeCardComponentClickable(topCard, () => this.showDiscardViewer(side));

  if (isOpponent) {
    this.opponentDiscardTopCard = topCard;
  } else {
    this.playerDiscardTopCard = topCard;
  }
}

/**
 * Refreshes top cards for both discard piles
 */
export function refreshDiscardTopCards(this: GameScene): void {
  if (!this.currentLayout) return;
  if (this.suppressLocalDiscardTop === 0) {
    const localDiscard = this.gameStateManager.getPlayer(this.localColor).discard;
    const localTop = localDiscard.length > 0 ? localDiscard[localDiscard.length - 1] : null;
    this.setDiscardTopCard('local', localTop);
  }

  if (this.suppressOpponentDiscardTop === 0) {
    // Find the last non-null card in opponent's discard
    const nonNullCards = this.opponentDiscardCards.filter(c => c !== null);
    const opponentTop = nonNullCards.length > 0
      ? nonNullCards[nonNullCards.length - 1]
      : null;
    this.setDiscardTopCard('opponent', opponentTop);
  }
}

/**
 * Prevents discard top updates during animations
 *
 * @param side - Which discard pile to lock
 */
export function lockDiscardTop(this: GameScene, side: 'local' | 'opponent'): void {
  if (side === 'local') {
    this.suppressLocalDiscardTop++;
  } else {
    this.suppressOpponentDiscardTop++;
  }
}

/**
 * Releases discard top lock and refreshes when safe
 *
 * @param side - Which discard pile to release
 */
export function releaseDiscardTop(this: GameScene, side: 'local' | 'opponent'): void {
  if (side === 'local') {
    this.suppressLocalDiscardTop = Math.max(0, this.suppressLocalDiscardTop - 1);
  } else {
    this.suppressOpponentDiscardTop = Math.max(0, this.suppressOpponentDiscardTop - 1);
    // Apply any pending discard count from stats sync when suppression is released
    if (this.suppressOpponentDiscardTop === 0) {
      if (this.pendingOpponentDiscardCount !== null) {
        this.opponentDiscardCount = this.pendingOpponentDiscardCount;
        this.pendingOpponentDiscardCount = null;
      }
    }
  }

  this.refreshDiscardTopCards();
  // Reposition left panel to update pile stack visuals
  if (this.currentLayout) {
    this.positionLeftPanel(this.currentLayout);
  }
}
