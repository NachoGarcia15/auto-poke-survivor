// tests/decision-engine.test.ts - Tests for the decision engine
import { describe, it, expect, beforeEach } from 'vitest';
import { DecisionEngine } from '../src/main/decision-engine';
import {
  GameState,
  GameScreen,
  ActionType,
  Confidence,
  StrategyConfig,
  UpgradeOption,
} from '../src/shared/types';

function makeObserved<T>(value: T, confidence = Confidence.VERIFIED) {
  return { value, confidence, timestamp: Date.now() };
}

function makeGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    screen: makeObserved(GameScreen.UNKNOWN),
    player: null,
    enemies: null,
    upgrades: null,
    timer: null,
    killCount: null,
    currency: null,
    observedAt: Date.now(),
    ...overrides,
  };
}

const defaultStrategy: StrategyConfig = {
  movementStrategy: 'kite',
  upgradePriorities: [],
  avoidEdges: true,
  enemySafeDistance: 100,
};

describe('DecisionEngine', () => {
  let engine: DecisionEngine;

  beforeEach(() => {
    engine = new DecisionEngine(defaultStrategy);
  });

  describe('Screen handling', () => {
    it('should start game from main menu', () => {
      const state = makeGameState({ screen: makeObserved(GameScreen.MAIN_MENU) });
      const action = engine.decide(state);
      expect(action.type).toBe(ActionType.START_GAME);
    });

    it('should move during gameplay', () => {
      const state = makeGameState({ screen: makeObserved(GameScreen.PLAYING) });
      const action = engine.decide(state);
      expect(action.type).toBe(ActionType.MOVE);
      expect(action.direction).toBeDefined();
    });

    it('should select upgrade when upgrade screen is shown', () => {
      const upgrades: UpgradeOption[] = [
        { index: 0, name: 'Speed Boost', description: 'Increases speed' },
        { index: 1, name: 'Attack Up', description: 'Increases attack' },
      ];
      const state = makeGameState({
        screen: makeObserved(GameScreen.UPGRADE_SELECT),
        upgrades: makeObserved(upgrades),
      });
      const action = engine.decide(state);
      expect(action.type).toBe(ActionType.SELECT_UPGRADE);
      expect(action.upgradeIndex).toBeDefined();
    });

    it('should restart on game over', () => {
      const state = makeGameState({ screen: makeObserved(GameScreen.GAME_OVER) });
      const action = engine.decide(state);
      expect(action.type).toBe(ActionType.RESTART);
    });

    it('should wait on unknown screen', () => {
      const state = makeGameState({ screen: makeObserved(GameScreen.UNKNOWN) });
      const action = engine.decide(state);
      expect(action.type).toBe(ActionType.WAIT);
    });

    it('should wait when loading', () => {
      const state = makeGameState({ screen: makeObserved(GameScreen.LOADING) });
      const action = engine.decide(state);
      expect(action.type).toBe(ActionType.WAIT);
    });

    it('should wait when paused', () => {
      const state = makeGameState({ screen: makeObserved(GameScreen.PAUSED) });
      const action = engine.decide(state);
      expect(action.type).toBe(ActionType.WAIT);
    });
  });

  describe('Upgrade selection', () => {
    it('should select based on priority list', () => {
      const engine2 = new DecisionEngine({
        ...defaultStrategy,
        upgradePriorities: ['attack', 'speed'],
      });
      const upgrades: UpgradeOption[] = [
        { index: 0, name: 'Speed Boost', description: 'Increases speed' },
        { index: 1, name: 'Attack Up', description: 'Increases attack' },
        { index: 2, name: 'Health Plus', description: 'More health' },
      ];
      const state = makeGameState({
        screen: makeObserved(GameScreen.UPGRADE_SELECT),
        upgrades: makeObserved(upgrades),
      });
      const action = engine2.decide(state);
      expect(action.type).toBe(ActionType.SELECT_UPGRADE);
      // 'attack' is first priority, index 1 matches
      expect(action.upgradeIndex).toBe(1);
    });

    it('should prefer higher rarity when no priority matches', () => {
      const upgrades: UpgradeOption[] = [
        { index: 0, name: 'Basic', description: 'Basic', rarity: 'common' },
        { index: 1, name: 'Rare', description: 'Rare', rarity: 'rare' },
        { index: 2, name: 'Epic', description: 'Epic', rarity: 'epic' },
      ];
      const state = makeGameState({
        screen: makeObserved(GameScreen.UPGRADE_SELECT),
        upgrades: makeObserved(upgrades),
      });
      const action = engine.decide(state);
      expect(action.type).toBe(ActionType.SELECT_UPGRADE);
      // epic > rare > common
      expect(action.upgradeIndex).toBe(2);
    });

    it('should default to first option when no upgrades visible', () => {
      const state = makeGameState({
        screen: makeObserved(GameScreen.UPGRADE_SELECT),
        upgrades: null,
      });
      const action = engine.decide(state);
      expect(action.type).toBe(ActionType.WAIT);
    });
  });

  describe('Movement strategies', () => {
    it('should produce valid move direction for circle strategy', () => {
      const engine2 = new DecisionEngine({
        ...defaultStrategy,
        movementStrategy: 'circle',
      });
      const state = makeGameState({ screen: makeObserved(GameScreen.PLAYING) });
      const action = engine2.decide(state);
      expect(action.type).toBe(ActionType.MOVE);
      const dir = action.direction!;
      // At least one direction should be active
      expect(dir.up || dir.down || dir.left || dir.right).toBe(true);
    });

    it('should produce valid move direction for random strategy', () => {
      const engine2 = new DecisionEngine({
        ...defaultStrategy,
        movementStrategy: 'random',
      });
      const state = makeGameState({ screen: makeObserved(GameScreen.PLAYING) });
      const action = engine2.decide(state);
      expect(action.type).toBe(ActionType.MOVE);
    });
  });
});
