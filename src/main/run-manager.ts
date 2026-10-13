// src/main/run-manager.ts - Dedicated module for managing run lifecycles, outcome detection, and progression confirmation
import { GameState, GameScreen, RunRecord, AppConfig } from '../shared/types';
import { StatsManager } from './stats-manager';
import { logger } from './logger';

export interface RunTransitionEvent {
  type: 'run_started' | 'run_updated' | 'run_ended' | 'max_runs_reached';
  run?: RunRecord;
  reason?: string;
}

export class RunManager {
  private stats: StatsManager;
  private config: AppConfig;
  private inRun = false;
  private runCount = 0;
  private lastScreen: GameScreen = GameScreen.UNKNOWN;

  constructor(stats: StatsManager, config: AppConfig) {
    this.stats = stats;
    this.config = config;
  }

  updateConfig(config: AppConfig): void {
    this.config = config;
  }

  getInRun(): boolean {
    return this.inRun;
  }

  getRunCount(): number {
    return this.runCount;
  }

  /**
   * Process an observed game state and manage run transitions
   */
  processState(state: GameState): RunTransitionEvent | null {
    const screen = state.screen.value;

    // 1. Detect run start when entering PLAYING screen
    if (screen === GameScreen.PLAYING && !this.inRun) {
      this.inRun = true;
      this.runCount++;
      const currency = state.currency?.value ?? undefined;
      const run = this.stats.startRun(undefined, currency);
      logger.info(`Run #${this.runCount} started (ID: ${run.id})`, { currencyBefore: currency });
      this.lastScreen = screen;
      return { type: 'run_started', run };
    }

    // 2. Continuous metrics update while playing
    if (this.inRun && screen === GameScreen.PLAYING) {
      this.stats.updateCurrentRun({
        killCount: state.killCount?.value ?? null,
        maxLevel: state.player?.level?.value ?? null,
        maxTimer: state.timer?.value ?? null,
      });
      this.lastScreen = screen;
      return { type: 'run_updated' };
    }

    // 3. Detect run conclusion when entering GAME_OVER or RESULTS screen
    if (this.inRun && (screen === GameScreen.GAME_OVER || screen === GameScreen.RESULTS)) {
      this.inRun = false;
      const currencyAfter = state.currency?.value ?? null;
      const killCount = state.killCount?.value ?? null;
      const maxLevel = state.player?.level?.value ?? null;
      const maxTimer = state.timer?.value ?? null;

      const run = this.stats.endRun('died', {
        currencyAfter,
        killCount,
        maxLevel,
        maxTimer,
        progressionConfirmed: currencyAfter !== null,
      });

      logger.info(`Run #${this.runCount} completed`, {
        duration: run?.duration,
        kills: run?.killCount,
        earned: run?.currencyEarned,
      });

      this.lastScreen = screen;

      if (this.config.automation.maxRuns > 0 && this.runCount >= this.config.automation.maxRuns) {
        return { type: 'max_runs_reached', run: run ?? undefined };
      }

      return { type: 'run_ended', run: run ?? undefined };
    }

    this.lastScreen = screen;
    return null;
  }

  /**
   * Force stop the active run (e.g. user halted automation or emergency stop)
   */
  forceStop(): RunRecord | null {
    if (!this.inRun) return null;
    this.inRun = false;
    const run = this.stats.endRun('stopped');
    logger.info(`Run #${this.runCount} aborted/stopped manually`);
    return run;
  }
}
