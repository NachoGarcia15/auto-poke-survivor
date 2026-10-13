// tests/game-observer.test.ts - Tests for GameObserver
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameObserver } from '../src/main/game-observer';
import { GameScreen, Confidence } from '../src/shared/types';

describe('GameObserver', () => {
  let observer: GameObserver;
  let mockWebContents: any;

  beforeEach(() => {
    observer = new GameObserver();
    mockWebContents = {
      isDestroyed: vi.fn(() => false),
      executeJavaScript: vi.fn(),
    };
    observer.setWebContents(mockWebContents);
  });

  it('should return unknown state when webContents is not set or destroyed', async () => {
    const unattachedObserver = new GameObserver();
    const state = await unattachedObserver.observe();
    expect(state.screen.value).toBe(GameScreen.UNKNOWN);
    expect(state.screen.confidence).toBe(Confidence.UNKNOWN);
  });

  it('should parse window.G verified playing state', async () => {
    mockWebContents.executeJavaScript.mockResolvedValueOnce({
      source: 'G',
      screen: 'playing',
      player: { x: 120, y: 340, health: 85, maxHealth: 100, level: 4, exp: 210 },
      enemies: [{ x: 200, y: 300, health: 30 }],
      timer: 145,
      killCount: 42,
      currency: 1250,
      upgrades: [],
    });

    const state = await observer.observe();

    expect(state.screen.value).toBe(GameScreen.PLAYING);
    expect(state.screen.confidence).toBe(Confidence.VERIFIED);
    expect(state.player?.position?.value).toEqual({ x: 120, y: 340 });
    expect(state.player?.health?.value).toBe(85);
    expect(state.timer?.value).toBe(145);
    expect(state.killCount?.value).toBe(42);
    expect(state.currency?.value).toBe(1250);
    expect(state.enemies?.value.length).toBe(1);
  });

  it('should parse levelup upgrade selection screen', async () => {
    mockWebContents.executeJavaScript.mockResolvedValueOnce({
      source: 'G',
      screen: 'upgrade_select',
      upgrades: [
        { name: 'Thunderbolt', description: 'Electric beam', rarity: 'rare' },
        { name: 'Swift', description: 'Normal star projectiles', rarity: 'common' },
      ],
      timer: 60,
    });

    const state = await observer.observe();

    expect(state.screen.value).toBe(GameScreen.UPGRADE_SELECT);
    expect(state.upgrades?.value.length).toBe(2);
    expect(state.upgrades?.value[0].name).toBe('Thunderbolt');
  });

  it('should handle script execution rejection gracefully', async () => {
    mockWebContents.executeJavaScript.mockRejectedValueOnce(new Error('Page crashed'));

    const state = await observer.observe();

    expect(state.screen.value).toBe(GameScreen.UNKNOWN);
    expect(state.player).toBeNull();
  });
});
