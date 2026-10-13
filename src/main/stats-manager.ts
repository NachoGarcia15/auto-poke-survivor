// src/main/stats-manager.ts - Run recording and statistics calculation
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { RunRecord, StatsSummary } from '../shared/types';

const RUNS_FILENAME = 'run-history.json';

export class StatsManager {
  private runs: RunRecord[] = [];
  private dataPath: string;
  private currentRun: RunRecord | null = null;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.dataPath = path.join(userDataPath, RUNS_FILENAME);
    this.loadRuns();
  }

  private loadRuns(): void {
    try {
      if (fs.existsSync(this.dataPath)) {
        const raw = fs.readFileSync(this.dataPath, 'utf-8');
        this.runs = JSON.parse(raw);
      }
    } catch (err) {
      console.error('Failed to load run history:', err);
      this.runs = [];
    }
  }

  private saveRuns(): void {
    try {
      const dir = path.dirname(this.dataPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.dataPath, JSON.stringify(this.runs, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save run history:', err);
    }
  }

  startRun(character?: string, currencyBefore?: number): RunRecord {
    const run: RunRecord = {
      id: `run-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      startTime: Date.now(),
      endTime: null,
      duration: null,
      result: 'unknown',
      character,
      upgrades: [],
      killCount: null,
      currencyBefore: currencyBefore ?? null,
      currencyAfter: null,
      currencyEarned: null,
      maxLevel: null,
      maxTimer: null,
      errors: [],
      manualInterventions: 0,
      progressionConfirmed: false,
    };
    this.currentRun = run;
    return run;
  }

  updateCurrentRun(updates: Partial<RunRecord>): RunRecord | null {
    if (!this.currentRun) return null;
    Object.assign(this.currentRun, updates);
    return { ...this.currentRun };
  }

  endRun(result: RunRecord['result'], updates?: Partial<RunRecord>): RunRecord | null {
    if (!this.currentRun) return null;

    this.currentRun.endTime = Date.now();
    this.currentRun.duration = this.currentRun.endTime - this.currentRun.startTime;
    this.currentRun.result = result;

    if (updates) {
      Object.assign(this.currentRun, updates);
    }

    // Calculate currency earned if we have before/after
    if (
      this.currentRun.currencyBefore !== null &&
      this.currentRun.currencyAfter !== null
    ) {
      this.currentRun.currencyEarned =
        this.currentRun.currencyAfter - this.currentRun.currencyBefore;
    }

    const completedRun = { ...this.currentRun };
    this.runs.push(completedRun);
    this.currentRun = null;
    this.saveRuns();

    return completedRun;
  }

  getCurrentRun(): RunRecord | null {
    return this.currentRun ? { ...this.currentRun } : null;
  }

  getRuns(limit?: number): RunRecord[] {
    const sorted = [...this.runs].sort((a, b) => b.startTime - a.startTime);
    if (limit) return sorted.slice(0, limit);
    return sorted;
  }

  clearRuns(): void {
    this.runs = [];
    this.saveRuns();
  }

  getStats(): StatsSummary {
    const completed = this.runs.filter(
      (r) => r.result === 'completed' || r.result === 'died'
    );
    const withDuration = completed.filter((r) => r.duration !== null);
    const withKills = completed.filter((r) => r.killCount !== null);
    const withLevel = completed.filter((r) => r.maxLevel !== null);
    const withCurrency = this.runs.filter((r) => r.currencyEarned !== null);

    const totalPlayTime = this.runs.reduce(
      (sum, r) => sum + (r.duration ?? 0),
      0
    );

    const totalCurrencyEarned = withCurrency.reduce(
      (sum, r) => sum + (r.currencyEarned ?? 0),
      0
    );

    return {
      totalRuns: this.runs.length,
      completedRuns: completed.filter((r) => r.result === 'completed').length,
      failedRuns: completed.filter((r) => r.result === 'died').length,
      averageDuration:
        withDuration.length > 0
          ? withDuration.reduce((sum, r) => sum + (r.duration ?? 0), 0) /
            withDuration.length
          : null,
      bestDuration:
        withDuration.length > 0
          ? Math.max(...withDuration.map((r) => r.duration ?? 0))
          : null,
      totalCurrencyEarned: withCurrency.length > 0 ? totalCurrencyEarned : null,
      currencyPerHour:
        withCurrency.length > 0 && totalPlayTime > 0
          ? (totalCurrencyEarned / totalPlayTime) * 3600000
          : null,
      averageKills:
        withKills.length > 0
          ? withKills.reduce((sum, r) => sum + (r.killCount ?? 0), 0) /
            withKills.length
          : null,
      averageLevel:
        withLevel.length > 0
          ? withLevel.reduce((sum, r) => sum + (r.maxLevel ?? 0), 0) /
            withLevel.length
          : null,
      totalPlayTime,
      lastRunAt:
        this.runs.length > 0
          ? Math.max(...this.runs.map((r) => r.startTime))
          : null,
    };
  }
}
