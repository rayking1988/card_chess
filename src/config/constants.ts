/**
 * @fileoverview Centralized Configuration Constants for Card Chess
 * 
 * This file contains all game configuration constants organized by category.
 * Centralizing these values makes it easier to tune game balance, adjust
 * visual settings, and maintain consistency across the codebase.
 * 
 * Categories:
 * - Game Rules: Core gameplay mechanics and timing
 * - Visual: Colors, sizes, and display settings
 * - Layout: Positioning and spacing values
 * - Animation: Timing and easing for animations
 * - Network: P2P connection settings
 * 
 * @module config/constants
 */

/* ============================================
 * GAME RULES CONSTANTS
 * ============================================
 * Core gameplay mechanics, timing, and resource values.
 * These affect game balance and should be tuned carefully.
 */

/**
 * Clock and Time Settings
 * Controls the chess clock and time-based mechanics.
 */
export const CLOCK = {
  /** Initial clock time in seconds (10 minutes) */
  INITIAL_SECONDS: 600,
  
  /** Time cost for making a chess move (seconds) */
  MOVE_TIME_COST: 3,
  
  /** Time cost for mulligan action (seconds) */
  MULLIGAN_TIME_COST: 10,
  
  /** Time threshold for low time warning (seconds) */
  LOW_TIME_THRESHOLD: 60,
  
  /** Seconds in a minute (for time formatting) */
  SECONDS_PER_MINUTE: 60,
} as const;

/**
 * Stopwatch Settings
 * Controls the turn time tracker and threshold mechanics.
 */
export const STOPWATCH = {
  /** Threshold in seconds that triggers opponent card draw */
  THRESHOLD_SECONDS: 60,
  
  /** Progress thresholds for visual warnings (as percentage of threshold) */
  WARNING_THRESHOLDS: {
    LOW: 0.5,      // 50% - Yellow text starts
    MEDIUM: 0.75,  // 75% - Orange text
    HIGH: 0.9,     // 90% - Red text
  },
} as const;

/**
 * Energy System Settings
 * Controls the energy resource mechanics.
 */
export const ENERGY = {
  /** Initial energy value at game start */
  INITIAL_ENERGY: 0,
  
  /** Initial energy cap at game start */
  INITIAL_CAP: 0,
  
  /** Maximum segments to display in energy bar */
  MAX_DISPLAY_SEGMENTS: 10,
} as const;

/**
 * Hand and Deck Settings
 * Controls card management mechanics.
 */
export const CARDS = {
  /** Maximum cards allowed in hand */
  MAX_HAND_SIZE: 7,
  
  /** Number of cards drawn at game start */
  INITIAL_DRAW_COUNT: 7,
  
  /** Total cards in a standard deck */
  DECK_SIZE: 60,
} as const;

/**
 * Chess Board Settings
 * Controls the chess board dimensions and rules.
 */
export const CHESS = {
  /** Standard chess board size (8x8) */
  BOARD_SIZE: 8,
  
  /** Size of each square in pixels (before scaling) */
  SQUARE_SIZE: 64,
  
  /** Total board size in pixels (8 squares × 64px) */
  BOARD_PIXEL_SIZE: 512, // BOARD_SIZE * SQUARE_SIZE
  
  /** Initial FEN string: only two kings on the board */
  INITIAL_FEN: '4k3/8/8/8/8/8/8/4K3 w - - 0 1',
} as const;

/* ============================================
 * VISUAL CONSTANTS
 * ============================================
 * Colors, sizes, and display settings for UI components.
 */

/**
 * Game Display Settings
 * Base resolution and rendering configuration.
 */
export const DISPLAY = {
  /** Base game width in pixels (reference resolution) */
  GAME_WIDTH: 1920,
  
  /** Base game height in pixels (reference resolution) */
  GAME_HEIGHT: 1080,
  
  /** Background color when no scene background is loaded (dark brown) */
  BACKGROUND_COLOR: '#2a1a0a',
  
  /** Target frames per second */
  TARGET_FPS: 30,
} as const;

