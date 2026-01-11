/**
 * @fileoverview ChessBoard Component - Chess board display and logic with chess.js integration
 * 
 * This component renders an interactive chess board with pixel art assets.
 * It wraps the chess.js library for move validation and game state management.
 * 
 * Requirements addressed:
 * - 1.8: Board flipping for black player (black pieces at bottom)
 * - 2.2: Enforce standard chess movement rules via chess.js
 * - 2.3: Allow King to be captured (no checkmate-only ending)
 * - 2.4: Do NOT enforce 50-move draw rule
 * - 2.6: Start with only two kings (White King e1, Black King e8)
 * 
 * @module components/ChessBoard
 * @requires phaser
 * @requires chess.js
 * @requires ../utils/chessWrapper
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
import { hex } from '../utils/colors';

/* ============================================
 * RE-EXPORTS
 * ============================================
 * Export chess wrapper utilities for convenience.
 */

export { ChessBoardWrapper, getAllSquares, INITIAL_FEN };
export type { MoveResult, ControlPowerMap };

/* ============================================
 * VISUAL CONFIGURATION CONSTANTS
 * ============================================
 */

/** Size of each square in pixels (before scaling) */
const SQUARE_SIZE = 64;

/** Total board size in pixels (8 squares × 64px) */
const BOARD_PIXEL_SIZE = BOARD_SIZE * SQUARE_SIZE;

/* ============================================
 * COLOR CONSTANTS
 * ============================================
 */

/** Light square color (cream/beige) */
const LIGHT_SQUARE_COLOR = hex('#f0d9b5');

/** Dark square color (brown) */
const DARK_SQUARE_COLOR = hex('#b58863');

/** Valid move highlight color (green) */
const HIGHLIGHT_COLOR = hex('#7fff00');

/** Selected square highlight color (yellow) */
const SELECTED_COLOR = hex('#ffff00');

/** Attack/capture highlight color (red) */
const ATTACK_HIGHLIGHT_COLOR = hex('#ff6b6b');

/* ============================================
 * PIECE ASSET MAPPING
 * ============================================
 * Maps piece notation to texture keys.
 * Format: {color}{Type} → texture_key
 */

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

/* ============================================
 * CHESS BOARD COMPONENT CLASS
 * ============================================
 */

/**
 * ChessBoardComponent - Phaser visual component for the chess board
 * 
 * Renders the board with pixel art assets and handles user interaction.
 * Wraps ChessBoardWrapper for game logic.
 * 
 * Visual structure:
 * - Board graphics (squares with 3D effect)
 * - Highlight graphics (selection, valid moves)
 * - Overlay graphics (control power visualization)
 * - Piece sprites (positioned on squares)
 * - Coordinate labels (files a-h, ranks 1-8)
 * 
 * @example
 * const board = new ChessBoardComponent(scene, 100, 100, 1, false);
 * 
 * board.onMoveAttempt = (from, to) => {
 *   const result = board.makeMove(from, to);
 *   if (result.success) {
 *     console.log('Move made:', result.move);
 *   }
 * };
 * 
 * Used by: GameScene (creates the main game board)
 */
export class ChessBoardComponent {
  /** Reference to the Phaser scene */
  private scene: Phaser.Scene;
  
  /** Chess logic wrapper */
  private wrapper: ChessBoardWrapper;
  
  /** Main container for all board elements */
  private container: Phaser.GameObjects.Container;
  
  /** Graphics for board squares */
  private boardGraphics: Phaser.GameObjects.Graphics;
  
  /** Map of square → piece sprite */
  private pieceSprites: Map<string, Phaser.GameObjects.Image>;
  
  /** Graphics for selection/move highlights */
  private highlightGraphics: Phaser.GameObjects.Graphics;
  
  /** Graphics for control power overlay */
  private overlayGraphics: Phaser.GameObjects.Graphics;
  
  /** Board X position */
  private x: number;
  
  /** Board Y position */
  private y: number;
  
  /** Board scale factor */
  private scale: number;
  
  /** Whether board is flipped (black perspective) */
  private flipped: boolean;
  
  /** Currently selected square */
  private selectedSquare: Square | null;
  
