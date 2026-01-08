import { defineConfig } from 'vite';

/**
 * Vite Configuration for Card Chess
 * 
 * Configured for:
 * - Development server on port 3000
 * - Production build for GitHub Pages deployment
 * - Asset handling from Game_Asset directory
 */
export default defineConfig({
  // Base path for GitHub Pages deployment
  // This should match the repository name when deployed to GitHub Pages
  // For user/org pages (username.github.io), use '/'
  // For project pages (username.github.io/repo-name), use '/repo-name/'
  base: './',
  
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false, // Disable sourcemaps for production
    // Increase chunk size warning limit for Phaser
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        // Manual chunks to separate vendor code
        manualChunks: {
          phaser: ['phaser'],
          chess: ['chess.js'],
          trystero: ['trystero']
        }
      }
    }
  },
  
  server: {
    port: 3000,
    open: true
  },
  
  preview: {
    port: 4173,
    open: true
  },
  
  // Public directory for static assets (chess pieces, cards, etc.)
  // Note: Game assets should be placed in the 'public' directory
  publicDir: 'public'
});
