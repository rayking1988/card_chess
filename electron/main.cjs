/**
 * @fileoverview Electron main process for Card Chess desktop app
 * 
 * This file handles the main Electron process, creating the browser window
 * and managing app lifecycle events.
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Disable hardware acceleration to reduce firewall prompts
// WebRTC will still work but won't trigger as many system-level network requests
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling');

/** @type {BrowserWindow | null} */
let mainWindow = null;

/**
 * Creates the main application window
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    title: 'Card Chess',
    icon: path.join(__dirname, '../public/icon/icon-512.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // Enable WebRTC
      webSecurity: true,
    },
    // Remove default menu bar
    autoHideMenuBar: true,
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    // In development, load from Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle events
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // On macOS, re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // On macOS, apps typically stay active until explicitly quit
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers
ipcMain.handle('quit-app', () => {
  app.quit();
});

ipcMain.handle('is-electron', () => {
  return true;
});
