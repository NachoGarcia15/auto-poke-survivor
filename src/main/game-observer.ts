// src/main/game-observer.ts - Observes game state from the BrowserView/webContents
import { WebContents } from 'electron';
import {
  GameState,
  GameScreen,
  PlayerState,
  UpgradeOption,
  EnemyInfo,
  Confidence,
  ObservedValue,
} from '../shared/types';
import { logger } from './logger';

/**
 * Creates an ObservedValue with the given confidence
 */
function observed<T>(value: T, confidence: Confidence = Confidence.VERIFIED): ObservedValue<T> {
  return { value, confidence, timestamp: Date.now() };
}

/**
 * GameObserver - Inspects the game's state by executing JavaScript in the game's webContents.
 *
 * IMPORTANT: The actual selectors and state access methods must be verified against
 * the real game. This implementation provides a framework that will be refined
 * based on research findings.
 */
export class GameObserver {
  private webContents: WebContents | null = null;
  private lastState: GameState | null = null;
  private observationCount = 0;

  setWebContents(webContents: WebContents): void {
    this.webContents = webContents;
  }

  /**
   * Get the current game state by inspecting the page
   */
  async observe(): Promise<GameState> {
    if (!this.webContents || this.webContents.isDestroyed()) {
      return this.unknownState('No webContents available');
    }

    try {
      this.observationCount++;

      // Execute observation script in the game context
      const rawState = await this.webContents.executeJavaScript(
        this.getObservationScript(),
        true
      );

      const state = this.parseRawState(rawState);
      this.lastState = state;
      return state;
    } catch (err) {
      logger.debug('Observation error', err);
      return this.unknownState(`Observation error: ${err}`);
    }
  }

  /**
   * Get the last observed state without re-observing
   */
  getLastState(): GameState | null {
    return this.lastState;
  }

  /**
   * JavaScript to execute in the game context to extract state.
   * This script must be safe and read-only.
   *
   * NOTE: Selectors and global variable access will be refined after
   * researching the actual game source code.
   */
  /**
   * JavaScript to execute in the game context to extract state.
   * Leverages window.G (the verified global state container) with DOM fallbacks.
   */
  private getObservationScript(): string {
    return `
      (function() {
        const result = {
          url: window.location.href,
          title: document.title,
          screen: 'unknown',
          player: null,
          enemies: [],
          upgrades: [],
          timer: null,
          killCount: null,
          currency: null,
          source: 'dom',
        };

        try {
          const G = window.G;

          // 1. Direct inspection via window.G (Verified engine singleton)
          if (G && G.Game) {
            result.source = 'G';
            const gState = G.Game.state; // 'ui' | 'playing' | 'levelup' | 'choice' | 'held' | 'paused' | 'over'

            if (gState === 'playing') {
              result.screen = 'playing';
            } else if (gState === 'levelup' || gState === 'choice') {
              result.screen = 'upgrade_select';
            } else if (gState === 'paused' || gState === 'held') {
              result.screen = 'paused';
            } else if (gState === 'over') {
              result.screen = 'game_over';
            } else if (gState === 'ui') {
              const loginScr = document.getElementById('scr-login');
              const starterScr = document.getElementById('scr-starters');
              if (starterScr && !starterScr.classList.contains('hidden')) {
                result.screen = 'character_select';
              } else if (loginScr && !loginScr.classList.contains('hidden')) {
                result.screen = 'main_menu';
              } else {
                result.screen = 'main_menu';
              }
            }

            // Player state from G.Game.pl or G.Game.player
            const pl = G.Game.pl || G.Game.player;
            if (pl) {
              result.player = {
                x: pl.x,
                y: pl.y,
                health: pl.hp,
                maxHealth: pl.maxHp || pl.hpMax,
                level: pl.lvl,
                exp: pl.xp,
              };
            }

            // Timer & Kills
            if (typeof G.Game.time === 'number') {
              result.timer = Math.floor(G.Game.time);
            }
            if (typeof G.Game.kills === 'number') {
              result.killCount = G.Game.kills;
            }

            // Currencies from G.DB.save
            if (G.DB && G.DB.save && typeof G.DB.save.coins === 'number') {
              result.currency = G.DB.save.coins;
            }

            // Upgrades / level-up cards from G.LevelUp or active DOM cards
            if (G.LevelUp && Array.isArray(G.LevelUp.cards)) {
              result.upgrades = G.LevelUp.cards.map((c, idx) => ({
                name: c.name || c.id || 'Upgrade',
                description: c.desc || '',
                rarity: c.rarity || 'common',
              }));
            }

            // Active enemies from G.EnemyMgr
            if (G.EnemyMgr) {
              const enemies = typeof G.EnemyMgr.all === 'function' ? G.EnemyMgr.all() : (G.EnemyMgr.list || []);
              if (Array.isArray(enemies)) {
                result.enemies = enemies.slice(0, 50).map(e => ({
                  x: e.x,
                  y: e.y,
                  health: e.hp,
                }));
              }
            }

            return result;
          }

          // 2. Fallback: DOM inspection if window.G is not yet initialized
          const canvas = document.querySelector('canvas#game');
          const loginScr = document.getElementById('scr-login');
          const menuScr = document.getElementById('scr-menu');
          const levelupScr = document.getElementById('scr-levelup');
          const overScr = document.getElementById('scr-over');
          const pauseScr = document.getElementById('scr-pause');

          if (overScr && !overScr.classList.contains('hidden')) {
            result.screen = 'game_over';
          } else if (levelupScr && !levelupScr.classList.contains('hidden')) {
            result.screen = 'upgrade_select';
          } else if (pauseScr && !pauseScr.classList.contains('hidden')) {
            result.screen = 'paused';
          } else if (canvas && menuScr && menuScr.classList.contains('hidden') && loginScr && loginScr.classList.contains('hidden')) {
            result.screen = 'playing';
          } else {
            result.screen = 'main_menu';
          }

        } catch (e) {
          result._error = e.message;
        }

        return result;
      })()
    `;
  }