/**
 * Chess Board Colors
 * Colors for the chess board squares and highlights.
 */
export const BOARD_COLORS = {
  /** Light square color (cream/beige) */
  LIGHT_SQUARE: '#f0d9b5',
  
  /** Dark square color (brown) */
  DARK_SQUARE: '#b58863',
  
  /** Light square highlight (3D effect) */
  LIGHT_HIGHLIGHT: '#fff8e7',
  
  /** Dark square highlight (3D effect) */
  DARK_HIGHLIGHT: '#c9a06a',
  
  /** Light square shadow (3D effect) */
  LIGHT_SHADOW: '#d4c4a8',
  
  /** Dark square shadow (3D effect) */
  DARK_SHADOW: '#9a7653',
  
  /** Grid line color */
  GRID_LINE: '#5C4033',
  
  /** Valid move highlight color (green) */
  HIGHLIGHT_VALID: '#7fff00',
  
  /** Selected square highlight color (yellow) */
  HIGHLIGHT_SELECTED: '#ffff00',
  
  /** Attack/capture highlight color (red) */
  HIGHLIGHT_ATTACK: '#ff6b6b',
} as const;

/**
 * Clock Display Colors
 * Colors for the chess clock based on time remaining.
 */
export const CLOCK_COLORS = {
  /** Normal time color (black) - plenty of time */
  NORMAL: '#000000',
  
  /** Warning time color (light red) - under 60 seconds */
  WARNING: '#ff6666',
  
  /** Critical time color (red) - time expired */
  CRITICAL: '#ff0000',
  
  /** Active clock tint (light green) */
  ACTIVE_TINT: '#aaffaa',
} as const;

/**
 * Stopwatch Display Colors
 * Colors for the stopwatch based on threshold progress.
 */
export const STOPWATCH_COLORS = {
  /** Base time color (white) */
  BASE: '#ffffff',
  
  /** Low warning color (yellow) */
  LOW: '#ffff44',
  
  /** Medium warning color (orange) */
  MEDIUM: '#ffaa44',
  
  /** High warning color (red) */
  HIGH: '#ff4444',
} as const;

/**
 * Energy Bar Colors
 * Colors for the energy bar display.
 */
export const ENERGY_COLORS = {
  /** Fill color (lemon yellow) */
  FILL: '#f0e130',
  
  /** Empty segment color (dark gray) */
  EMPTY_SEGMENT: '#2a2a2a',
  
  /** Bar background color (dark gray) */
  BACKGROUND: '#333333',
  
  /** Bar border color (gold) */
  BORDER: '#ffd700',
  
  /** Text colors for different states */
  TEXT: {
    EMPTY: '#555555',     // Dark gray - no energy system yet (0/0)
    DEPLETED: '#005488',  // Dark blue - empty (0/X where X > 0)
    FULL: '#006657',      // Dark green - at capacity
    NORMAL: '#000000',    // Black - partial energy
  },
} as const;

/**
 * Disturb Counter Colors
 * Colors for the disturb tag display.
 */
export const DISTURB_COLORS = {
  /** Fill color (purple) */
  FILL: '#9b59b6',
  
  /** Empty segment color (dark gray) */
  EMPTY_SEGMENT: '#2a2a2a',
  
  /** Bar background color (dark gray) */
  BACKGROUND: '#333333',
  
  /** Text colors for different states */
  TEXT: {
    EMPTY: '#555555',   // Dark gray - no disturb tags
    ACTIVE: '#ffffff',  // White - has tags (readable on purple)
  },
} as const;

/**
 * Focus/Disturb Toggle Colors
 * Fallback colors when sprites are not available.
 */
export const TOGGLE_COLORS = {
  FOCUS: {
    BACKGROUND: '#225522',
    BORDER: '#44ff44',
    TEXT: '#44ff44',
  },
  DISTURB: {
    BACKGROUND: '#552222',
    BORDER: '#ff4444',
    TEXT: '#ff4444',
  },
} as const;

