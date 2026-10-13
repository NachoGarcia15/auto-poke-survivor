// src/main/input-controller.ts - Executes gameplay actions in the game webContents
import { WebContents } from 'electron';
import { GameAction, ActionType, MoveDirection } from '../shared/types';
import { logger } from './logger';

/**
 * InputController - Sends keyboard/mouse events to the game.
 *
 * Uses Electron's webContents input API to send events to the game,
 * avoiding direct DOM manipulation.
 */
export class InputController {
  private webContents: WebContents | null = null;
  private activeKeys: Set<string> = new Set();
  private disposed = false;

  setWebContents(webContents: WebContents): void {
    this.webContents = webContents;
  }

  /**
   * Execute a game action
   */
  async execute(action: GameAction): Promise<boolean> {
    if (!this.webContents || this.webContents.isDestroyed() || this.disposed) {
      return false;
    }

    try {
      switch (action.type) {
        case ActionType.MOVE:
          if (action.direction) {
            await this.updateMovement(action.direction);
          }
          return true;

        case ActionType.CLICK:
          if (action.clickPosition) {
            await this.click(action.clickPosition.x, action.clickPosition.y);
          }
          return true;

        case ActionType.SELECT_UPGRADE:
          if (action.upgradeIndex !== undefined) {
            await this.selectUpgrade(action.upgradeIndex);
          }
          return true;

        case ActionType.START_GAME:
          await this.startGame();
          return true;

        case ActionType.RESTART:
          await this.restartGame();
          return true;

        case ActionType.NONE:
        case ActionType.WAIT:
          return true;

        default:
          logger.warn(`Unknown action type: ${action.type}`);
          return false;
      }
    } catch (err) {
      logger.error(`Action execution error: ${action.type}`, err);
      return false;
    }
  }

  /**
   * Update which movement keys are pressed.
   * Uses WASD by default (can be configured).
   */
  private async updateMovement(direction: MoveDirection): Promise<void> {
    if (!this.webContents) return;

    const keyMap: Record<string, string> = {
      up: 'w',
      down: 's',
      left: 'a',
      right: 'd',
    };

    // Determine which keys should be pressed
    const desiredKeys = new Set<string>();
    if (direction.up) desiredKeys.add(keyMap.up);
    if (direction.down) desiredKeys.add(keyMap.down);
    if (direction.left) desiredKeys.add(keyMap.left);
    if (direction.right) desiredKeys.add(keyMap.right);

    // Release keys that should no longer be pressed
    for (const key of this.activeKeys) {
      if (!desiredKeys.has(key)) {
        await this.sendKey(key, 'keyUp');
        this.activeKeys.delete(key);
      }
    }

    // Press keys that are not yet active
    for (const key of desiredKeys) {
      if (!this.activeKeys.has(key)) {
        await this.sendKey(key, 'keyDown');
        this.activeKeys.add(key);
      }
    }
  }

  /**
   * Send a keyboard event
   */
  private async sendKey(key: string, type: 'keyDown' | 'keyUp' | 'char'): Promise<void> {
    if (!this.webContents || this.webContents.isDestroyed()) return;

    try {
      this.webContents.sendInputEvent({
        type,
        keyCode: key,
      });
    } catch (err) {
      logger.debug(`sendKey error for ${key}`, err);
    }
  }

  /**
   * Click at a position in the game
   */
  private async click(x: number, y: number): Promise<void> {
    if (!this.webContents || this.webContents.isDestroyed()) return;

    try {
      this.webContents.sendInputEvent({
        type: 'mouseDown',
        x: Math.round(x),
        y: Math.round(y),
        button: 'left',
        clickCount: 1,
      });
      await this.delay(50);
      this.webContents.sendInputEvent({
        type: 'mouseUp',
        x: Math.round(x),
        y: Math.round(y),
        button: 'left',
        clickCount: 1,
      });
    } catch (err) {
      logger.debug('Click error', err);
    }
  }

  /**
   * Select an upgrade by clicking the card or sending numeric keys 1, 2, 3
   */
  private async selectUpgrade(index: number): Promise<void> {
    if (!this.webContents || this.webContents.isDestroyed()) return;

    // 1. Try DOM click on the specific level-up card in #scr-levelup
    await this.webContents.executeJavaScript(`
      (function() {
        const levelupCards = document.querySelectorAll('#scr-levelup .card, .levelup-card, [class*="upgrade"] .card, [class*="upgrade"] button');
        if (levelupCards.length > ${index}) {
          (levelupCards[${index}]).click();
          return true;
        }
        return false;
      })()
    `).catch(() => false);

    // 2. Also send synthetic number key event (1, 2, 3) which G.Game handles natively
    const numKey = String(index + 1);
    await this.sendKey(numKey, 'keyDown');
    await this.delay(50);
    await this.sendKey(numKey, 'keyUp');
  }

  /**
   * Start a new game
   */
  private async startGame(): Promise<void> {
    if (!this.webContents || this.webContents.isDestroyed()) return;

    // Try clicking start button via JS
    await this.webContents.executeJavaScript(`
      (function() {
        const startBtn = document.querySelector('[class*="start"] button, [class*="play"] button, button[class*="start"]');
        if (startBtn) {
          startBtn.click();
          return true;
        }
        return false;
      })()
    `);

    // Fallback: press Enter or Space
    await this.sendKey('Enter', 'keyDown');
    await this.delay(50);
    await this.sendKey('Enter', 'keyUp');
  }

  /**
   * Restart game after game over
   */
  private async restartGame(): Promise<void> {
    if (!this.webContents || this.webContents.isDestroyed()) return;

    await this.webContents.executeJavaScript(`
      (function() {
        const restartBtn = document.querySelector('[class*="restart"] button, [class*="retry"] button, [class*="again"] button, button[class*="restart"]');
        if (restartBtn) {
          restartBtn.click();
          return true;
        }
        return false;
      })()
    `);
  }

  /**
   * Release all held keys - CRITICAL for cleanup
   */
  async releaseAllKeys(): Promise<void> {
    for (const key of this.activeKeys) {
      await this.sendKey(key, 'keyUp');
    }
    this.activeKeys.clear();
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    this.disposed = true;
    await this.releaseAllKeys();
    this.webContents = null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // src/main/input-controller.ts

  /**
   * Simula un clic del ratón sobre un elemento del DOM usando un selector CSS
   */
  public async clickElement(selector: string): Promise<boolean> {
    if (!this.webContents) return false;
    
    return await this.webContents.executeJavaScript(`
      (() => {
        const el = document.querySelector('${selector}');
        if (el) {
          (el as HTMLElement).click();
          return true;
        }
        return false;
      })()
    `).catch(() => false);
  }
}
