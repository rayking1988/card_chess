/**
 * @fileoverview Platform detection utilities
 * 
 * Provides utilities to detect whether the app is running in Electron
 * or as a web application.
 * 
 * @module utils/platform
 */

/**
 * Electron API interface exposed via preload script
 */
interface ElectronAPI {
  quitApp: () => Promise<void>;
  isElectron: () => Promise<boolean>;
  platform: string;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

/**
 * Checks if the app is running in Electron
 * 
 * @returns True if running in Electron, false if running in browser
 */
export function isElectron(): boolean {
  return typeof window !== 'undefined' && window.electronAPI !== undefined;
}

/**
 * Quits the Electron application
 * Only works when running in Electron
 */
export async function quitApp(): Promise<void> {
  if (isElectron() && window.electronAPI) {
    await window.electronAPI.quitApp();
  }
}

/**
 * Gets the current platform
 * 
 * @returns Platform string ('darwin', 'win32', 'linux') or 'web' for browser
 */
export function getPlatform(): string {
  if (isElectron() && window.electronAPI) {
    return window.electronAPI.platform;
  }
  return 'web';
}