/**
 * Card Targeting Colors
 * Colors for the targeting arrow and highlights.
 */
export const TARGETING_COLORS = {
  /** Arrow color (orange) */
  ARROW: '#f1820c',
  
  /** Valid target highlight (yellow) */
  VALID_TARGET: '#eff708',
  
  /** Invalid target highlight (red) */
  INVALID_TARGET: '#e50b0b',
} as const;

/**
 * Loading Bar Colors
 * Colors for the boot scene loading bar.
 */
export const LOADING_COLORS = {
  /** Background color (orange) */
  BACKGROUND: '#f4a508',
  
  /** Fill color (yellow) */
  FILL: '#e7f20d',
  
  /** Background alpha */
  BACKGROUND_ALPHA: 0.5,
} as const;

/* ============================================
 * LAYOUT CONSTANTS
 * ============================================
 * Positioning, spacing, and sizing values for UI components.
 */

/**
 * Clock Component Dimensions
 */
export const CLOCK_LAYOUT = {
  /** Clock display width in pixels */
  WIDTH: 150,
  
  /** Clock display height in pixels */
  HEIGHT: 98,
  
  /** Time text Y offset from center */
  TIME_Y_OFFSET: -11,
  
  /** Label text Y offset from center */
  LABEL_Y_OFFSET: -85,
} as const;

/**
 * Stopwatch Component Dimensions
 */
export const STOPWATCH_LAYOUT = {
  /** Stopwatch display width in pixels */
  WIDTH: 66,
  
  /** Stopwatch display height in pixels */
  HEIGHT: 80,
  
  /** Time text Y offset from center */
  TIME_Y_OFFSET: 5,
} as const;

/**
 * Energy/Disturb Bar Dimensions
 */
export const BAR_LAYOUT = {
  /** Bar width in pixels (bar body only) */
  WIDTH: 140,
  
  /** Bar height in pixels */
  HEIGHT: 25,
  
  /** Icon size in pixels */
  ICON_SIZE: 30,
  
  /** Gap between icon and bar */
  ICON_GAP: 8,
  
  /** Gap between segments */
  SEGMENT_GAP: 2,
  
  /** Label Y offset from center */
  LABEL_Y_OFFSET: -24,
} as const;

/**
 * Focus/Disturb Toggle Dimensions
 */
export const TOGGLE_LAYOUT = {
  /** Toggle button width in pixels */
  WIDTH: 80,
  
  /** Toggle button height in pixels */
  HEIGHT: 40,
  
  /** Label Y offset from center */
  LABEL_Y_OFFSET: -30,
} as const;

/**
 * Card Component Dimensions
 */
export const CARD_LAYOUT = {
  /** Base card width for calculations */
  WIDTH: 10,
  
  /** Base card height for calculations */
  HEIGHT: 14,
  
  /** Scale factor for card frame and back */
  FRAME_SCALE: 0.3,
  
  /** Y offset for card art (negative = above center) */
  ART_Y_OFFSET: -220,
  
  /** Scale factor for card art */
  ART_SCALE: 1.2,
  
  /** X position for energy circle (left side) */
  ENERGY_CIRCLE_X: -280,
  
  /** Y position for energy circle (top area) */
  ENERGY_CIRCLE_Y: -550,
  
  /** X position for time circle (left side, below energy) */
  TIME_CIRCLE_X: -280,
  
  /** Y position for time circle */
  TIME_CIRCLE_Y: -380,
  
  /** Scale factor for cost circles */
  CIRCLE_SCALE: 2.2,
  
  /** Y offset for card name text */
  NAME_Y_OFFSET: 100,
  
  /** Y offset for description text */
  DESC_Y_OFFSET: 220,
  
  /** Width of description text box */
  DESC_BOX_WIDTH: 350,
  
  /** Hit area width multiplier */
  HIT_AREA_WIDTH: 600,
  
  /** Hit area height multiplier */
  HIT_AREA_HEIGHT: 900,
} as const;

