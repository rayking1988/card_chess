/**
 * @fileoverview GameScene card interaction helpers
 *
 * @module scenes/game/GameSceneCards
 */

import { Square, Color, PieceSymbol } from 'chess.js';
import { CardComponent } from '../../components/Card';
import type { Card, PieceType, PlayerColor } from '../../managers/GameStateManager';
import { calculateControlPower, playerControlsSquare } from '../../utils/controlPower';
import { makeCardComponentClickable } from './GameUIHelpers';
import type { GameScene } from '../GameScene';

/** Color for deployment target highlights (blue) */
const DEPLOY_HIGHLIGHT_COLOR = 0x4488ff;

/** Color for destroy target highlights (red) */
const DESTROY_HIGHLIGHT_COLOR = 0xff4444;

const PROMOTION_PIECES: PieceSymbol[] = ['q', 'r', 'b', 'n'];

function isOpponentHomeRank(square: Square, player: PlayerColor): boolean {
  if (player === 'white') {
    return square[1] === '8';
  }
  return square[1] === '1';
}

/**
 * Gets all legal target squares for a card
 * 
 * @param card - Card to check targets for
 * @returns Object with arrays of deploy and destroy squares
 */
export function getLegalTargetSquares(this: GameScene, card: Card): { deploy: Square[], destroy: Square[] } {
  const deploy: Square[] = [];
  const destroy: Square[] = [];
  
  const controlMap = calculateControlPower(this.chessBoard.getWrapper());
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];
  
  for (const file of files) {
    for (const rank of ranks) {
      const square = (file + rank) as Square;
      const playerControls = playerControlsSquare(controlMap, square, this.localColor);
      
      if (!playerControls) continue;
      
      const piece = this.chessBoard.getWrapper().getPiece(square);
      
      if (card.effect.action === 'DEPLOY_PIECE') {
        // Can deploy to empty controlled squares (if it doesn't give check)
        if (!piece) {
          const pieceType = (card.effect as { piece: PieceType }).piece;
          const boardFEN = this.chessBoard.getPosition();
          if (!this.gameStateManager.wouldDeploymentGiveCheck(square, pieceType, this.localColor, boardFEN)) {
            deploy.push(square);
          }
        }
      } else if (card.effect.action === 'DESTROY_PIECE') {
        // Can destroy non-King pieces on controlled squares
        if (piece && piece.type !== 'k') {
          destroy.push(square);
        }
      }
    }
  }
  
  return { deploy, destroy };
}

/**
 * Highlights legal target squares for a card
 * Blue for deployment, red for destruction
 * 
 * @param card - Card being targeted
 */
export function highlightLegalTargets(this: GameScene, card: Card): void {
  const { deploy, destroy } = this.getLegalTargetSquares(card);
  
  // Highlight deployment squares in blue
  if (deploy.length > 0) {
    this.chessBoard.highlightSquares(deploy, DEPLOY_HIGHLIGHT_COLOR);
  }
  
  // Highlight destroy squares in red
  if (destroy.length > 0) {
    this.chessBoard.highlightSquares(destroy, DESTROY_HIGHLIGHT_COLOR);
  }
}

/**
 * Clears legal target highlights
 */
