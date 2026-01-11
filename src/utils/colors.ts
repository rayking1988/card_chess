/**
 * @fileoverview Color Utility Functions
 * 
 * Provides utilities for working with colors in Phaser.
 * Phaser requires numeric hex values (0xRRGGBB) for most color parameters,
 * but hex strings (#RRGGBB) are more readable and familiar.
 * 
 * @module utils/colors
 */

/**
 * Converts a hex color string to a numeric value for Phaser
 * 
 * @param hex - Color string in format '#RRGGBB' or 'RRGGBB'
 * @returns Numeric color value (e.g., 0xff0000 for red)
 * 
 * @example
 * hex('#ff0000')  // Returns 0xff0000 (red)
 * hex('#44ff44')  // Returns 0x44ff44 (green)
 * hex('ffffff')   // Returns 0xffffff (white)
 */
export function hex(color: string): number {
  // Remove # prefix if present
  const cleaned = color.startsWith('#') ? color.slice(1) : color;
  return parseInt(cleaned, 16);
}