/**
 * Card Hand Layout Settings
 */
export const HAND_LAYOUT = {
  /** Degrees between adjacent cards in the fan */
  FAN_SPREAD_ANGLE: 30,
  
  /** Maximum total spread angle for the entire fan */
  MAX_FAN_ANGLE: 80,
  
  /** Radius of the arc for fan arrangement (affects curvature) */
  FAN_RADIUS: 900,
  
  /** Normal card scale when displayed in hand */
  CARD_SCALE: 0.8,
  
  /** Scale multiplier when hovering over a card */
  HOVER_SCALE: 1.2,
  
  /** Pixels to lift card vertically on hover */
  HOVER_LIFT: 50,
  
  /** Scale for the preview card shown on hover */
  PREVIEW_SCALE: 1.5,
  
  /** Margin from screen edge for preview card position */
  PREVIEW_MARGIN: 20,
  
  /** Arc height factor for card positioning */
  ARC_HEIGHT_FACTOR: 0.2,
  
  /** Default arc height when section height is 0 */
  DEFAULT_ARC_HEIGHT: 20,
} as const;

/**
 * Card Targeting Layout Settings
 */
export const TARGETING_LAYOUT = {
  /** Width of the arrow line in pixels */
  ARROW_WIDTH: 4,
  
  /** Size of the arrow head in pixels */
  ARROW_HEAD_SIZE: 15,
  
  /** Alpha for play zone highlight */
  PLAY_ZONE_ALPHA: 0.3,
  
  /** Curve factor for the targeting arrow (0 = straight, higher = more curved) */
  ARROW_CURVE_FACTOR: 0.3,
  
  /** Minimum segments for arrow curve rendering */
  MIN_ARROW_SEGMENTS: 20,
  
  /** Segment divisor for arrow curve (distance / divisor = segments) */
  ARROW_SEGMENT_DIVISOR: 10,
} as const;

/**
 * Loading Bar Layout Settings
 */
export const LOADING_LAYOUT = {
  /** Loading bar width in pixels */
  WIDTH: 320,
  
  /** Loading bar height in pixels */
  HEIGHT: 50,
  
  /** Fill bar height in pixels */
  FILL_HEIGHT: 30,
  
  /** Padding inside the bar */
  PADDING: 10,
} as const;

/* ============================================
 * ANIMATION CONSTANTS
 * ============================================
 * Timing and easing values for animations.
 */

export const ANIMATION = {
  /** Toggle bounce animation duration (ms) */
  TOGGLE_BOUNCE_DURATION: 100,
  
  /** Waiting dots animation interval (ms) */
  WAITING_DOTS_INTERVAL: 500,
  
  /** Game start delay after match found (ms) */
  GAME_START_DELAY: 1000,
} as const;

/* ============================================
 * DEPTH (Z-INDEX) CONSTANTS
 * ============================================
 * Layer ordering for visual elements.
 */

export const DEPTH = {
  /** Background layer */
  BACKGROUND: -1,
  
  /** Normal card depth in hand */
  CARD_NORMAL: 0,
  
  /** Hovered card depth */
  CARD_HOVERED: 100,
  
  /** Dragging card depth */
  CARD_DRAGGING: 200,
  
  /** Play zone graphics depth */
  PLAY_ZONE: 499,
  
  /** Targeting arrow depth */
  TARGETING_ARROW: 500,
  
  /** Preview card depth */
  PREVIEW_CARD: 1000,
} as const;

/* ============================================
 * NETWORK CONSTANTS
 * ============================================
 * P2P connection and matchmaking settings.
 */

export const NETWORK = {
  /** LocalStorage key for persisting player name */
  STORAGE_KEY: 'card_chess_player_name',
  
  /** Default room ID for matchmaking lobby */
  DEFAULT_ROOM_ID: 'card-chess-matchmaking-lobby',
  
  /** Ko-fi donation page URL */
  KOFI_URL: 'https://ko-fi.com/cardchess',
  
  /** GitHub issues page for bug reports */
  BUG_REPORT_URL: 'https://github.com/cardchess/issues',
  
  /** Maximum player name length */
  MAX_NAME_LENGTH: 20,
} as const;

