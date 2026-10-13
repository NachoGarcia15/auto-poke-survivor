// src/main/decision-engine.ts - Decides what action to take based on game state
import {
  GameState,
  GameScreen,
  GameAction,
  ActionType,
  MoveDirection,
  StrategyConfig,
  UpgradeOption,
  Confidence,
} from '../shared/types';
import { logger } from './logger';

/**
 * DecisionEngine - Pure logic module that maps game state to actions.
 * Deterministic and testable.
 */
export class DecisionEngine {
  private config: StrategyConfig;
  private moveAngle = 0;
  private lastMoveChange = 0;
  private moveChangeInterval = 2000; // Change direction every 2s
  private stuckCounter = 0;

  constructor(config: StrategyConfig) {
    this.config = config;
  }

  updateConfig(config: StrategyConfig): void {
    this.config = config;
  }

  /**
   * Given the current game state, decide what action to take
   */
  decide(state: GameState): GameAction {
    const screen = state.screen.value;

    switch (screen) {
      case GameScreen.MAIN_MENU:
        return this.handleMainMenu(state);

      case GameScreen.CHARACTER_SELECT:
        return this.handleCharacterSelect(state);

      case GameScreen.PLAYING:
        return this.handlePlaying(state);

      case GameScreen.UPGRADE_SELECT:
        return this.handleUpgradeSelect(state);

      case GameScreen.GAME_OVER:
      case GameScreen.RESULTS:
        return this.handleGameOver(state);

      case GameScreen.PAUSED:
        return this.handlePaused(state);

      case GameScreen.LOADING:
        return { type: ActionType.WAIT, reason: 'Game is loading' };

      case GameScreen.UNKNOWN:
      default:
        return { type: ActionType.WAIT, reason: `Unknown screen state: ${screen}` };
    }
  }

  private handleMainMenu(_state: GameState): GameAction {
    return {
      type: ActionType.START_GAME,
      reason: 'Starting game from main menu',
    };
  }

  private handleCharacterSelect(_state: GameState): GameAction {
    // For now, just try to start with whatever is selected
    return {
      type: ActionType.START_GAME,
      reason: 'Confirming character selection',
    };
  }

  private handlePlaying(state: GameState): GameAction {
    // Choose movement based on strategy
    const direction = this.calculateMovement(state);

    return {
      type: ActionType.MOVE,
      direction,
      reason: `Moving with strategy: ${this.config.movementStrategy}`,
    };
  }

  private handleUpgradeSelect(state: GameState): GameAction {
    const upgrades = state.upgrades?.value ?? [];

    if (upgrades.length === 0) {
      // Can't see upgrades, wait a moment
      return { type: ActionType.WAIT, reason: 'No upgrades visible yet' };
    }

    const selectedIndex = this.selectUpgrade(upgrades);

    return {
      type: ActionType.SELECT_UPGRADE,
      upgradeIndex: selectedIndex,
      reason: `Selecting upgrade: ${upgrades[selectedIndex]?.name ?? `option ${selectedIndex}`}`,
    };
  }

  private handleGameOver(_state: GameState): GameAction {
    return {
      type: ActionType.RESTART,
      reason: 'Game over, restarting',
    };
  }

  private handlePaused(_state: GameState): GameAction {
    return {
      type: ActionType.WAIT,
      reason: 'Game is paused',
    };
  }

  /**
   * Calculate movement direction based on the current strategy
   */
  private calculateMovement(state: GameState): MoveDirection {
    const now = Date.now();

    switch (this.config.movementStrategy) {
      case 'circle':
        return this.circleMovement(now);

      case 'kite':
        return this.kiteMovement(state, now);

      case 'random':
        return this.randomMovement(now);

      default:
        return this.kiteMovement(state, now);
    }
  }

  /**
   * Circle movement - move in a circular pattern
   */
  private circleMovement(now: number): MoveDirection {
    // Update angle smoothly
    if (now - this.lastMoveChange > this.moveChangeInterval) {
      this.moveAngle = (this.moveAngle + Math.PI / 4) % (Math.PI * 2);
      this.lastMoveChange = now;
    }

    return this.angleToDirection(this.moveAngle);
  }

  /**
   * Kite movement - try to avoid enemies while collecting XP
   */
  private kiteMovement(state: GameState, now: number): MoveDirection {
    // If we have enemy data, try to move away from nearest cluster
    if (state.enemies?.value && state.enemies.value.length > 0) {
      const player = state.player?.position?.value;
      if (player) {
        const nearestEnemy = this.findNearestEnemy(player, state.enemies.value);
        if (nearestEnemy) {
          // Move away from nearest enemy
          const dx = player.x - nearestEnemy.position.x;
          const dy = player.y - nearestEnemy.position.y;
          const angle = Math.atan2(dy, dx);
          return this.angleToDirection(angle);
        }
      }
    }

    // Fallback: circle movement with longer intervals
    if (now - this.lastMoveChange > this.moveChangeInterval * 1.5) {
      this.moveAngle = (this.moveAngle + Math.PI / 3) % (Math.PI * 2);
      this.lastMoveChange = now;
    }

    return this.angleToDirection(this.moveAngle);
  }

  /**
   * Random movement - change direction periodically
   */
  private randomMovement(now: number): MoveDirection {
    if (now - this.lastMoveChange > this.moveChangeInterval) {
      this.moveAngle = Math.random() * Math.PI * 2;
      this.lastMoveChange = now;
    }

    return this.angleToDirection(this.moveAngle);
  }

  /**
   * Convert an angle to discrete movement directions
   */
  private angleToDirection(angle: number): MoveDirection {
    // Normalize to positive
    const a = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

    return {
      right: a <= Math.PI / 4 || a >= (7 * Math.PI) / 4,
      down: a >= Math.PI / 4 && a <= (3 * Math.PI) / 4,
      left: a >= (3 * Math.PI) / 4 && a <= (5 * Math.PI) / 4,
      up: a >= (5 * Math.PI) / 4 && a <= (7 * Math.PI) / 4,
    };
  }

  /**
   * Find the nearest enemy to the player
   */
  private findNearestEnemy(
    player: { x: number; y: number },
    enemies: { position: { x: number; y: number } }[]
  ): { position: { x: number; y: number } } | null {
    let nearest = null;
    let minDist = Infinity;

    for (const enemy of enemies) {
      const dx = player.x - enemy.position.x;
      const dy = player.y - enemy.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        nearest = enemy;
      }
    }

    return nearest;
  }

  /**
   * Select the best upgrade based on configured priorities
   */
  private selectUpgrade(upgrades: UpgradeOption[]): number {
    if (upgrades.length === 0) return 0;

    // Check against priority list
    for (const priority of this.config.upgradePriorities) {
      const index = upgrades.findIndex(
        (u) =>
          u.name.toLowerCase().includes(priority.toLowerCase()) ||
          u.description.toLowerCase().includes(priority.toLowerCase())
      );
      if (index >= 0) return index;
    }

    // Prefer higher rarity if available
    const rarityOrder = ['legendary', 'epic', 'rare', 'uncommon', 'common'];
    for (const rarity of rarityOrder) {
      const index = upgrades.findIndex(
        (u) => u.rarity?.toLowerCase() === rarity
      );
      if (index >= 0) return index;
    }

    // Default: pick the first option
    return 0;
  }
}