  /** Valid move squares for selected piece */
  private validMoveSquares: Square[];
  
  /* ============================================
   * EVENT CALLBACKS
   * ============================================
   */
  
  /** Called when any square is clicked */
  public onSquareClick?: (square: Square) => void;
  
  /** Called when a move is attempted (from selected to clicked) */
  public onMoveAttempt?: (from: Square, to: Square) => void;
  
  /** Called when a piece is selected */
  public onPieceSelect?: (square: Square) => void;

  /**
   * Creates a new ChessBoardComponent
   * 
   * Algorithm:
   * 1. Initialize chess wrapper
   * 2. Create container and graphics layers
   * 3. Draw board squares with 3D effect
   * 4. Render initial pieces
   * 5. Setup click interaction
   * 
   * @param scene - The Phaser scene
   * @param x - Board X position
   * @param y - Board Y position
   * @param scale - Scale factor (default: 1)
   * @param flipped - Whether to flip for black (default: false)
   * 
   * Used by: GameScene.createBoard()
   */
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
    
    // Initialize chess logic
    this.wrapper = new ChessBoardWrapper();
    
    // Create container
    this.container = scene.add.container(x, y);
    
    // Create graphics layers for dynamic content (highlights, overlays)
    this.boardGraphics = scene.add.graphics();
    this.highlightGraphics = scene.add.graphics();
    this.overlayGraphics = scene.add.graphics();
    
    // Draw board to graphics, then convert to texture for better performance
    // Graphics objects are re-triangulated every frame, textures are not
    this.drawBoard();
    this.convertBoardToTexture();
    
    this.container.add([this.highlightGraphics, this.overlayGraphics]);
    