/* ============================================
 * SCALE FACTORS
 * ============================================
 * Various scale and ratio values used throughout the game.
 */

export const SCALE = {
  /** Button hover scale */
  BUTTON_HOVER: 1.05,
  
  /** Button press scale */
  BUTTON_PRESS: 0.98,
  
  /** Toggle hover scale */
  TOGGLE_HOVER: 1.05,
  
  /** Toggle bounce scale */
  TOGGLE_BOUNCE: 1.1,
  
  /** Piece sprite scale multiplier */
  PIECE_SCALE: 1.1,
  
  /** Card overlap factor for fan layout */
  CARD_OVERLAP_FACTOR: 0.35,
  
  /** Card rotation dampening factor */
  CARD_ROTATION_FACTOR: 0.3,
  
  /** Hand width padding factor */
  HAND_WIDTH_PADDING: 0.05,
  
  /** Hand height padding factor */
  HAND_HEIGHT_PADDING: 0.15,
  
  /** Hand reduction factor for smaller cards */
  HAND_REDUCTION_FACTOR: 0.7,
  
  /** Minimum hand scale */
  MIN_HAND_SCALE: 0.5,
  
  /** Maximum hand scale */
  MAX_HAND_SCALE: 0.8,
} as const;

/* ============================================
 * MATH CONSTANTS
 * ============================================
 * Mathematical values used in calculations.
 */

export const MATH = {
  /** Degrees to radians conversion factor */
  DEG_TO_RAD: Math.PI / 180,
  
  /** Arrow head angle offset (PI/6 = 30 degrees) */
  ARROW_HEAD_ANGLE: Math.PI / 6,
  
  /** 3D effect highlight size factor */
  HIGHLIGHT_SIZE: 0.15,
  
  /** 3D effect shadow size factor */
  SHADOW_SIZE: 0.15,
  
  /** 3D effect shadow offset factor */
  SHADOW_OFFSET: 0.85,
} as const;

/* ============================================
 * GAME LAYOUT CONSTANTS
 * ============================================
 * Layout section percentages and positioning values.
 */

export const GAME_LAYOUT = {
  /** Section percentages for horizontal division (must sum to 100%) */
  SECTION: {
    LEFT_PANEL_WIDTH: 8,
    BOARD_WIDTH: 50,
    RIGHT_PANEL_WIDTH: 18,
    EVENT_LOG_WIDTH: 24,
    TOP_BAR_HEIGHT: 8,
    MIDDLE_HEIGHT: 64,
    BOTTOM_BAR_HEIGHT: 28,
  },
  
  /** Right panel vertical split ratios */
  RIGHT_PANEL_SPLIT: {
    TOP: 0.45,
    MIDDLE: 0.45,
    BOTTOM: 0.1,
  },
  
  /** Event log vertical split ratio */
  EVENT_LOG_SPLIT_TOP: 2 / 3,
  
  /** Mobile layout threshold (width/height ratio) */
  MOBILE_RATIO_THRESHOLD: 0.85,
  
  /** Base board size (8 squares * 64 pixels) */
  BASE_BOARD_SIZE: 512,
  
  /** Maximum board size multiplier */
  MAX_BOARD_SIZE_MULTIPLIER: 1.5,
  
  /** Board padding factor */
  BOARD_PADDING_FACTOR: 0.05,
  
  /** Hand scale calculation divisor */
  HAND_SCALE_DIVISOR: 340,
  
  /** Minimum hand scale */
  MIN_HAND_SCALE: 0.45,
  
  /** Maximum hand scale */
  MAX_HAND_SCALE: 0.95,
  
  /** Left panel padding factor */
  LEFT_PANEL_PADDING_FACTOR: 0.06,
  
  /** Pile spacing factor */
  PILE_SPACING_FACTOR: 0.18,
  
  /** Right panel top Y factor */
  RIGHT_PANEL_TOP_Y_FACTOR: 0.05,
  
  /** Event log width factor */
  EVENT_LOG_WIDTH_FACTOR: 0.9,
  
  /** Top bar opponent hand Y factor */
  TOP_BAR_OPPONENT_HAND_Y_FACTOR: 0.8,
  
  /** Top bar opponent hand label Y factor */
  TOP_BAR_OPPONENT_LABEL_Y_FACTOR: 0.7,
  
  /** Mobile bar height factors */
  MOBILE_BAR: {
    MIN_HEIGHT: 24,
    MAX_HEIGHT: 40,
    HEIGHT_FACTOR: 0.055,
  },
} as const;

