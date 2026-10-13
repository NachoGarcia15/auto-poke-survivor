// src/main/automation-engine.ts - Coordinates the observe-decide-act loop
import { WebContents } from 'electron';
import { BrowserWindow } from 'electron';
import {
  AutomationState,
  GameState,
  GameScreen,
  IPC_CHANNELS,
  AppConfig,
} from '../shared/types';
import { GameObserver } from './game-observer';
import { InputController } from './input-controller';
import { DecisionEngine } from './decision-engine';
import { StatsManager } from './stats-manager';
import { RunManager } from './run-manager';
import { logger } from './logger';

/**
 * AutomationEngine - The main automation loop coordinator.
 *
 * Lifecycle: STOPPED -> STARTING -> RUNNING -> (PAUSING) -> STOPPED
 *
 * The engine observes the game state, feeds it to the decision engine,
 * and executes the resulting actions through the input controller.
 */
export class AutomationEngine {
  private state: AutomationState = AutomationState.STOPPED;
  private observer: GameObserver;
  private input: InputController;
  private decision: DecisionEngine;
  private stats: StatsManager;
  private runManager: RunManager;
  private config: AppConfig;
  private mainWindow: BrowserWindow | null = null;

  private loopTimer: NodeJS.Timeout | null = null;
  private consecutiveErrors = 0;
  private lastScreen: GameScreen = GameScreen.UNKNOWN;
  private lastScreenChange = Date.now();
  private stallCheckTimer: NodeJS.Timeout | null = null;

  constructor(config: AppConfig, stats: StatsManager) {
    this.config = config;
    this.stats = stats;
    this.observer = new GameObserver();
    this.input = new InputController();
    this.decision = new DecisionEngine(config.strategy);
    this.runManager = new RunManager(stats, config);
  }

  setWebContents(webContents: WebContents): void {
    this.observer.setWebContents(webContents);
    this.input.setWebContents(webContents);
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  updateConfig(config: AppConfig): void {
    this.config = config;
    this.decision.updateConfig(config.strategy);
    this.runManager.updateConfig(config);
  }

  getState(): AutomationState {
    return this.state;
  }

  /**
   * Start the automation loop
   */
  async start(): Promise<void> {
    if (this.state === AutomationState.RUNNING) {
      logger.warn('Automation already running');
      return;
    }

    logger.info('Starting automation engine');
    this.setState(AutomationState.STARTING);
    this.consecutiveErrors = 0;

    // Start the observation-action loop
    this.setState(AutomationState.RUNNING);
    this.scheduleLoop();

    // Start stall detection
    this.startStallDetection();
  }

  /**
   * Stop the automation loop safely
   */
  async stop(): Promise<void> {
    logger.info('Stopping automation engine');
    this.setState(AutomationState.PAUSING);

    // Stop the loop
    if (this.loopTimer) {
      clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }

    // Stop stall detection
    if (this.stallCheckTimer) {
      clearInterval(this.stallCheckTimer);
      this.stallCheckTimer = null;
    }

    // Release all held keys - CRITICAL
    await this.input.releaseAllKeys();

    // End current run if active via RunManager
    const run = this.runManager.forceStop();
    if (run) {
      logger.info('Run ended (stopped)', { duration: run.duration });
      this.emitRunCompleted(run);
    }

    this.setState(AutomationState.STOPPED);
    logger.info('Automation engine stopped');
  }

  /**
   * Emergency stop - releases all keys immediately
   */
  async emergencyStop(): Promise<void> {
    logger.warn('EMERGENCY STOP');
    await this.input.releaseAllKeys();
    await this.stop();
  }

  /**
   * Dispose and clean up
   */
  async dispose(): Promise<void> {
    await this.stop();
    await this.input.dispose();
  }

  /**
   * Schedule the next loop iteration
   */
  private scheduleLoop(): void {
    if (this.state !== AutomationState.RUNNING) return;

    this.loopTimer = setTimeout(async () => {
      await this.loop();
      this.scheduleLoop();
    }, this.config.automation.observationInterval);
  }

  /**
   * One iteration of the observation-action loop
   */
  private async loop(): Promise<void> {
    if (this.state !== AutomationState.RUNNING) return;

    try {
      // 1. Observe
      const gameState = await this.observer.observe();

      // 2. Track screen changes
      this.trackScreenChange(gameState);

      // 3. Manage runs via RunManager
      const runEvent = this.runManager.processState(gameState);
      if (runEvent?.run && (runEvent.type === 'run_ended' || runEvent.type === 'max_runs_reached')) {
        this.emitRunCompleted(runEvent.run);
      }
      if (runEvent?.type === 'max_runs_reached') {
        logger.info('Max runs reached, stopping automation');
        await this.stop();
        return;
      }

      // 4. Emit state to UI
      this.emitGameState(gameState);

      // 5. Decide
      const action = this.decision.decide(gameState);

      // 6. Execute
      const success = await this.input.execute(action);

      if (success) {
        this.consecutiveErrors = 0;
      }

      // Log periodically
      if (this.consecutiveErrors === 0) {
        logger.debug(`Action: ${action.type} - ${action.reason}`);
      }
    } catch (err) {
      this.consecutiveErrors++;
      logger.error(`Loop error (${this.consecutiveErrors}/${this.config.automation.maxConsecutiveErrors})`, err);

      if (this.consecutiveErrors >= this.config.automation.maxConsecutiveErrors) {
        logger.error('Max consecutive errors reached, stopping automation');
        this.setState(AutomationState.ERROR);
        await this.stop();
      }
    }
  }

  /**
   * Track screen state changes for run management
   */
  private trackScreenChange(state: GameState): void {
    const currentScreen = state.screen.value;
    if (currentScreen !== this.lastScreen) {
      logger.info(`Screen changed: ${this.lastScreen} -> ${currentScreen}`);
      this.lastScreen = currentScreen;
      this.lastScreenChange = Date.now();
    }
  }

  /**
   * Detect stalled gameplay
   */
  private startStallDetection(): void {
    this.stallCheckTimer = setInterval(() => {
      if (this.state !== AutomationState.RUNNING) return;

      const timeSinceChange = Date.now() - this.lastScreenChange;
      if (
        timeSinceChange > this.config.automation.stallTimeout &&
        this.lastScreen === GameScreen.UNKNOWN
      ) {
        logger.warn('Possible stall detected - screen has been unknown for too long');
      }
    }, 10000);
  }

  /**
   * Update automation state and notify UI
   */
  private setState(newState: AutomationState): void {
    this.state = newState;
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      try {
        this.mainWindow.webContents.send(
          IPC_CHANNELS.AUTOMATION_STATE_CHANGED,
          newState
        );
      } catch {
        // Window may be closing
      }
    }
  }

  /**
   * Send game state update to UI
   */
  private emitGameState(state: GameState): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      try {
        this.mainWindow.webContents.send(
          IPC_CHANNELS.GAME_STATE_UPDATED,
          state
        );
      } catch {
        // Window may be closing
      }
    }
  }

  /**
   * Notify UI of completed run
   */
  private emitRunCompleted(run: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      try {
        this.mainWindow.webContents.send(IPC_CHANNELS.RUN_COMPLETED, run);
      } catch {
        // Window may be closing
      }
    }
  }
}
