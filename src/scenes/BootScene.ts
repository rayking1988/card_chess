import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    this.createLoadingBar();
    this.loadChessPieces();
    this.loadCardAssets();
    this.loadUIAssets();
    this.loadBackground();
  }

  private createLoadingBar(): void {
    const { width, height } = this.scale;
    
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);
    
    const loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading...', {
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0x00ff00, 1);
      progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });
  }

  private loadChessPieces(): void {
    // White pieces
    this.load.image('chess_pawn_white', 'chess/pawn.png');
    this.load.image('chess_knight_white', 'chess/knight.png');
    this.load.image('chess_bishop_white', 'chess/bishop.png');
    this.load.image('chess_rook_white', 'chess/rook.png');
    this.load.image('chess_queen_white', 'chess/queen.png');
    this.load.image('chess_king_white', 'chess/king.png');
    
    // Black pieces
    this.load.image('chess_pawn_black', 'chess/pawn1.png');
    this.load.image('chess_knight_black', 'chess/knight1.png');
    this.load.image('chess_bishop_black', 'chess/bishop1.png');
    this.load.image('chess_rook_black', 'chess/rook1.png');
    this.load.image('chess_queen_black', 'chess/queen1.png');
    this.load.image('chess_king_black', 'chess/king1.png');
    
    // Chess board
    this.load.image('chess_board', 'chess/chess_board.png');
  }

  private loadCardAssets(): void {
    // Card frames
    this.load.image('card_back', 'card/card_back.png');
    this.load.image('card_front_blue', 'card/card_front_blue.png');
    this.load.image('card_front_brown', 'card/card_front_brown.png');
    this.load.image('card_front_cyan', 'card/card_front_cyan.png');
    this.load.image('card_front_gold', 'card/card_front_gold.png');
    this.load.image('card_front_purple', 'card/card_front_purple.png');
    this.load.image('card_front_silver', 'card/card_front_silver.png');
    
    // Card circles
    this.load.image('energy_circle', 'card/energy_circle_gold.png');
    this.load.image('time_circle', 'card/time_circle_blue.png');
    
    // Card art
    this.load.image('card_art_bishop', 'card_art/bishop.png');
    this.load.image('card_art_destroy', 'card_art/destroy.png');
    this.load.image('card_art_energy', 'card_art/energy.png');
    this.load.image('card_art_grow', 'card_art/grow.png');
    this.load.image('card_art_king', 'card_art/king.png');
    this.load.image('card_art_knight', 'card_art/knight.png');
    this.load.image('card_art_pawn', 'card_art/pawn.png');
    this.load.image('card_art_ponder', 'card_art/ponder.png');
    this.load.image('card_art_queen', 'card_art/queen.png');
    this.load.image('card_art_rook', 'card_art/rook.png');
    this.load.image('card_art_search', 'card_art/search.png');
  }

  private loadUIAssets(): void {
    // Clock and stopwatch
    this.load.image('chess_clock', 'clock/chess_clock.png');
    this.load.image('stopwatch', 'stopwatch/stopwatch.png');
    
    // Focus/Disturb switches
    this.load.image('switch_focus', 'button/switch_focus.png');
    this.load.image('switch_disturb', 'button/switch_disturb.png');
    
    // Menu buttons
    this.load.image('blue_button', 'button/blue_button.png');
    this.load.image('blue_button_pressed', 'button/blue_button_pressed.png');
    this.load.image('brown_button', 'button/brown_button.png');
    this.load.image('brown_button_pressed', 'button/brown_button_pressed.png');
    this.load.image('yellow_button', 'button/yellow_button.png');
    this.load.image('yellow_button_pressed', 'button/yellow_button_pressed.png');
    this.load.image('red_button', 'button/red_button.png');
    this.load.image('red_button_pressed', 'button/red_button_pressed.png');
  }

  private loadBackground(): void {
    this.load.image('background', 'background/cyan_mat.png');
    this.load.image('room_background', 'background/room.png');
    
    // Load custom font
    // Note: Phaser doesn't directly load TTF fonts - we use CSS @font-face
    // The font will be loaded via CSS in index.html
  }

  create(): void {
    this.scene.start('MenuScene');
  }
}
