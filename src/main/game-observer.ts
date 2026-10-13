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
        };

        try {
          // Detect game screen based on visible elements
          // These selectors will be refined based on actual game research

          // Check for common game canvas
          const canvas = document.querySelector('canvas');

          // Check for game-specific elements
          // Look for upgrade selection UI
          const upgradePanel = document.querySelector('[class*="upgrade"], [class*="level-up"], [id*="upgrade"]');
          // Look for game over / results screen
          const gameOver = document.querySelector('[class*="game-over"], [class*="gameover"], [class*="result"], [id*="game-over"]');
          // Look for main menu
          const mainMenu = document.querySelector('[class*="menu"], [class*="start"], [id*="menu"]');
          // Look for pause screen
          const pauseScreen = document.querySelector('[class*="pause"], [id*="pause"]');

          // Try to access game state through global variables
          // Common patterns in browser games
          if (typeof window.game !== 'undefined') {
            result._gameGlobal = true;
          }
          if (typeof window.Phaser !== 'undefined') {
            result._phaser = true;
          }

          // Check current URL for routing-based state
          const path = window.location.pathname;
          const hash = window.location.hash;

          if (gameOver) {
            result.screen = 'game_over';
          } else if (upgradePanel && window.getComputedStyle(upgradePanel).display !== 'none') {
            result.screen = 'upgrade_select';
          } else if (pauseScreen && window.getComputedStyle(pauseScreen).display !== 'none') {
            result.screen = 'paused';
          } else if (canvas) {
            // Canvas present, likely playing or in-game
            result.screen = 'playing';
          } else if (mainMenu) {
            result.screen = 'main_menu';
          }

          // Try to find timer display
          const timerEl = document.querySelector('[class*="timer"], [class*="time"], [id*="timer"]');
          if (timerEl) {
            const timerText = timerEl.textContent || '';
            const match = timerText.match(/(\\d+):(\\d+)/);
            if (match) {
              result.timer = parseInt(match[1]) * 60 + parseInt(match[2]);
            }
          }

          // Try to find kill count
          const killEl = document.querySelector('[class*="kill"], [class*="score"], [id*="kill"]');
          if (killEl) {
            const num = parseInt(killEl.textContent || '');
            if (!isNaN(num)) result.killCount = num;
          }

          // Try to find currency/coin display
          const currencyEl = document.querySelector('[class*="coin"], [class*="currency"], [class*="gold"], [id*="currency"]');
          if (currencyEl) {
            const num = parseInt((currencyEl.textContent || '').replace(/[^0-9]/g, ''));
            if (!isNaN(num)) result.currency = num;
          }

          // Enumerate visible elements for debugging
          result._bodyClasses = document.body.className;
          result._visibleIds = Array.from(document.querySelectorAll('[id]')).slice(0, 20).map(e => e.id);

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
    const confidence =
      screen === GameScreen.UNKNOWN ? Confidence.UNKNOWN : Confidence.ESTIMATED;

    const player: PlayerState | null =
      raw.player
        ? {
            position: raw.player.x != null
              ? observed({ x: raw.player.x, y: raw.player.y }, Confidence.ESTIMATED)
              : null,
            health: raw.player.health != null
              ? observed(raw.player.health, Confidence.ESTIMATED)
              : null,
            maxHealth: raw.player.maxHealth != null
              ? observed(raw.player.maxHealth, Confidence.ESTIMATED)
              : null,
            level: raw.player.level != null
              ? observed(raw.player.level, Confidence.ESTIMATED)
              : null,
            experience: raw.player.exp != null
              ? observed(raw.player.exp, Confidence.ESTIMATED)
              : null,
            experienceToNext: null,
          }
        : null;

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
      enemies: null,
      upgrades: upgrades.length > 0 ? observed(upgrades, Confidence.ESTIMATED) : null,
      timer: raw.timer != null ? observed(raw.timer, Confidence.ESTIMATED) : null,
      killCount: raw.killCount != null ? observed(raw.killCount, Confidence.ESTIMATED) : null,
      currency: raw.currency != null ? observed(raw.currency, Confidence.ESTIMATED) : null,
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
