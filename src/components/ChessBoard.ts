/**
 * ChessBoard Component - Chess board display and logic with chess.js integration
 * 
 * Requirements: 1.8, 2.2, 2.3, 2.4, 2.6
 * - 1.8: Board flipping for black player (black pieces at bottom)
 * - 2.2: Enforce standard chess movement rules via chess.js
 * - 2.3: Allow King to be captured (no checkmate-only ending)
 * - 2.4: Do NOT enforce 50-move draw rule
 * - 2.6: Start with only two kings (White King e1, Black King e8)
 */

import Phaser from 'phaser';
import { Square, Color, PieceSymbol } from 'chess.js';
import { 
  ChessBoardWrapper, 
  getAllSquares, 
  INITIAL_FEN, 
  BOARD_SIZE,
} from '../utils/chessWrapper';
import type { MoveResult, ControlPowerMap } from '../utils/chessWrapper';

// Re-export for convenience
export { ChessBoardWrapper, getAllSquares, INITIAL_FEN };
export type { MoveResult, ControlPowerMap };

// Visual constants
const SQUARE_SIZE = 64; // pixels per square
const BOARD_PIXEL_SIZE = BOARD_SIZE * SQUARE_SIZE; // 512px

// Square colors
const LIGHT_SQUARE_COLOR = 0xf0d9b5;
const DARK_SQUARE_COLOR = 0xb58863;
const HIGHLIGHT_COLOR = 0x7fff00;
const SELECTED_COLOR = 0xffff00;
const ATTACK_HIGHLIGHT_COLOR = 0xff6b6b;

// Piece asset mapping
const PIECE_ASSETS: Record<string, string> = {
  'wP': 'chess_pawn_white',
  'wN': 'chess_knight_white',
  'wB': 'chess_bishop_white',
  'wR': 'chess_rook_white',
  'wQ': 'chess_queen_white',
  'wK': 'chess_king_white',
  'bP': 'chess_pawn_black',
  'bN': 'chess_knight_black',
  'bB': 'chess_bishop_black',
  'bR': 'chess_rook_black',
  'bQ': 'chess_queen_black',
  'bK': 'chess_king_black',
};


/**
 * ChessBoardComponent - Phaser visual component for the chess board
 * Renders the board with pixel art assets and handles user interaction
 */
export class ChessBoardComponent {
  private scene: Phaser.Scene;
  private wrapper: ChessBoardWrapper;
  private container: Phaser.GameObjects.Container;
  private boardGraphics: Phaser.GameObjects.Graphics;
  private pieceSprites: Map<string, Phaser.GameObjects.Image>;
  private highlightGraphics: Phaser.GameObjects.Graphics;
  private overlayGraphics: Phaser.GameObjects.Graphics;
  
  private x: number;
  private y: number;
  private scale: number;
  private flipped: boolean;
  private selectedSquare: Square | null;
  private validMoveSquares: Square[];
  