export function clearLegalTargetHighlights(this: GameScene): void {
  this.chessBoard.clearHighlights();
}

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
    return this.handleLocalCardPlay(card);
  };

  // Handle targeted card play
  this.cardHand.onCardTargeted = (card: Card, target: Square) => {
    return this.handleLocalCardPlay(card, target);
  };
  
  // Handle targeting start - highlight legal squares
  this.cardHand.onTargetingStart = (card: Card) => {
    if (this.isDiscardMode) return;
    this.highlightLegalTargets(card);
  };
  
  // Handle targeting cancel - clear highlights
  this.cardHand.onTargetingCancel = () => {
    this.clearLegalTargetHighlights();
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
    // Can only destroy non-King pieces on squares you control
    const piece = this.chessBoard.getWrapper().getPiece(square);
    return playerControls && !!piece && piece.type !== 'k';
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
export function handleLocalCardPlay(this: GameScene, card: Card, target?: Square): boolean {
  // Check if it's our turn
  if (!this.gameStateManager.isLocalPlayerTurn()) {
    this.logEvent('system', 'Not your turn!');
    return false;
  }

  if (this.isConnectionPaused) {
    this.logEvent('system', 'Connection paused. Waiting for opponent.');
    return false;
  }

  // Check if in discard mode
  if (this.isDiscardMode) {
    // In discard mode, clicking a card discards it
    this.discardCard(card);
    return true;
  }

  // Check game phase
  if (this.gameStateManager.getPhase() !== 'playing') {
    this.logEvent('system', 'Game not started yet!');
    return false;
  }

  // Validate card can be played
  const validation = this.gameStateManager.canPlayCard(card, this.localColor);
  if (!validation.canPlay) {
    this.logEvent('system', validation.reason);
    return false;
  }

  // Validate target for targeted cards (deployment check, etc.)
  if (target && !this.validateCardTarget(card, target)) {
    this.logEvent('system', 'Invalid target!');
    return false;
  }

  const releasePos = this.cardHand.getTargeting()?.getLastReleasePosition() ?? undefined;

  const finalizeCardPlay = (deployPieceOverride?: PieceSymbol): boolean => {
    // Lock discard display BEFORE playing card to prevent UI update during animation
    this.lockDiscardTop('local');

    const result = this.gameStateManager.playCard(card.id, this.localColor, target);

    if (result.success) {
      this.logEvent(this.localColor, `Played ${card.name}`);
      // Animation will call releaseDiscardTop when complete
      this.animateCardPlay(card, 'local', target, undefined, releasePos);

      // Handle piece deployment/destruction on board
      if (card.effect.action === 'DEPLOY_PIECE' && target) {
        const piece = deployPieceOverride ?? (card.effect as { piece: PieceSymbol }).piece;
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
      const pieceType = card.effect.action === 'DEPLOY_PIECE'
        ? (deployPieceOverride ?? (card.effect as { piece: PieceSymbol }).piece)
        : undefined;
      this.networkManager?.sendPlayCard(card.id, card.name, target, pieceType, card.effect.action);

      // Check for checkmate/stalemate after card play (Requirement 3.8)
      this.checkCardPlayEndConditions();
    } else {
      // Release lock if card play failed
      this.releaseDiscardTop('local');
      this.logEvent('system', result.message);
      this.updateHandDisplay();
      return false;
    }

    this.updateUIFromState();
    
    // Check stopwatch threshold AFTER UI is updated
    // This ensures the displayed stopwatch value matches when draws are triggered
    const cardsDrawn = this.gameStateManager.checkStopwatchThreshold(this.localColor);
    if (cardsDrawn > 0) {
      this.logEvent('system', `Opponent drew ${cardsDrawn} card(s) (stopwatch threshold)`);
      this.updateUIFromState();
    }
    
    return true;
  };

  if (card.effect.action === 'DEPLOY_PIECE' && target) {
    const basePiece = (card.effect as { piece: PieceSymbol }).piece;
    if (basePiece === 'p' && isOpponentHomeRank(target, this.localColor)) {
      const boardFEN = this.chessBoard.getPosition();
      const allowedPromotions = PROMOTION_PIECES.filter(
        piece => !this.gameStateManager.wouldDeploymentGiveCheck(target, piece as PieceType, this.localColor, boardFEN)
      );
      if (allowedPromotions.length === 0) {
        this.logEvent('system', 'No legal promotion options');
        return false;
      }

      this.showPromotionPicker(
        target,
        target,
        this.localColor,
        allowedPromotions,
        (piece) => {
          finalizeCardPlay(piece);
        }
      );
      return true;
    }
  }

  return finalizeCardPlay();
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
  // Use same scale as deck cards (0.14) instead of larger scale
  const scale = 0.75 * layout.panelScale;
  const isOpponent = side === 'opponent';
  const existing = isOpponent ? this.opponentDiscardTopCard : this.playerDiscardTopCard;
  
  // Calculate position - use the layout values directly (no offset needed)
  const positionY = isOpponent 
    ? layout.opponentDiscardY 
    : layout.playerDiscardY;

  // Destroy existing top card
  if (existing) {
    existing.destroy();
  }

  // If no card data, clear the reference (don't create card back)
  if (!cardData) {
    if (isOpponent) {
      this.opponentDiscardTopCard = null;
    } else {
      this.playerDiscardTopCard = null;
    }
    return;
  }

  // Create top card - always face-up (discard piles are public information)
  // Only create if we have actual card data (no card back for empty/unknown)
  const topCard = new CardComponent(this, 0, 0, cardData, false, scale);
  topCard.setDepth(11);
  topCard.getContainer().setPosition(layout.leftPanelX, positionY);
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
