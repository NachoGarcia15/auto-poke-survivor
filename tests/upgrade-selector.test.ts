// tests/upgrade-selector.test.ts - Unit tests for UpgradeSelector
import { describe, it, expect, beforeEach } from 'vitest';
import { UpgradeSelector } from '../src/main/upgrade-selector';
import { StrategyConfig, UpgradeOption } from '../src/shared/types';

describe('UpgradeSelector', () => {
  let selector: UpgradeSelector;
  const mockConfig: StrategyConfig = {
    movementStrategy: 'kite',
    upgradePriorities: [],
    avoidEdges: true,
    enemySafeDistance: 100,
  };

  beforeEach(() => {
    selector = new UpgradeSelector(mockConfig);
  });

  it('should fall back gracefully on empty options', () => {
    const choice = selector.select([]);
    expect(choice.index).toBe(0);
    expect(choice.cardName).toBe('Unknown');
  });

  it('should pick evolution upgrade by default when present', () => {
    const options: UpgradeOption[] = [
      { index: 0, name: 'Normal Hit', description: 'Small damage', rarity: 'common' },
      { index: 1, name: 'Fire Blast', description: 'Evo from Ember', rarity: 'legendary' },
      { index: 2, name: 'Speed Up', description: 'Increases speed', rarity: 'common' },
    ];

    const choice = selector.select(options);
    expect(choice.index).toBe(1);
    expect(choice.cardName).toBe('Fire Blast');
    expect(choice.reason).toContain('evo');
  });

  it('should match user custom priority keyword over default priority', () => {
    selector.updateConfig({
      ...mockConfig,
      upgradePriorities: ['thunder', 'flame'],
    });

    const options: UpgradeOption[] = [
      { index: 0, name: 'Síntesis', description: 'HP regen', rarity: 'rare' },
      { index: 1, name: 'Thunder Wave', description: 'Electric beam', rarity: 'uncommon' },
      { index: 2, name: 'Vigor', description: 'Extra HP', rarity: 'rare' },
    ];

    const choice = selector.select(options);
    expect(choice.index).toBe(1);
    expect(choice.cardName).toBe('Thunder Wave');
    expect(choice.reason).toContain('thunder');
  });

  it('should select higher rarity tier when no keywords match', () => {
    selector.updateConfig({
      ...mockConfig,
      upgradePriorities: ['nonexistent_keyword'],
    });

    const options: UpgradeOption[] = [
      { index: 0, name: 'Basic Rock', description: 'Damage', rarity: 'common' },
      { index: 1, name: 'Ancient Stone', description: 'Damage', rarity: 'epic' },
      { index: 2, name: 'Normal Leaf', description: 'Damage', rarity: 'uncommon' },
    ];

    const choice = selector.select(options);
    expect(choice.index).toBe(1);
    expect(choice.cardName).toBe('Ancient Stone');
    expect(choice.reason).toContain('epic');
  });
});