  /**
   * Parse raw observation result into typed GameState
   */
  private parseRawState(raw: any): GameState {
    if (!raw) {
      return this.unknownState('Empty observation result');
    }

    const screenMap: Record<string, GameScreen> = {
      unknown: GameScreen.UNKNOWN,
      loading: GameScreen.LOADING,
      main_menu: GameScreen.MAIN_MENU,
      character_select: GameScreen.CHARACTER_SELECT,
      playing: GameScreen.PLAYING,
      upgrade_select: GameScreen.UPGRADE_SELECT,
      paused: GameScreen.PAUSED,
      game_over: GameScreen.GAME_OVER,
      results: GameScreen.RESULTS,
    };

    const screen = screenMap[raw.screen] ?? GameScreen.UNKNOWN;
    const isVerified = raw.source === 'G';
    const confidence =
      screen === GameScreen.UNKNOWN
        ? Confidence.UNKNOWN
        : isVerified
        ? Confidence.VERIFIED
        : Confidence.ESTIMATED;

    const valConf = isVerified ? Confidence.VERIFIED : Confidence.ESTIMATED;

    const player: PlayerState | null =
      raw.player
        ? {
            position: raw.player.x != null
              ? observed({ x: raw.player.x, y: raw.player.y }, valConf)
              : null,
            health: raw.player.health != null
              ? observed(raw.player.health, valConf)
              : null,
            maxHealth: raw.player.maxHealth != null
              ? observed(raw.player.maxHealth, valConf)
              : null,
            level: raw.player.level != null
              ? observed(raw.player.level, valConf)
              : null,
            experience: raw.player.exp != null
              ? observed(raw.player.exp, valConf)
              : null,
            experienceToNext: null,
          }
        : null;

    const enemies: EnemyInfo[] = Array.isArray(raw.enemies)
      ? raw.enemies.map((e: any) => ({
          position: { x: e.x, y: e.y },
          health: e.health,
        }))
      : [];

    const upgrades: UpgradeOption[] = Array.isArray(raw.upgrades)
      ? raw.upgrades.map((u: any, i: number) => ({
          index: i,
          name: u.name ?? `Option ${i + 1}`,
          description: u.description ?? '',
          level: u.level,
          rarity: u.rarity,
        }))
      : [];

    return {
      screen: observed(screen, confidence),
      player,
      enemies: enemies.length > 0 ? observed(enemies, valConf) : null,
      upgrades: upgrades.length > 0 ? observed(upgrades, valConf) : null,
      timer: raw.timer != null ? observed(raw.timer, valConf) : null,
      killCount: raw.killCount != null ? observed(raw.killCount, valConf) : null,
      currency: raw.currency != null ? observed(raw.currency, valConf) : null,
      observedAt: Date.now(),
    };
  }

  /**
   * Returns an unknown state
   */
  private unknownState(reason: string): GameState {
    return {
      screen: observed(GameScreen.UNKNOWN, Confidence.UNKNOWN),
      player: null,
      enemies: null,
      upgrades: null,
      timer: null,
      killCount: null,
      currency: null,
      observedAt: Date.now(),
    };
  }
}
