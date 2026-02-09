/**
 * @fileoverview GameScene card interaction helpers
 *
 * @module scenes/game/GameSceneCards
 */

import { Square, Color, PieceSymbol } from 'chess.js';
import { CardComponent } from '../../components/Card';
import type { CardPlayOutcome } from '../../components/CardTargeting';
import type { Card, PieceType, PlayerColor, CardEffectAction } from '../../managers/GameStateManager';
import { effectRequiresTarget, normalizeCardEffects } from '../../managers/GameStateManager';
import { playerControlsSquare } from '../../utils/controlPower';
import { MAX_PILE_LAYERS } from './GameConstants';
import { getPileTopPosition, makeCardComponentClickable } from './GameUIHelpers';
import { LEFT_PANEL_LAYOUT } from '../../config';
import type { GameScene } from '../GameScene';

/** Color for deployment target highlights (blue) */
const DEPLOY_HIGHLIGHT_COLOR = 0x4488ff;

/** Color for destroy target highlights (red) */
const DESTROY_HIGHLIGHT_COLOR = 0xff4444;

const PROMOTION_PIECES: PieceSymbol[] = ['q', 'r', 'b', 'n'];
const GHOST_PIECE_ALPHA = 0.5;
const PLAYER_DISCARD_DEPTH = 6;
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;

type TargetedEffect = Extract<CardEffectAction, { action: 'DEPLOY_PIECE' | 'DESTROY_PIECE' }>;

function getLastNonNullCard(cards: Array<Card | null>): Card | null {
  for (let i = cards.length - 1; i >= 0; i -= 1) {
    const card = cards[i];
    if (card) return card;
  }
  return null;
}

/**
 * Returns true if the square is on the opponent's home rank.
 */
function isOpponentHomeRank(square: Square, player: PlayerColor): boolean {
  if (player === 'white') {
    return square[1] === '8';
  }
  return square[1] === '1';
}

/**
 * Checks if a square is the player's own home rank (where pawns can't be deployed)
 * White's home rank is 1, Black's home rank is 8
 */
function isOwnHomeRank(square: Square, player: PlayerColor): boolean {
  if (player === 'white') {
    return square[1] === '1';
  }
  return square[1] === '8';
}

/**
 * Returns the list of card effects that require targeting resolution.
 */
function getTargetEffects(card: Card): TargetedEffect[] {
  return normalizeCardEffects(card.effect).filter(effectRequiresTarget);
}

/**
 * Determines the active target effect for multi-target cards.
 */
