// tests/stats-manager.test.ts - Tests for the stats manager
// Note: These tests mock the 'electron' module to test StatsManager logic independently

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock electron's app module
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/test-auto-poke'),
  },
}));

// Mock fs to avoid actual file operations
vi.mock('fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => '[]'),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

import { StatsManager } from '../src/main/stats-manager';

describe('StatsManager', () => {
  let stats: StatsManager;

  beforeEach(() => {
    stats = new StatsManager();
  });

  describe('Run lifecycle', () => {
    it('should start a new run', () => {
      const run = stats.startRun('Pikachu', 100);
      expect(run.id).toBeDefined();
      expect(run.character).toBe('Pikachu');
      expect(run.currencyBefore).toBe(100);
      expect(run.result).toBe('unknown');
      expect(run.endTime).toBeNull();
    });

    it('should update current run', () => {
      stats.startRun();
      const updated = stats.updateCurrentRun({ killCount: 50, maxLevel: 5 });
      expect(updated).not.toBeNull();
      expect(updated!.killCount).toBe(50);
      expect(updated!.maxLevel).toBe(5);
    });

    it('should end a run', () => {
      stats.startRun('Bulbasaur', 200);
      const run = stats.endRun('died', { currencyAfter: 350, killCount: 100 });
      expect(run).not.toBeNull();
      expect(run!.result).toBe('died');
      expect(run!.endTime).not.toBeNull();
      expect(run!.duration).toBeGreaterThanOrEqual(0);
      expect(run!.currencyEarned).toBe(150); // 350 - 200
    });

    it('should return null when ending with no active run', () => {
      const run = stats.endRun('completed');
      expect(run).toBeNull();
    });

    it('should return null when updating with no active run', () => {
      const updated = stats.updateCurrentRun({ killCount: 10 });
      expect(updated).toBeNull();
    });
  });

  describe('Statistics', () => {
    it('should return empty stats when no runs', () => {
      const summary = stats.getStats();
      expect(summary.totalRuns).toBe(0);
      expect(summary.averageDuration).toBeNull();
      expect(summary.currencyPerHour).toBeNull();
    });

    it('should calculate stats from completed runs', () => {
      // Run 1: died
      stats.startRun(undefined, 100);
      stats.endRun('died', {
        currencyAfter: 150,
        killCount: 30,
        maxLevel: 3,
      });

      // Run 2: died
      stats.startRun(undefined, 150);
      stats.endRun('died', {
        currencyAfter: 250,
        killCount: 70,
        maxLevel: 7,
      });

      const summary = stats.getStats();
      expect(summary.totalRuns).toBe(2);
      expect(summary.failedRuns).toBe(2);
      expect(summary.completedRuns).toBe(0);
      expect(summary.averageKills).toBe(50); // (30 + 70) / 2
      expect(summary.averageLevel).toBe(5); // (3 + 7) / 2
      expect(summary.totalCurrencyEarned).toBe(150); // 50 + 100
    });
  });

  describe('Run history', () => {
    it('should return runs sorted by most recent first', () => {
      stats.startRun();
      stats.endRun('died');

      stats.startRun();
      stats.endRun('completed');

      const runs = stats.getRuns();
      expect(runs.length).toBe(2);
      expect(runs[0].startTime).toBeGreaterThanOrEqual(runs[1].startTime);
    });

    it('should limit returned runs', () => {
      for (let i = 0; i < 5; i++) {
        stats.startRun();
        stats.endRun('died');
      }

      const runs = stats.getRuns(2);
      expect(runs.length).toBe(2);
    });

    it('should clear runs', () => {
      stats.startRun();
      stats.endRun('died');
      stats.clearRuns();

      const runs = stats.getRuns();
      expect(runs.length).toBe(0);
    });
  });
});
