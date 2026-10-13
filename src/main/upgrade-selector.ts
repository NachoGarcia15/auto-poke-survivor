// src/main/upgrade-selector.ts - Dedicated module for prioritizing and choosing upgrade cards
import { UpgradeOption, StrategyConfig } from '../shared/types';
import { logger } from './logger';

export interface UpgradeChoice {
  index: number;
  reason: string;
  cardName: string;
}

export class UpgradeSelector {
  private config: StrategyConfig;

  // High-value evolutions and essential passives derived from game data
  private defaultHighPriority = [
    'evo',         // Guaranteed evolutions
    'síntesis',    // Health regen (vital for survival)
    'vigor',       // Max HP
    'coraza',      // Defense
    'imán',        // Magnet (XP gathering efficiency)
    'aprendizaje', // Bonus XP
    'potencia',    // Damage scaling
    'reflejos',    // Cooldown reduction
    'carrera',     // Move speed
  ];

  constructor(config: StrategyConfig) {
    this.config = config;
  }

  updateConfig(config: StrategyConfig): void {
    this.config = config;
  }

  /**
   * Selects the highest priority upgrade among the available options
   */
  select(options: UpgradeOption[]): UpgradeChoice {
    if (!options || options.length === 0) {
      return { index: 0, reason: 'Default fallback (empty options)', cardName: 'Unknown' };
    }

    const priorities = this.config.upgradePriorities.length > 0
      ? this.config.upgradePriorities
      : this.defaultHighPriority;

    // 1. Check user/preset priorities
    for (const priority of priorities) {
      const matchIndex = options.findIndex((opt) => {
        const name = (opt.name || '').toLowerCase();
        const desc = (opt.description || '').toLowerCase();
        const prio = priority.toLowerCase();
        return name.includes(prio) || desc.includes(prio);
      });

      if (matchIndex >= 0) {
        const chosen = options[matchIndex];
        return {
          index: matchIndex,
          reason: `Matched priority keyword '${priority}'`,
          cardName: chosen.name,
        };
      }
    }

    // 2. Fall back to rarity hierarchy (Legendary > Epic > Rare > Uncommon > Common)
    const rarityTiers = ['legendary', 'epic', 'rare', 'uncommon', 'common'];
    for (const rarity of rarityTiers) {
      const matchIndex = options.findIndex(
        (opt) => (opt.rarity || '').toLowerCase() === rarity
      );
      if (matchIndex >= 0) {
        const chosen = options[matchIndex];
        return {
          index: matchIndex,
          reason: `Highest available rarity tier '${rarity}'`,
          cardName: chosen.name,
        };
      }
    }

    // 3. Fallback to first available option
    const first = options[0];
    return {
      index: 0,
      reason: 'First available card fallback',
      cardName: first.name,
    };
  }
}
