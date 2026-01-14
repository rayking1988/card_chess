/**
 * @fileoverview Electron preload script
 * 
 * Exposes a safe API to the renderer process via contextBridge.
 * This allows the Phaser game to communicate with Electron's main process.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Quits the Electron application
   */
  quitApp: () => ipcRenderer.invoke('quit-app'),
  
  /**
   * Checks if running in Electron
   */
  isElectron: () => ipcRenderer.invoke('is-electron'),
  
  /**
   * Current platform
   */
  platform: process.platform,
});