/* ============================================
 * LEFT PANEL LAYOUT CONSTANTS
 * ============================================
 * Deck and discard pile positioning values.
 */

export const LEFT_PANEL_LAYOUT = {
  /** Deck card scale factor */
  DECK_SCALE: 0.14,
  
  /** Top card scale factor */
  TOP_CARD_SCALE: 0.75,
  
  /** Label font size factor */
  LABEL_FONT_SIZE: 11,
  
  /** Count font size factor */
  COUNT_FONT_SIZE: 12,
  
  /** Label Y offset factor */
  LABEL_Y_OFFSET: 60,
  
  /** Count Y offset factor */
  COUNT_Y_OFFSET: 55,
  
  /** Maximum pile layers for visual depth */
  MAX_PILE_LAYERS: 60,
} as const;

/* ============================================
 * RIGHT PANEL LAYOUT CONSTANTS
 * ============================================
 * Clock, energy, and toggle positioning values.
 */

export const RIGHT_PANEL_LAYOUT = {
  /** Base gap between components */
  BASE_GAP: 10,
  
  /** Available height factor */
  AVAILABLE_HEIGHT_FACTOR: 0.84,
  
  /** Maximum scale factor */
  MAX_SCALE_FACTOR: 1.4,
  
  /** Minimum scale factor */
  MIN_SCALE_FACTOR: 0.85,
  
  /** Controlled squares button scale factor */
  BUTTON_SCALE_FACTOR: 0.7,
} as const;

/* ============================================
 * MOBILE BAR LAYOUT CONSTANTS
 * ============================================
 * Mobile info bar positioning values.
 */

export const MOBILE_BAR_LAYOUT = {
  /** Icon size factor */
  ICON_SIZE: 16,
  
  /** Padding factor */
  PADDING: 8,
  
  /** Gap between elements */
  GAP: 10,
  
  /** Icon gap factor */
  ICON_GAP: 4,
  
  /** Button scale factor */
  BUTTON_SCALE: 0.55,
  
  /** Button padding factor */
  BUTTON_PADDING: 6,
  
  /** Minimum button scale */
  MIN_BUTTON_SCALE: 0.3,
} as const;

/* ============================================
 * OPPONENT HAND LAYOUT CONSTANTS
 * ============================================
 * Opponent hand display values.
 */

export const OPPONENT_HAND_LAYOUT = {
  /** Base card height */
  BASE_CARD_HEIGHT: 140,
  
  /** Base card width */
  BASE_CARD_WIDTH: 100,
  
  /** Available height factor */
  AVAILABLE_HEIGHT_FACTOR: 0.9,
  
  /** Overlap factor */
  OVERLAP_FACTOR: 0.3,
  
  /** Available width factor */
  AVAILABLE_WIDTH_FACTOR: 0.8,
  
  /** Maximum scale */
  MAX_SCALE: 0.2,
  
  /** Maximum tilt factor */
  MAX_TILT_FACTOR: 0.05,
  
  /** Maximum tilt limit */
  MAX_TILT_LIMIT: 0.3,
  
  /** Arc depth factor */
  ARC_DEPTH_FACTOR: 0.08,
  
  /** Visible height factor */
  VISIBLE_HEIGHT_FACTOR: 1.2,
  
  /** Label Y factor */
  LABEL_Y_FACTOR: 0.85,
  
  /** Count Y factor */
  COUNT_Y_FACTOR: 0.95,
} as const;

