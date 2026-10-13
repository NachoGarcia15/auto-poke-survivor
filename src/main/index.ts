// src/main/index.ts - Main Electron process entry point
import { app, BrowserWindow, BrowserView, ipcMain, session } from 'electron';
import * as path from 'path';
import { ConfigManager } from './config';
import { StatsManager } from './stats-manager';
import { AutomationEngine } from './automation-engine';
import { logger } from './logger';
import { IPC_CHANNELS, AppConfig } from '../shared/types';

class Application {
  private mainWindow: BrowserWindow | null = null;
  private gameView: BrowserView | null = null;
  private config: ConfigManager;
  private stats: StatsManager;
  private automation: AutomationEngine;

  constructor() {
    this.config = new ConfigManager();
    this.stats = new StatsManager();
    this.automation = new AutomationEngine(this.config.get(), this.stats);
  }

  async init(): Promise<void> {
    await app.whenReady();
    logger.info('Application starting');

    this.createMainWindow();
    this.registerIpcHandlers();

    // macOS specific
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createMainWindow();
      }
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    // Clean up on quit
    app.on('before-quit', async () => {
      logger.info('Application shutting down');
      await this.automation.emergencyStop();
    });
  }

  private createMainWindow(): void {
    const appConfig = this.config.get();

    this.mainWindow = new BrowserWindow({
      width: appConfig.display.windowWidth,
      height: appConfig.display.windowHeight,
      minWidth: 900,
      minHeight: 600,
      title: 'AutoPokeSurvivor',
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload', 'index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false, // Needed for preload script
      },
    });

    logger.setWindow(this.mainWindow);
    this.automation.setMainWindow(this.mainWindow);

    // Load the control panel UI
    const htmlPath = path.join(__dirname, '..', 'renderer', 'index.html');
    this.mainWindow.loadFile(htmlPath);

    // Create game BrowserView
    this.createGameView();

    if (appConfig.display.showDevTools) {
      this.mainWindow.webContents.openDevTools({ mode: 'detach' });
    }

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
      this.gameView = null;
    });

    this.mainWindow.on('resize', () => {
      this.updateGameViewBounds();
    });

    logger.info('Main window created');
  }

  private createGameView(): void {
    if (!this.mainWindow) return;

    const appConfig = this.config.get();

    // Use a persistent session partition for login persistence
    const gameSession = session.fromPartition('persist:pokesurvivor', {
      cache: true,
    });

    this.gameView = new BrowserView({
      webPreferences: {
        session: gameSession,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        // Allow the game to function normally
        webSecurity: true,
      },
    });

    this.mainWindow.addBrowserView(this.gameView);
    this.updateGameViewBounds();

    // Set the automation engine's webContents
    this.automation.setWebContents(this.gameView.webContents);

    // Load the game
    this.gameView.webContents.loadURL(appConfig.gameUrl).then(() => {
      logger.info('Game loaded: ' + appConfig.gameUrl);
    }).catch((err) => {
      logger.error('Failed to load game', err);
    });

    // Handle navigation errors
    this.gameView.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
      logger.error(`Game page load failed: ${errorCode} - ${errorDescription}`);
    });

    // Log console messages from the game (for debugging)
    this.gameView.webContents.on('console-message', (_event, level, message) => {
      if (level >= 2) { // Warning or error
        logger.debug(`[Game Console] ${message}`);
      }
    });
  }

  private updateGameViewBounds(): void {
    if (!this.mainWindow || !this.gameView) return;

    const bounds = this.mainWindow.getContentBounds();
    const controlPanelWidth = 320; // Width of the side control panel

    this.gameView.setBounds({
      x: controlPanelWidth,
      y: 0,
      width: Math.max(bounds.width - controlPanelWidth, 200),
      height: bounds.height,
    });
  }

  private registerIpcHandlers(): void {
    // Config
    ipcMain.handle(IPC_CHANNELS.GET_CONFIG, () => {
      return this.config.get();
    });

    ipcMain.handle(IPC_CHANNELS.SAVE_CONFIG, (_event, updates: Partial<AppConfig>) => {
      const newConfig = this.config.save(updates);
      this.automation.updateConfig(newConfig);
      return newConfig;
    });

    // Automation
    ipcMain.handle(IPC_CHANNELS.START_AUTOMATION, async () => {
      await this.automation.start();
    });

    ipcMain.handle(IPC_CHANNELS.STOP_AUTOMATION, async () => {
      await this.automation.stop();
    });

    // Stats
    ipcMain.handle(IPC_CHANNELS.GET_STATS, () => {
      return this.stats.getStats();
    });

    ipcMain.handle(IPC_CHANNELS.GET_RUNS, (_event, limit?: number) => {
      return this.stats.getRuns(limit);
    });

    ipcMain.handle(IPC_CHANNELS.GET_GAME_STATE, () => {
      // Return the observer's last known state
      return null; // Will be implemented when observer is refined
    });

    ipcMain.handle(IPC_CHANNELS.CLEAR_RUNS, () => {
      this.stats.clearRuns();
    });
  }
}

// Start the application
const application = new Application();
application.init().catch((err) => {
  console.error('Fatal application error:', err);
  process.exit(1);
});
