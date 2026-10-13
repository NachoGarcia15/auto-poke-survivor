// tests/automation-engine-integration.test.ts - Integration test for AutomationEngine
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/test-auto-poke-integration'),
  },
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => '[]'),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

import { AutomationEngine } from '../src/main/automation-engine';
import { StatsManager } from '../src/main/stats-manager';
import { DEFAULT_CONFIG, AutomationState, IPC_CHANNELS } from '../src/shared/types';

describe('AutomationEngine Integration', () => {
  let engine: AutomationEngine;
  let stats: StatsManager;
  let mockWebContents: any;
  let mockMainWindow: any;

  beforeEach(() => {
    vi.useFakeTimers();
    stats = new StatsManager();
    engine = new AutomationEngine({
      ...DEFAULT_CONFIG,
      automation: {
        ...DEFAULT_CONFIG.automation,
        observationInterval: 50,
      },
    }, stats);

    mockWebContents = {
      isDestroyed: vi.fn(() => false),
      executeJavaScript: vi.fn(),
      sendInputEvent: vi.fn(),
    };

    mockMainWindow = {
      isDestroyed: vi.fn(() => false),
      webContents: {
        send: vi.fn(),
      },
    };

    engine.setWebContents(mockWebContents);
    engine.setMainWindow(mockMainWindow);
  });

  afterEach(async () => {
    await engine.stop();
    vi.useRealTimers();
  });

  it('should start stopped, transition to RUNNING, and execute loops', async () => {
    expect(engine.getState()).toBe(AutomationState.STOPPED);

    // Mock playing state
    mockWebContents.executeJavaScript.mockResolvedValue({
      source: 'G',
      screen: 'playing',
      player: { x: 100, y: 100, health: 100, maxHealth: 100, level: 1, exp: 0 },
      enemies: [{ x: 120, y: 120, health: 10 }],
      timer: 10,
      killCount: 2,
      currency: 500,
    });

    await engine.start();
    expect(engine.getState()).toBe(AutomationState.RUNNING);

    // Fast-forward one interval
    await vi.advanceTimersByTimeAsync(60);

    // Verify observation and input execution occurred
    expect(mockWebContents.executeJavaScript).toHaveBeenCalled();
    expect(mockWebContents.sendInputEvent).toHaveBeenCalled();

    // Verify UI received state updates
    expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
      IPC_CHANNELS.GAME_STATE_UPDATED,
      expect.anything()
    );

    // Stop engine
    await engine.stop();
    expect(engine.getState()).toBe(AutomationState.STOPPED);
  });

  it('should handle emergency stop immediately releasing all inputs', async () => {
    await engine.start();
    await engine.emergencyStop();

    expect(engine.getState()).toBe(AutomationState.STOPPED);
  });
});