/* ============================================
 * CARD HAND LAYOUT CONSTANTS
 * ============================================
 * Player card hand positioning values.
 */

export const CARD_HAND_LAYOUT = {
  /** Center Y offset */
  CENTER_Y_OFFSET: 50,
  
  /** Card count Y offset factor */
  COUNT_Y_OFFSET: 18,
  
  /** Card count font size */
  COUNT_FONT_SIZE: 14,
} as const;

/* ============================================
 * OVERLAY LAYOUT CONSTANTS
 * ============================================
 * Overlay positioning and sizing values.
 */

export const OVERLAY_LAYOUT = {
  /** Overlay height in board squares */
  HEIGHT_IN_SQUARES: 2,
  
  /** Overlay Y offset in board squares */
  Y_OFFSET_IN_SQUARES: 3,
  
  /** Title Y offset factor */
  TITLE_Y_OFFSET_FACTOR: 0.18,
  
  /** Button Y offset factor */
  BUTTON_Y_OFFSET_FACTOR: 0.18,
  
  /** Button X offset factor */
  BUTTON_X_OFFSET: 160,
  
  /** Button scale factor */
  BUTTON_SCALE_FACTOR: 0.8,
  
  /** Mulligan title font size */
  MULLIGAN_TITLE_FONT_SIZE: 28,
  
  /** Game end title font size */
  GAME_END_TITLE_FONT_SIZE: 30,
  
  /** Game end button X offset */
  GAME_END_BUTTON_X_OFFSET: 180,
  
  /** Discard prompt Y offset */
  DISCARD_PROMPT_Y_OFFSET: 150,
  
  /** Discard prompt font size */
  DISCARD_PROMPT_FONT_SIZE: 24,
  
  /** Connection text Y offset */
  CONNECTION_TEXT_Y_OFFSET: 40,
  
  /** Connection button Y offset */
  CONNECTION_BUTTON_Y_OFFSET: 40,
  
  /** Rematch delay (ms) */
  REMATCH_DELAY: 300,
} as const;

/* ============================================
 * INTERACTION BLOCKER CONSTANTS
 * ============================================
 * Screen blocker overlay values.
 */

export const INTERACTION_BLOCKER = {
  /** Alpha transparency */
  ALPHA: 0.3,
  
  /** Depth (z-index) */
  DEPTH: 90,
} as const;

/* ============================================
 * DISCARD VIEWER CONSTANTS
 * ============================================
 * Discard pile viewer overlay values.
 */

export const DISCARD_VIEWER = {
  /** Container depth */
  DEPTH: 220,
  
  /** Background alpha */
  BACKGROUND_ALPHA: 0.6,
  
  /** Title font size factor */
  TITLE_FONT_SIZE: 20,
  
  /** Close button scale factor */
  CLOSE_BUTTON_SCALE: 0.7,
  
  /** Panel width factor */
  PANEL_WIDTH_FACTOR: 0.72,
  
  /** Panel max width */
  PANEL_MAX_WIDTH: 760,
  
  /** Panel height factor */
  PANEL_HEIGHT_FACTOR: 0.78,
  
  /** Panel max height */
  PANEL_MAX_HEIGHT: 640,
  
  /** Padding factor */
  PADDING: 24,
  
  /** Title height factor */
  TITLE_HEIGHT: 56,
  
  /** Border radius */
  BORDER_RADIUS: 12,
  
  /** Close button X offset */
  CLOSE_BUTTON_X_OFFSET: 70,
  
  /** Card scale factor */
  CARD_SCALE: 0.55,
  
  /** Card spacing X */
  CARD_SPACING_X: 140,
  
  /** Card spacing Y */
  CARD_SPACING_Y: 200,
  
  /** Card depth */
  CARD_DEPTH: 230,
  
  /** Panel fill alpha */
  PANEL_FILL_ALPHA: 0.96,
} as const;

