/**
 * @fileoverview Type definitions for GameScene
 * 
 * Contains interfaces and types used throughout the game scene modules.
 * 
 * @module scenes/game/GameTypes
 */

import { PlayerColor } from '../../managers/GameStateManager';
import { NetworkManager } from '../../managers/NetworkManager';

/**
 * Data passed from MenuScene when starting a game
 */
export interface GameSceneData {
  /** Local player's display name */
  playerName: string;
  /** Local player's assigned color */
  localColor: PlayerColor;
  /** Network manager for P2P communication (null for single-player) */
  networkManager: NetworkManager | null;
  /** Opponent's display name */
  opponentName: string;
}

/**
 * Snapshot of UI state for animation diffing
 * Used to detect changes and trigger appropriate animations
 */
export interface UISnapshot {
  localClock: number;
  opponentClock: number;
  localStopwatch: number;
  opponentStopwatch: number;
  localEnergy: number;
  localEnergyCap: number;
  currentTurn: PlayerColor;
  localHand: number;
  opponentHand: number;
  localDeck: number;
  localDiscard: number;
  opponentDeck: number;
  opponentDiscard: number;
}

/**
 * Bounds for a layout section
 */
export interface SectionBounds {
  x: number;      // Left edge
  y: number;      // Top edge
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

/**
 * Layout calculation result containing all UI positions
 */
export interface GameLayout {
  // Section bounds (percentage-based, adjacent, no gaps)
  sections: {
    leftPanel: SectionBounds;      // Decks and discards
    board: SectionBounds;          // Chess board
    rightPanel: SectionBounds;     // Clocks, stopwatch, energy
    eventLog: SectionBounds;       // Event log
    topBar: SectionBounds;         // Opponent hand area
    bottomBar: SectionBounds;      // Player hand area
  };
  
  // Legacy positions (computed from sections)
  boardX: number;
  boardY: number;
  boardSize: number;
  boardScale: number;
  panelScale: number;
  handScale: number;
  eventLogX: number;
  eventLogY: number;
  eventLogWidth: number;
  rightPanelX: number;
  rightPanelTop: number;
  cardHandX: number;
  cardHandY: number;
  opponentHandX: number;
  opponentHandY: number;
  opponentHandLabelY: number;
  opponentHandCountY: number;
  leftPanelX: number;
  opponentDeckY: number;
  opponentDiscardY: number;
  playerDeckY: number;
  playerDiscardY: number;
  opponentNameX: number;
  opponentNameY: number;
  playerNameX: number;
  playerNameY: number;
  previewX: number;
  previewY: number;
  turnBannerX: number;
  turnBannerY: number;
  playedCardX: number;
  playedCardY: number;
  width: number;
  height: number;
  padding: number;
}