    // Render pieces and setup interaction
    this.renderPieces();
    this.setupInteraction();
  }
  
  /** Board texture sprite (replaces boardGraphics for performance) */
  private boardSprite: Phaser.GameObjects.Image | null = null;
  
  /**
   * Converts the board graphics to a texture for better rendering performance
   * 
   * Graphics objects are re-triangulated every frame by Phaser's earcut algorithm,
   * which is expensive. Converting to a texture eliminates this overhead.
   * 
   * @private
   */
  private convertBoardToTexture(): void {
    const textureKey = `chess_board_${Date.now()}`;
    const boardSize = BOARD_PIXEL_SIZE * this.scale;
    
    // Generate texture from graphics
    this.boardGraphics.generateTexture(textureKey, boardSize, boardSize);
    
    // Create sprite from texture
    this.boardSprite = this.scene.add.image(boardSize / 2, boardSize / 2, textureKey);
    this.container.addAt(this.boardSprite, 0);
    
    // Hide the original graphics (keep it for potential regeneration)
    this.boardGraphics.setVisible(false);
  }

  /* ============================================
   * PUBLIC ACCESSOR METHODS
   * ============================================
   */

  /**
   * Gets the chess wrapper for direct access
   * 
   * @returns The ChessBoardWrapper instance
   * 
   * Used by: GameScene (for game logic)
   */
  getWrapper(): ChessBoardWrapper {
    return this.wrapper;
  }

  /**
   * Gets current position as FEN string
   * 
   * @returns FEN notation of current position
   */
  getPosition(): string {
    return this.wrapper.getPosition();
  }

  /**
   * Sets position from FEN string
   * 
   * @param fen - FEN notation to set
   */
  setPosition(fen: string): void {
    this.wrapper.setPosition(fen);
    this.renderPieces();
  }

  /**
   * Checks if board is flipped
   * 
   * @returns True if showing black perspective
   */
  isFlipped(): boolean {
    return this.flipped;
  }

  /**
   * Sets board flip state
   * 
   * Requirement 1.8: Black pieces at bottom when flipped
   * 
   * @param flipped - Whether to flip the board
   */
  setFlipped(flipped: boolean): void {
    this.flipped = flipped;
    this.renderPieces();
  }

  /* ============================================
   * PUBLIC GAME LOGIC METHODS
   * ============================================
   */

  /**
   * Gets valid moves for a square
   * 
   * @param square - Square to get moves for
   * @returns Array of valid destination squares
   */
  getValidMoves(square: Square): Square[] {
    return this.wrapper.getValidMoves(square);
  }

  /**
   * Makes a move on the board
   * 
   * @param from - Source square
   * @param to - Destination square
   * @returns Move result with success flag and details
   * 
   * Used by: GameScene.handleMove()
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
   * Checks if a king is attacked
   * 
   * @param color - Color of king to check
   * @returns True if king is in check
   */
  isKingAttacked(color: Color): boolean {
    return this.wrapper.isKingAttacked(color);
  }

  /**
   * Checks if a king can be captured this turn
   * 
   * Requirement 2.3: Allow King to be captured
   * 
   * @returns True if king capture is possible
   */
  canCaptureKing(): boolean {
    return this.wrapper.canCaptureKing();
  }

  /**
   * Places a piece on the board (for card effects)
   * 
   * @param square - Square to place piece on
   * @param type - Piece type (p, n, b, r, q, k)
   * @param color - Piece color (w, b)
   * @returns True if placement succeeded
   * 
   * Used by: GameScene (card effects)
   */
  placePiece(square: Square, type: PieceSymbol, color: Color): boolean {
    const result = this.wrapper.placePiece(square, type, color);
    if (result) {
      this.renderPieces();
    }
    return result;
  }

  /**
   * Removes a piece from the board (for card effects)
   * 
   * @param square - Square to remove piece from
   * @returns True if removal succeeded
   * 
   * Used by: GameScene (card effects)
   */
  removePiece(square: Square): boolean {
    const result = this.wrapper.removePiece(square);
    if (result) {
      this.renderPieces();
    }
    return result;
  }

  /* ============================================
   * PRIVATE BOARD RENDERING
   * ============================================
   */

  /**
   * Draws the chess board squares with 3D effect
   * 
   * Algorithm:
   * 1. Draw each square with base color
   * 2. Add highlight on top-left (L-shape)
   * 3. Add shadow on bottom-right (L-shape)
   * 4. Draw grid lines between squares
   * 5. Draw board shadow
   * 6. Draw coordinate labels
   * 
   * @private
   */
  private drawBoard(): void {
    this.boardGraphics.clear();
    const size = SQUARE_SIZE * this.scale;
    
    // Draw squares with 3D effect
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const isLight = (row + col) % 2 === 0;
        const baseColor = isLight ? LIGHT_SQUARE_COLOR : DARK_SQUARE_COLOR;
        
        // Main square
        this.boardGraphics.fillStyle(baseColor, 1);
        this.boardGraphics.fillRect(col * size, row * size, size, size);
        
        // Highlight on top-left (L-shape)
        const highlightColor = isLight ? hex('#fff8e7') : hex('#c9a06a');
        this.boardGraphics.fillStyle(highlightColor, 1);
        // Top-left corner
        this.boardGraphics.fillRect(col * size, row * size, size * 0.15, size * 0.15);
        // Top edge extension
        this.boardGraphics.fillRect(col * size + size * 0.15, row * size, size * 0.15, size * 0.15);
        // Left edge extension
        this.boardGraphics.fillRect(col * size, row * size + size * 0.15, size * 0.15, size * 0.15);
        
        // Shadow on bottom-right (L-shape)
        const shadowColor = isLight ? hex('#d4c4a8') : hex('#9a7653');
        this.boardGraphics.fillStyle(shadowColor, 1);
        this.boardGraphics.fillRect(col * size + size * 0.85, row * size + size * 0.85, size * 0.15, size * 0.15);
        this.boardGraphics.fillRect(col * size + size * 0.7, row * size + size * 0.85, size * 0.15, size * 0.15);
        this.boardGraphics.fillRect(col * size + size * 0.85, row * size + size * 0.7, size * 0.15, size * 0.15);
      }
    }
    
    // Draw grid lines between squares
    const thinLineWidth = Math.max(1, Math.round(1 * this.scale));
    this.boardGraphics.fillStyle(hex('#5C4033'), 1);
    
    // Vertical lines
    for (let col = 1; col < BOARD_SIZE; col++) {
      this.boardGraphics.fillRect(col * size - thinLineWidth / 2, 0, thinLineWidth, BOARD_SIZE * size);
    }
    
    // Horizontal lines
    for (let row = 1; row < BOARD_SIZE; row++) {
      this.boardGraphics.fillRect(0, row * size - thinLineWidth / 2, BOARD_SIZE * size, thinLineWidth);
    }
    
    // Draw board shadow (right and bottom edges)
    const shadowWidth = Math.max(6, Math.round(8 * this.scale));
    this.boardGraphics.fillStyle(hex('#000000'), 0.4);
    this.boardGraphics.fillRect(BOARD_SIZE * size, shadowWidth, shadowWidth, BOARD_SIZE * size);
    this.boardGraphics.fillRect(shadowWidth, BOARD_SIZE * size, BOARD_SIZE * size, shadowWidth);
    
    // Draw coordinates
    this.drawCoordinates();
  }

  /**
   * Draws rank numbers (1-8) and file letters (a-h)
   * 
   * @private
   */
  private drawCoordinates(): void {
    const size = SQUARE_SIZE * this.scale;
    const fontSize = Math.round(16 * this.scale);
    const padding = 4 * this.scale;
    
    // Determine coordinate order based on flip state
    const ranks = this.flipped 
      ? ['1', '2', '3', '4', '5', '6', '7', '8'] 
      : ['8', '7', '6', '5', '4', '3', '2', '1'];
    const files = this.flipped 
      ? ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'] 
      : ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    
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

  /* ============================================
   * PRIVATE COORDINATE CONVERSION
   * ============================================
   */

  /**
   * Converts board coordinates to square notation
   * 
   * @param col - Column (0-7)
   * @param row - Row (0-7)
   * @returns Chess square notation (e.g., 'e4')
   * @private
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
   * Converts square notation to board coordinates
   * 
   * @param square - Chess square notation
   * @returns Object with col and row
   * @private
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

  /* ============================================
   * PRIVATE PIECE RENDERING
   * ============================================
   */

  /**
   * Renders all pieces on the board
   * 
   * Algorithm:
   * 1. Clear existing piece sprites
   * 2. Get all pieces from wrapper
   * 3. For each piece:
   *    a. Get texture key from PIECE_ASSETS
   *    b. Calculate position from square
   *    c. Create and position sprite
   * 
   * @private
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
      sprite.setScale(this.scale * 1.1);
      // Note: Don't set interactive on pieces - the board zone handles all clicks
      
      this.container.add(sprite);
      this.pieceSprites.set(square, sprite);
    }
  }

  /* ============================================
   * PRIVATE INTERACTION HANDLING
   * ============================================
   */

  /**
   * Sets up mouse/touch interaction
   * 
   * Creates an interactive zone covering the entire board
   * that handles all click events.
   * 
   * @private
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
      // Convert pointer position to board coordinates
      const scaleX = this.container.scaleX || 1;
      const scaleY = this.container.scaleY || 1;
      const localX = (pointer.x - this.x) / scaleX;
      const localY = (pointer.y - this.y) / scaleY;
      
      const col = Math.floor(localX / size);
      const row = Math.floor(localY / size);
      
      if (col >= 0 && col < 8 && row >= 0 && row < 8) {
        const square = this.coordsToSquare(col, row);
        this.handleSquareClick(square);
      }
    });
  }

  /**
   * Handles click on a square
   * 
   * Algorithm:
   * 1. Notify onSquareClick callback
   * 2. If piece selected and clicked valid move → attempt move
   * 3. Else if piece on square → select it
   * 4. Else → clear selection
   * 
   * @param square - The clicked square
   * @private
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

  /* ============================================
   * PUBLIC SELECTION METHODS
   * ============================================
   */

  /**
   * Selects a square and shows valid moves
   * 
   * @param square - Square to select
   */
  selectSquare(square: Square): void {
    this.selectedSquare = square;
    this.validMoveSquares = this.wrapper.getValidMoves(square);
    this.renderHighlights();
  }

  /**
   * Clears current selection
   */
  clearSelection(): void {
    this.selectedSquare = null;
    this.validMoveSquares = [];
    this.clearHighlights();
  }

  /* ============================================
   * PUBLIC HIGHLIGHT METHODS
   * ============================================
   */

  /**
   * Highlights specified squares
   * 
   * @param squares - Squares to highlight
   * @param color - Highlight color (default: green)
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
   * Clears all highlights
   */
  clearHighlights(): void {
    this.highlightGraphics.clear();
  }

  /**
   * Renders selection and valid move highlights
   * 
   * @private
   */
  private renderHighlights(): void {
    this.clearHighlights();
    const size = SQUARE_SIZE * this.scale;
    
    // Highlight selected square (yellow)
    if (this.selectedSquare) {
      const { col, row } = this.squareToCoords(this.selectedSquare);
      this.highlightGraphics.fillStyle(SELECTED_COLOR, 0.5);
      this.highlightGraphics.fillRect(col * size, row * size, size, size);
    }
    
    // Highlight valid moves (green for empty, red for captures)
    for (const square of this.validMoveSquares) {
      const { col, row } = this.squareToCoords(square);
      const piece = this.wrapper.getPiece(square);
      
      const color = piece ? ATTACK_HIGHLIGHT_COLOR : HIGHLIGHT_COLOR;
      this.highlightGraphics.fillStyle(color, 0.5);
      this.highlightGraphics.fillRect(col * size, row * size, size, size);
    }
  }

  /* ============================================
   * PUBLIC OVERLAY METHODS
   * ============================================
   */

  /**
   * Renders control power overlay
   * 
   * Shows which player controls each square:
   * - Blue tint: White control (positive power)
   * - Red tint: Black control (negative power)
   * 
   * @param controlMap - Map of square → control power
   * 
   * Used by: GameScene (when showing control visualization)
   */
  renderControlOverlay(controlMap: ControlPowerMap): void {
    this.overlayGraphics.clear();
    const size = SQUARE_SIZE * this.scale;
    
    for (const square of getAllSquares()) {
      const power = controlMap[square] || 0;
      if (power === 0) continue;
      
      const { col, row } = this.squareToCoords(square);
      
      // White control = blue, Black control = red
      const color = power > 0 ? hex('#4444ff') : hex('#ff4444');
      const alpha = Math.min(Math.abs(power) * 0.15, 0.6);
      
      this.overlayGraphics.fillStyle(color, alpha);
      this.overlayGraphics.fillRect(col * size, row * size, size, size);
    }
  }

  /**
   * Clears control overlay
   */
  clearControlOverlay(): void {
    this.overlayGraphics.clear();
  }

  /* ============================================
   * PUBLIC CONTAINER METHODS
   * ============================================
   */

  /**
   * Gets the main container
   * 
   * @returns The Phaser container
   */
  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  /**
   * Gets the sprite for a piece on a square
   * 
   * Useful for animations.
   * 
   * @param square - Square to get sprite for
   * @returns The piece sprite, or null
   * 
   * Used by: AnimationManager
   */
  getPieceSprite(square: Square): Phaser.GameObjects.Image | null {
    return this.pieceSprites.get(square) || null;
  }

  /**
   * Gets texture key for a piece type
   * 
   * @param type - Piece type (p, n, b, r, q, k)
   * @param color - Piece color (w, b)
   * @returns Texture key, or null
   * 
   * Used by: AnimationManager
   */
  getPieceTextureKey(type: PieceSymbol, color: Color): string | null {
    const assetKey = `${color === 'w' ? 'w' : 'b'}${type.toUpperCase()}`;
    return PIECE_ASSETS[assetKey] || null;
  }

  /**
   * Sets position of the board container
   * 
   * @param x - New X position
   * @param y - New Y position
   * 
   * Used by: GameScene.handleResize()
   */
  setContainerPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.container.setPosition(x, y);
  }

  /**
   * Destroys the component and cleans up resources
   * 
   * Used by: GameScene.shutdown()
   */
  destroy(): void {
    for (const sprite of this.pieceSprites.values()) {
      sprite.destroy();
    }
    this.pieceSprites.clear();
    
    // Clean up board texture
    if (this.boardSprite) {
      const textureKey = this.boardSprite.texture.key;
      this.boardSprite.destroy();
      this.scene.textures.remove(textureKey);
    }
    
    this.container.destroy();
  }
}