/* ============================================
 * EVENT LOG CONSTANTS
 * ============================================
 * Event log panel values.
 */

export const EVENT_LOG_LAYOUT = {
  /** Log panel width */
  WIDTH: 300,
  
  /** Log panel height */
  HEIGHT: 600,
  
  /** Header height */
  HEADER_HEIGHT: 18,
  
  /** Footer height */
  FOOTER_HEIGHT: 56,
  
  /** Entry height */
  ENTRY_HEIGHT: 30,
  
  /** Padding */
  PADDING: 10,
  
  /** Quick chat button height */
  QUICK_CHAT_HEIGHT: 32,
  
  /** Quick chat margin */
  QUICK_CHAT_MARGIN: 12,
  
  /** Quick chat option height */
  QUICK_CHAT_OPTION_HEIGHT: 24,
  
  /** Quick chat option padding */
  QUICK_CHAT_OPTION_PADDING: 6,
  
  /** Scroll button font size */
  SCROLL_BUTTON_FONT_SIZE: 14,
  
  /** Entry font size */
  ENTRY_FONT_SIZE: 18,
  
  /** Entry background alpha */
  ENTRY_BACKGROUND_ALPHA: 0.28,
  
  /** Entry border radius */
  ENTRY_BORDER_RADIUS: 4,
  
  /** Panel border radius */
  PANEL_BORDER_RADIUS: 10,
  
  /** Panel fill alpha */
  PANEL_FILL_ALPHA: 0.96,
  
  /** Border width outer */
  BORDER_WIDTH_OUTER: 4,
  
  /** Border width inner */
  BORDER_WIDTH_INNER: 2,
  
  /** Border inset 1 */
  BORDER_INSET_1: 4,
  
  /** Border inset 2 */
  BORDER_INSET_2: 8,
  
  /** Quick chat font size */
  QUICK_CHAT_FONT_SIZE: 16,
  
  /** Quick chat option font size */
  QUICK_CHAT_OPTION_FONT_SIZE: 14,
} as const;

/* ============================================
 * TURN OVERLAY CONSTANTS
 * ============================================
 * Turn banner and overlay values.
 */

export const TURN_OVERLAY = {
  /** Banner width */
  BANNER_WIDTH: 360,
  
  /** Banner height */
  BANNER_HEIGHT: 56,
  
  /** Banner border radius */
  BANNER_BORDER_RADIUS: 12,
  
  /** Banner half width */
  BANNER_HALF_WIDTH: 180,
  
  /** Banner half height */
  BANNER_HALF_HEIGHT: 28,
  
  /** Banner font size */
  BANNER_FONT_SIZE: 26,
  
  /** Overlay font size */
  OVERLAY_FONT_SIZE: 28,
  
  /** Overlay alpha */
  OVERLAY_ALPHA: 0.5,
} as const;

/* ============================================
 * NAMEPLATE CONSTANTS
 * ============================================
 * Player nameplate values.
 */

export const NAMEPLATE = {
  /** Font size factor */
  FONT_SIZE: 20,
} as const;

/* ============================================
 * GAME SCENE UI FACTORY CONSTANTS
 * ============================================
 * UI component creation values.
 */

export const UI_FACTORY = {
  /** Initial clock time */
  INITIAL_CLOCK_TIME: 600,
  
  /** Deck label font size */
  DECK_LABEL_FONT_SIZE: 10,
  
  /** Deck count font size */
  DECK_COUNT_FONT_SIZE: 12,
  
  /** Hand label font size */
  HAND_LABEL_FONT_SIZE: 12,
  
  /** Mobile stat font size */
  MOBILE_STAT_FONT_SIZE: 12,
  
  /** Right panel tint alpha */
  RIGHT_PANEL_TINT_ALPHA: 0.28,
  
  /** Right panel backdrop alpha */
  RIGHT_PANEL_BACKDROP_ALPHA: 0.3,
} as const;