function getActiveTargetEffect(this: GameScene, card: Card): TargetedEffect | null {
  const targetEffects = getTargetEffects(card);
  if (targetEffects.length === 0) return null;

  const pending = this.pendingCardPlay;
  if (pending && pending.card.id === card.id) {
    return targetEffects[pending.targets.length] ?? null;
  }

  return targetEffects[0];
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
  const activeEffect = getActiveTargetEffect.call(this, card);
  if (!activeEffect) {
    return { deploy, destroy };
  }

  const controlMap = this.getControlPowerMap();
  const board = this.chessBoard.getWrapper();
  const boardFEN = activeEffect.action === 'DEPLOY_PIECE'
    ? this.chessBoard.getPosition()
    : null;
  
  for (const file of FILES) {
    for (const rank of RANKS) {
      const square = (file + rank) as Square;
      const playerControls = playerControlsSquare(controlMap, square, this.localColor);
      
      if (!playerControls) continue;
      
      const piece = board.getPiece(square);
      
      if (activeEffect.action === 'DEPLOY_PIECE') {
        // Can deploy to empty controlled squares (if it doesn't give check)
        if (!piece) {
          const pieceType = activeEffect.piece;
          
          // Pawns cannot be deployed on player's own home rank
          if (pieceType === 'p' && isOwnHomeRank(square, this.localColor)) {
            continue;
          }
          
          if (boardFEN && !this.gameStateManager.wouldDeploymentGiveCheck(square, pieceType, this.localColor, boardFEN)) {
            deploy.push(square);
          }
        }
      } else if (activeEffect.action === 'DESTROY_PIECE') {
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
    cancelPendingCardPlay.call(this);
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
  const controlMap = this.getControlPowerMap();
  const playerControls = playerControlsSquare(controlMap, square, this.localColor);

  const activeEffect = getActiveTargetEffect.call(this, card);
  if (!activeEffect) {
    return false;
  }

  if (activeEffect.action === 'DEPLOY_PIECE') {
    // Can only deploy to empty squares you control
    const piece = this.chessBoard.getWrapper().getPiece(square);
    if (!playerControls || piece) {
      return false;
    }

    const pieceType = activeEffect.piece;
    
    // Pawns cannot be deployed on player's own home rank
    if (pieceType === 'p' && isOwnHomeRank(square, this.localColor)) {
      return false;
    }

    // Check if deployment would give check (not allowed)
    const boardFEN = this.chessBoard.getPosition();
    if (this.gameStateManager.wouldDeploymentGiveCheck(square, pieceType, this.localColor, boardFEN)) {
      return false;
    }

    return true;
  } else if (activeEffect.action === 'DESTROY_PIECE') {
    // Can only destroy non-King pieces on squares you control
    const piece = this.chessBoard.getWrapper().getPiece(square);
    return playerControls && !!piece && piece.type !== 'k';
  }

  return false;
}

/**
 * Cancels any in-progress multi-target card play and restores board state.
 */
function cancelPendingCardPlay(this: GameScene): void {
  const pending = this.pendingCardPlay;
  if (!pending) return;

  this.chessBoard.clearGhostSquares();
  this.chessBoard.setPosition(pending.originalBoardFEN);
  this.pendingCardPlay = null;
  this.hidePromotionPicker();
  this.cardHand.enableInteraction();
  this.clearLegalTargetHighlights();
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
export function handleLocalCardPlay(this: GameScene, card: Card, target?: Square): CardPlayOutcome | boolean {
  // Check if it's our turn
  if (!this.gameStateManager.isLocalPlayerTurn()) {
    this.logEvent('system', 'Not your turn!');
    return false;
  }

  if (this.isConnectionPaused) {
    this.logEvent('system', 'Connection paused. Waiting for opponent.');
    return false;
  }

  if (this.pendingCardPlay && this.pendingCardPlay.card.id !== card.id) {
    this.logEvent('system', 'Finish the current card play first.');
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

  const effects = normalizeCardEffects(card.effect);
  const targetEffects = effects.filter(
    effect => effect.action === 'DEPLOY_PIECE' || effect.action === 'DESTROY_PIECE' || effectRequiresTarget(effect)
  );

  const releasePos = this.cardHand.getTargeting()?.getLastReleasePosition() ?? undefined;

  const finalizeCardPlay = (
    targets: Square[] = [],
    targetPieces: Array<PieceSymbol | undefined> = [],
    cleanupTargeting: boolean = false
  ): CardPlayOutcome => {
    const isPendingCard = this.pendingCardPlay?.card.id === card.id;
    if (isPendingCard) {
      this.chessBoard.clearGhostSquares();
    }

    // Lock discard display BEFORE playing card to prevent UI update during animation
    this.lockDiscardTop('local');

    const result = this.gameStateManager.playCard(card.id, this.localColor, targets);

    if (result.success) {
      this.logEvent(this.localColor, `Played ${card.name}`);
      // Animation will call releaseDiscardTop when complete
      const lastTarget = targets.length > 0 ? targets[targets.length - 1] : undefined;
      this.animateCardPlay(
        card,
        'local',
        lastTarget,
        () => this.setDiscardTopCard('local', card),
        releasePos
      );

      // Handle piece deployment/destruction on board
      let targetIndex = 0;
      let boardModified = false;
      for (const effect of effects) {
        if (effect.action === 'DEPLOY_PIECE') {
          const targetSquare = targets[targetIndex];
          const piece = targetPieces[targetIndex] ?? effect.piece;
          targetIndex += 1;
          if (!targetSquare) continue;

          const color: Color = this.localColor === 'white' ? 'w' : 'b';
          const existing = this.chessBoard.getWrapper().getPiece(targetSquare);
          if (!existing) {
            this.chessBoard.placePiece(targetSquare, piece, color);
          }
          this.animatePieceDeploy(targetSquare);
          boardModified = true;
        } else if (effect.action === 'DESTROY_PIECE') {
          const targetSquare = targets[targetIndex];
          targetIndex += 1;
          if (!targetSquare) continue;

          const targetPiece = this.chessBoard.getWrapper().getPiece(targetSquare);
          this.chessBoard.removePiece(targetSquare);
          if (targetPiece) {
            this.animatePieceDestroy(targetPiece, targetSquare);
          }
          boardModified = true;
        }
      }

      if (boardModified || targets.length > 0) {
        this.gameStateManager.setBoardFEN(this.chessBoard.getPosition());
      }

      // Send to network with card details for opponent to sync
      const targetActions = targetEffects.map(effect => effect.action);
      const targetPiecesForNetwork = targetActions.map((action, index) => {
        if (action !== 'DEPLOY_PIECE') return null;
        return targetPieces[index] ?? (targetEffects[index] as { piece: PieceSymbol }).piece;
      });
      if (targets.length === 1) {
        this.networkManager?.sendPlayCard(
          card.id,
          card.name,
          targets[0],
          targetPiecesForNetwork[0] ?? undefined,
          targetActions[0]
        );
      } else if (targets.length > 1) {
        this.networkManager?.sendPlayCard(
          card.id,
          card.name,
          targets,
          targetPiecesForNetwork,
          targetActions
        );
      } else {
        this.networkManager?.sendPlayCard(card.id, card.name);
      }

      // Check for checkmate/stalemate after card play (Requirement 3.8)
      this.checkCardPlayEndConditions();
    } else {
      // Release lock if card play failed
      this.releaseDiscardTop('local');
      this.logEvent('system', result.message);
      this.updateHandDisplay();
      if (isPendingCard) {
        cancelPendingCardPlay.call(this);
      }
      return 'cancelled';
    }

    if (cleanupTargeting) {
      this.cardHand.getTargeting()?.cancelTargeting();
      this.clearLegalTargetHighlights();
    }

    if (isPendingCard) {
      this.pendingCardPlay = null;
      this.cardHand.enableInteraction();
    }

    this.updateUIFromState();
    
    // Check stopwatch threshold AFTER UI is updated
    // This ensures the displayed stopwatch value matches when draws are triggered
    const cardsDrawn = this.gameStateManager.checkStopwatchThreshold(this.localColor);
    if (cardsDrawn > 0) {
      this.logEvent('system', `Opponent drew ${cardsDrawn} card(s) (stopwatch threshold)`);
      this.updateUIFromState();
    }
    
    return 'played';
  };

  if (targetEffects.length > 1) {
    if (!target) {
      this.logEvent('system', 'Card requires a target');
      return false;
    }

    const pending = this.pendingCardPlay ?? {
      card,
      effects,
      targetEffects,
      targets: [],
      originalBoardFEN: this.chessBoard.getPosition()
    };
    if (!this.pendingCardPlay) {
      this.pendingCardPlay = pending;
      this.cardHand.disableInteraction();
    }

    const currentEffect = pending.targetEffects[pending.targets.length];
    if (!currentEffect) {
      this.logEvent('system', 'No remaining targets');
      return false;
    }

    // Validate target for targeted cards (deployment check, etc.)
    if (!this.validateCardTarget(card, target)) {
      this.logEvent('system', 'Invalid target!');
      return 'continue';
    }

    const applyTarget = (deployPieceOverride?: PieceSymbol): CardPlayOutcome => {
      const pieceType = currentEffect.action === 'DEPLOY_PIECE'
        ? (deployPieceOverride ?? currentEffect.piece)
        : undefined;
      if (currentEffect.action === 'DEPLOY_PIECE') {
        const color: Color = this.localColor === 'white' ? 'w' : 'b';
        this.chessBoard.setGhostSquare(target, GHOST_PIECE_ALPHA);
        this.chessBoard.placePiece(target, pieceType as PieceSymbol, color);
      }

      pending.targets.push({
        action: currentEffect.action,
        target,
        pieceType
      });

      if (pending.targets.length >= pending.targetEffects.length) {
        return finalizeCardPlay(
          pending.targets.map(entry => entry.target),
          pending.targets.map(entry => entry.pieceType),
          true
        );
      }

      this.clearLegalTargetHighlights();
      this.highlightLegalTargets(card);
      return 'continue';
    };

    if (currentEffect.action === 'DEPLOY_PIECE') {
      const basePiece = currentEffect.piece;
      if (basePiece === 'p' && isOpponentHomeRank(target, this.localColor)) {
        const boardFEN = this.chessBoard.getPosition();
        const allowedPromotions = PROMOTION_PIECES.filter(
          piece => !this.gameStateManager.wouldDeploymentGiveCheck(target, piece as PieceType, this.localColor, boardFEN)
        );
        if (allowedPromotions.length === 0) {
          this.logEvent('system', 'No legal promotion options');
          return 'continue';
        }

        const targeting = this.cardHand.getTargeting();
        targeting?.setPaused(true);
        this.showPromotionPicker(
          target,
          target,
          this.localColor,
          allowedPromotions,
          (piece) => {
            targeting?.setPaused(false);
            applyTarget(piece);
          }
        );
        return 'continue';
      }
    }

    return applyTarget();
  }

  if (target && !this.validateCardTarget(card, target)) {
    this.logEvent('system', 'Invalid target!');
    return false;
  }

  if (targetEffects.length === 1 && target && targetEffects[0].action === 'DEPLOY_PIECE') {
    const basePiece = targetEffects[0].piece;
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
          finalizeCardPlay([target], [piece], true);
        }
      );
      return 'played';
    }
  }

  return finalizeCardPlay(target ? [target] : [], target ? [undefined] : [], !!target);
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

  const deckScale = LEFT_PANEL_LAYOUT.DECK_SCALE * layout.panelScale;
  const opponentColor = this.localColor === 'white' ? 'black' : 'white';
  const discardCount = isOpponent
    ? (this.networkManager ? this.opponentDiscardCount : this.gameStateManager.getPlayer(opponentColor).discard.length)
    : this.gameStateManager.getPlayer(this.localColor).discard.length;
  const pendingSuppression = isOpponent ? this.suppressOpponentDiscardTop : this.suppressLocalDiscardTop;
  const effectiveCount = !isOpponent && pendingSuppression > 0
    ? Math.max(1, discardCount - Math.max(0, pendingSuppression - 1))
    : discardCount;
  
  // Calculate position - use the layout values directly (no offset needed)
  const positionY = isOpponent 
    ? layout.opponentDiscardY 
    : layout.playerDiscardY;
  const topPos = getPileTopPosition(layout.leftPanelX, positionY, deckScale, effectiveCount);

  // If no card data, clear the reference (don't create card back)
  if (!cardData) {
    if (existing) {
      existing.destroy();
    }
    if (isOpponent) {
      this.opponentDiscardTopCard = null;
    } else {
      this.playerDiscardTopCard = null;
    }
    return;
  }

  const existingCardId = existing?.getCardId();
  if (existing && existingCardId && existingCardId === cardData.id) {
    existing.setPosition(topPos.x, topPos.y);
    existing.setScale(scale);
    if (isOpponent) {
      existing.setDepth(MAX_PILE_LAYERS + 8);
    } else {
      existing.setDepth(PLAYER_DISCARD_DEPTH);
    }
    existing.setVisible(!layout.isMobile);
    return;
  }

  if (existing) {
    existing.destroy();
  }

  // Create top card - always face-up (discard piles are public information)
  // Only create if we have actual card data (no card back for empty/unknown)
  const topCard = new CardComponent(this, 0, 0, cardData, false, scale);
  if (isOpponent) {
    topCard.setDepth(MAX_PILE_LAYERS + 8);
  } else {
    topCard.setDepth(PLAYER_DISCARD_DEPTH);
  }
  topCard.getContainer().setPosition(topPos.x, topPos.y);
  makeCardComponentClickable(topCard, () => this.showDiscardViewer(side));
  
  // Hide in mobile view
  if (layout.isMobile) {
    topCard.setVisible(false);
  }

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
    const opponentTop = getLastNonNullCard(this.opponentDiscardCards);
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
