// tests/run-manager.test.ts - Unit tests for RunManager
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RunManager } from '../src/main/run-manager';
import { GameScreen, Confidence, GameState, AppConfig, DEFAULT_CONFIG } from '../src/shared/types';

function makeState(screen: GameScreen, currency?: number, kills?: number, timer?: number): GameState {
  return {
    screen: { value: screen, confidence: Confidence.VERIFIED, timestamp: Date.now() },
    player: {
      position: null,
      health: { value: 100, confidence: Confidence.VERIFIED, timestamp: Date.now() },
      maxHealth: { value: 100, confidence: Confidence.VERIFIED, timestamp: Date.now() },
      level: { value: 5, confidence: Confidence.VERIFIED, timestamp: Date.now() },
      experience: null,
      experienceToNext: null,
    },
    enemies: null,
    upgrades: null,
    timer: timer != null ? { value: timer, confidence: Confidence.VERIFIED, timestamp: Date.now() } : null,
    killCount: kills != null ? { value: kills, confidence: Confidence.VERIFIED, timestamp: Date.now() } : null,
    currency: currency != null ? { value: currency, confidence: Confidence.VERIFIED, timestamp: Date.now() } : null,
    observedAt: Date.now(),
  };
}

describe('RunManager', () => {
  let runManager: RunManager;
  let mockStats: any;
  let config: AppConfig;

  beforeEach(() => {
    config = {
      ...DEFAULT_CONFIG,
      automation: {
        ...DEFAULT_CONFIG.automation,
        maxRuns: 2,
      },
    };

    mockStats = {
      startRun: vi.fn((_char, curr) => ({
        id: 'run-123',
        startTime: Date.now(),
        currencyBefore: curr ?? null,
      })),
      updateCurrentRun: vi.fn(),
      endRun: vi.fn((res, updates) => ({
        id: 'run-123',
        result: res,
        duration: 120000,
        currencyEarned: 150,
        ...updates,
      })),
    };

    runManager = new RunManager(mockStats, config);
  });

  it('should detect run start when transitioning to PLAYING', () => {
    const state = makeState(GameScreen.PLAYING, 500);
    const event = runManager.processState(state);

    expect(event).not.toBeNull();
    expect(event?.type).toBe('run_started');
    expect(runManager.getInRun()).toBe(true);
    expect(runManager.getRunCount()).toBe(1);
    expect(mockStats.startRun).toHaveBeenCalledWith(undefined, 500);
  });

  it('should update run during active gameplay', () => {
    // Start run
    runManager.processState(makeState(GameScreen.PLAYING, 500));

    // Update state
    const updateEvent = runManager.processState(makeState(GameScreen.PLAYING, 500, 35, 120));

    expect(updateEvent?.type).toBe('run_updated');
    expect(mockStats.updateCurrentRun).toHaveBeenCalledWith({
      killCount: 35,
      maxLevel: 5,
      maxTimer: 120,
    });
  });

  it('should detect run end on GAME_OVER and confirm progression', () => {
    // Start run
    runManager.processState(makeState(GameScreen.PLAYING, 500));

    // Game over with updated currency
    const endEvent = runManager.processState(makeState(GameScreen.GAME_OVER, 650, 40, 180));

    expect(endEvent?.type).toBe('run_ended');
    expect(runManager.getInRun()).toBe(false);
    expect(mockStats.endRun).toHaveBeenCalledWith('died', expect.objectContaining({
      currencyAfter: 650,
      progressionConfirmed: true,
    }));
  });

  it('should trigger max_runs_reached when limit is satisfied', () => {
    // Run 1
    runManager.processState(makeState(GameScreen.PLAYING, 100));
    runManager.processState(makeState(GameScreen.GAME_OVER, 150));

    // Run 2 (limit is 2)
    runManager.processState(makeState(GameScreen.PLAYING, 150));
    const finalEvent = runManager.processState(makeState(GameScreen.GAME_OVER, 250));

    expect(finalEvent?.type).toBe('max_runs_reached');
  });

  it('should handle force stop safely', () => {
    runManager.processState(makeState(GameScreen.PLAYING, 100));
    const stoppedRun = runManager.forceStop();

    expect(stoppedRun).not.toBeNull();
    expect(runManager.getInRun()).toBe(false);
    expect(mockStats.endRun).toHaveBeenCalledWith('stopped');
  });
});