  // Event callbacks
  public onSquareClick?: (square: Square) => void;
  public onMoveAttempt?: (from: Square, to: Square) => void;
  public onPieceSelect?: (square: Square) => void;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    scale: number = 1,
    flipped: boolean = false
  ) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.scale = scale;
    this.flipped = flipped;
    this.selectedSquare = null;
    this.validMoveSquares = [];
    this.pieceSprites = new Map();
    
    this.wrapper = new ChessBoardWrapper();
    this.container = scene.add.container(x, y);
    
    // Create graphics layers
    this.boardGraphics = scene.add.graphics();
    this.highlightGraphics = scene.add.graphics();
    this.overlayGraphics = scene.add.graphics();
    
    this.container.add([this.boardGraphics, this.highlightGraphics, this.overlayGraphics]);
    
    // Draw the board
    this.drawBoard();
    this.renderPieces();
    this.setupInteraction();
  }

  /**
   * Get the chess wrapper for direct access
   */
  getWrapper(): ChessBoardWrapper {
    return this.wrapper;
  }

  /**
   * Get current position as FEN
   */
  getPosition(): string {
    return this.wrapper.getPosition();
  }

  /**
   * Set position from FEN
   */
  setPosition(fen: string): void {
    this.wrapper.setPosition(fen);
    this.renderPieces();
  }

  /**
   * Check if board is flipped
   * Requirement 1.8: Board flipping for black player
   */
  isFlipped(): boolean {
    return this.flipped;
  }

  /**
   * Set board flip state
   * Requirement 1.8: Black pieces at bottom when flipped
   */
  setFlipped(flipped: boolean): void {
    this.flipped = flipped;
    this.renderPieces();
  }

  /**
   * Get valid moves for a square
   */
  getValidMoves(square: Square): Square[] {
    return this.wrapper.getValidMoves(square);
  }

  /**
   * Make a move on the board
   */
  makeMove(from: Square, to: Square): MoveResult {
    const result = this.wrapper.makeMove(from, to);
    if (result.success) {
      this.renderPieces();
      this.clearSelection();
    }
    return result;
  }

  /**
   * Check if king is attacked
   */
  isKingAttacked(color: Color): boolean {
    return this.wrapper.isKingAttacked(color);
  }

  /**
   * Check if king can be captured
   */
  canCaptureKing(): boolean {
    return this.wrapper.canCaptureKing();
  }

  /**
   * Draw the chess board squares with coordinates
   */
  private drawBoard(): void {
    this.boardGraphics.clear();
    const size = SQUARE_SIZE * this.scale;
    
    // Draw squares with subtle shadow effect
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const isLight = (row + col) % 2 === 0;
        const baseColor = isLight ? LIGHT_SQUARE_COLOR : DARK_SQUARE_COLOR;
        
        // Main square
        this.boardGraphics.fillStyle(baseColor, 1);
        this.boardGraphics.fillRect(col * size, row * size, size, size);
        
        // Add light highlight on top-left of each square (L-shape)
        const highlightColor = isLight ? 0xfff8e7 : 0xc9a06a;
        this.boardGraphics.fillStyle(highlightColor, 1);
        // Top-left corner
        this.boardGraphics.fillRect(
          col * size, 
          row * size, 
          size * 0.15, 
          size * 0.15
        );
        // Top edge extension
        this.boardGraphics.fillRect(
          col * size + size * 0.15, 
          row * size, 
          size * 0.15, 
          size * 0.15
        );
        // Left edge extension
        this.boardGraphics.fillRect(
          col * size, 
          row * size + size * 0.15, 
          size * 0.15, 
          size * 0.15
        );
        
        // Add subtle shadow on bottom-right of each square (L-shape)
        const shadowColor = isLight ? 0xd4c4a8 : 0x9a7653;
        this.boardGraphics.fillStyle(shadowColor, 1);
        this.boardGraphics.fillRect(
          col * size + size * 0.85, 
          row * size + size * 0.85, 
          size * 0.15, 
          size * 0.15
        );

        this.boardGraphics.fillRect(
          col * size + size * 0.7, 
          row * size + size * 0.85, 
          size * 0.15, 
          size * 0.15
        );

        this.boardGraphics.fillRect(
          col * size + size * 0.85, 
          row * size + size * 0.7, 
          size * 0.15, 
          size * 0.15
        );
      }
    }
    
    // Draw thin black borders between squares using filled rects (pixel-perfect)
    const thinLineWidth = Math.max(1, Math.round(1 * this.scale));
    this.boardGraphics.fillStyle(0x5C4033, 1);
    
    // Vertical lines between columns
    for (let col = 1; col < BOARD_SIZE; col++) {
      this.boardGraphics.fillRect(col * size - thinLineWidth / 2, 0, thinLineWidth, BOARD_SIZE * size);
    }
    
    // Horizontal lines between rows
    for (let row = 1; row < BOARD_SIZE; row++) {
      this.boardGraphics.fillRect(0, row * size - thinLineWidth / 2, BOARD_SIZE * size, thinLineWidth);
    }
    
    // Draw shadow on right and bottom of the board (before the border)
    const shadowWidth = Math.max(6, Math.round(8 * this.scale));
    this.boardGraphics.fillStyle(0x000000, 0.4);
    // Right shadow
    this.boardGraphics.fillRect(BOARD_SIZE * size, shadowWidth, shadowWidth, BOARD_SIZE * size);
    // Bottom shadow
    this.boardGraphics.fillRect(shadowWidth, BOARD_SIZE * size, BOARD_SIZE * size, shadowWidth);
    
    // Draw coordinates
    this.drawCoordinates();
  }

  /**
   * Draw rank numbers (1-8) and file letters (a-h)
   */
  private drawCoordinates(): void {
    const size = SQUARE_SIZE * this.scale;
    const fontSize = Math.round(16 * this.scale);
    const padding = 4 * this.scale;
    
    const ranks = this.flipped ? ['1', '2', '3', '4', '5', '6', '7', '8'] : ['8', '7', '6', '5', '4', '3', '2', '1'];
    const files = this.flipped ? ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'] : ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    
    // Draw rank numbers on the left side
    for (let row = 0; row < 8; row++) {
      const isLight = row % 2 === 0;
      const textColor = isLight ? '#b58863' : '#f0d9b5';
      
      const rankText = this.scene.add.text(
        padding,
        row * size + padding,
        ranks[row],
        {
          fontSize: `${fontSize}px`,
          fontFamily: 'BoldPixels, Arial',
          color: textColor,
          fontStyle: 'bold'
        }
      );
      this.container.add(rankText);
    }
    
    // Draw file letters on the bottom
    for (let col = 0; col < 8; col++) {
      const isLight = (7 + col) % 2 === 0;
      const textColor = isLight ? '#b58863' : '#f0d9b5';
      
      const fileText = this.scene.add.text(
        col * size + size - padding - fontSize * 0.6,
        8 * size - padding - fontSize,
        files[col],
        {
          fontSize: `${fontSize}px`,
          fontFamily: 'BoldPixels, Arial',
          color: textColor,
          fontStyle: 'bold'
        }
      );
      this.container.add(fileText);
    }
  }

  /**
   * Convert board coordinates to square notation
   */
  private coordsToSquare(col: number, row: number): Square {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
    
    if (this.flipped) {
      col = 7 - col;
      row = 7 - row;
    }
    
    return (files[col] + ranks[row]) as Square;
  }

  /**
   * Convert square notation to board coordinates
   */
  private squareToCoords(square: Square): { col: number; row: number } {
    const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
    const rank = 8 - parseInt(square[1]);
    
    let col = file;
    let row = rank;
    
    if (this.flipped) {
      col = 7 - col;
      row = 7 - row;
    }
    
    return { col, row };
  }

  /**
   * Render all pieces on the board
   */
  private renderPieces(): void {
    // Clear existing sprites
    for (const sprite of this.pieceSprites.values()) {
      sprite.destroy();
    }
    this.pieceSprites.clear();
    
    const pieces = this.wrapper.getAllPieces();
    const size = SQUARE_SIZE * this.scale;
    
    for (const { square, type, color } of pieces) {
      const assetKey = `${color === 'w' ? 'w' : 'b'}${type.toUpperCase()}`;
      const textureKey = PIECE_ASSETS[assetKey];
      
      if (!textureKey) continue;
      
      const { col, row } = this.squareToCoords(square);
      const x = col * size + size / 2;
      const y = row * size + size / 2;
      
      const sprite = this.scene.add.image(x, y, textureKey);
      sprite.setScale(this.scale * 1.1); // Scale piece to fit square
      // Note: Don't set interactive on pieces - the board zone handles all clicks
      
      this.container.add(sprite);
      this.pieceSprites.set(square, sprite);
    }
  }

  /**
   * Setup mouse/touch interaction
   */
  private setupInteraction(): void {
    const size = SQUARE_SIZE * this.scale;
    const boardSize = BOARD_PIXEL_SIZE * this.scale;
    
    // Create interactive zone for the board
    const hitArea = new Phaser.Geom.Rectangle(0, 0, boardSize, boardSize);
    const zone = this.scene.add.zone(0, 0, boardSize, boardSize)
      .setOrigin(0, 0)
      .setInteractive({ hitArea, hitAreaCallback: Phaser.Geom.Rectangle.Contains });
    
    this.container.add(zone);
    
    zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const localX = pointer.x - this.x;
      const localY = pointer.y - this.y;
      
      const col = Math.floor(localX / size);
      const row = Math.floor(localY / size);
      
      if (col >= 0 && col < 8 && row >= 0 && row < 8) {
        const square = this.coordsToSquare(col, row);
        this.handleSquareClick(square);
      }
    });
  }

  /**
   * Handle click on a square
   */
  private handleSquareClick(square: Square): void {
    // Notify listeners
    if (this.onSquareClick) {
      this.onSquareClick(square);
    }
    
    // If we have a selected piece and clicked on a valid move square
    if (this.selectedSquare && this.validMoveSquares.includes(square)) {
      if (this.onMoveAttempt) {
        this.onMoveAttempt(this.selectedSquare, square);
      }
      return;
    }
    
    // Check if there's a piece on this square
    const piece = this.wrapper.getPiece(square);
    
    if (piece) {
      // Select this piece
      this.selectSquare(square);
      if (this.onPieceSelect) {
        this.onPieceSelect(square);
      }
    } else {
      // Clear selection
      this.clearSelection();
    }
  }

  /**
   * Select a square and show valid moves
   */
  selectSquare(square: Square): void {
    this.selectedSquare = square;
    this.validMoveSquares = this.wrapper.getValidMoves(square);
    this.renderHighlights();
  }

  /**
   * Clear current selection
   */
  clearSelection(): void {
    this.selectedSquare = null;
    this.validMoveSquares = [];
    this.clearHighlights();
  }

  /**
   * Highlight squares
   */
  highlightSquares(squares: Square[], color: number = HIGHLIGHT_COLOR): void {
    const size = SQUARE_SIZE * this.scale;
    
    for (const square of squares) {
      const { col, row } = this.squareToCoords(square);
      this.highlightGraphics.fillStyle(color, 0.5);
      this.highlightGraphics.fillRect(col * size, row * size, size, size);
    }
  }

  /**
   * Clear all highlights
   */
  clearHighlights(): void {
    this.highlightGraphics.clear();
  }

  /**
   * Render selection and valid move highlights
   */
  private renderHighlights(): void {
    this.clearHighlights();
    const size = SQUARE_SIZE * this.scale;
    
    // Highlight selected square
    if (this.selectedSquare) {
      const { col, row } = this.squareToCoords(this.selectedSquare);
      this.highlightGraphics.fillStyle(SELECTED_COLOR, 0.5);
      this.highlightGraphics.fillRect(col * size, row * size, size, size);
    }
    
    // Highlight valid moves
    for (const square of this.validMoveSquares) {
      const { col, row } = this.squareToCoords(square);
      const piece = this.wrapper.getPiece(square);
      
      // Use different color for captures
      const color = piece ? ATTACK_HIGHLIGHT_COLOR : HIGHLIGHT_COLOR;
      this.highlightGraphics.fillStyle(color, 0.5);
      this.highlightGraphics.fillRect(col * size, row * size, size, size);
    }
  }

  /**
   * Render control power overlay
   */
  renderControlOverlay(controlMap: ControlPowerMap): void {
    this.overlayGraphics.clear();
    const size = SQUARE_SIZE * this.scale;
    
    for (const square of getAllSquares()) {
      const power = controlMap[square] || 0;
      if (power === 0) continue;
      
      const { col, row } = this.squareToCoords(square);
      
      // White control = blue tint, Black control = red tint
      const color = power > 0 ? 0x4444ff : 0xff4444;
      const alpha = Math.min(Math.abs(power) * 0.15, 0.6);
      
      this.overlayGraphics.fillStyle(color, alpha);
      this.overlayGraphics.fillRect(col * size, row * size, size, size);
    }
  }

  /**
   * Clear control overlay
   */
  clearControlOverlay(): void {
    this.overlayGraphics.clear();
  }

  /**
   * Place a piece on the board (for card effects)
   */
  placePiece(square: Square, type: PieceSymbol, color: Color): boolean {
    const result = this.wrapper.placePiece(square, type, color);
    if (result) {
      this.renderPieces();
    }
    return result;
  }

  /**
   * Remove a piece from the board (for card effects)
   */
  removePiece(square: Square): boolean {
    const result = this.wrapper.removePiece(square);
    if (result) {
      this.renderPieces();
    }
    return result;
  }

  /**
   * Get the container for positioning
   */
  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  /**
   * Set position of the board
   */
  setContainerPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.container.setPosition(x, y);
  }

  /**
   * Destroy the component
   */
  destroy(): void {
    for (const sprite of this.pieceSprites.values()) {
      sprite.destroy();
    }
    this.pieceSprites.clear();
    this.container.destroy();
  }
}
