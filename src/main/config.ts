// src/main/config.ts - Configuration manager
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { AppConfig, DEFAULT_CONFIG } from '../shared/types';

const CONFIG_FILENAME = 'config.json';

export class ConfigManager {
  private config: AppConfig;
  private configPath: string;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.configPath = path.join(userDataPath, CONFIG_FILENAME);
    this.config = this.load();
  }

  private load(): AppConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        const loaded = JSON.parse(raw);
        // Deep merge with defaults to ensure all fields exist
        return this.mergeDefaults(loaded);
      }
    } catch (err) {
      console.error('Failed to load config, using defaults:', err);
    }
    return { ...DEFAULT_CONFIG };
  }

  private mergeDefaults(loaded: Partial<AppConfig>): AppConfig {
    return {
      gameUrl: loaded.gameUrl ?? DEFAULT_CONFIG.gameUrl,
      automation: {
        ...DEFAULT_CONFIG.automation,
        ...(loaded.automation ?? {}),
      },
      strategy: {
        ...DEFAULT_CONFIG.strategy,
        ...(loaded.strategy ?? {}),
      },
      display: {
        ...DEFAULT_CONFIG.display,
        ...(loaded.display ?? {}),
      },
    };
  }

  get(): AppConfig {
    return { ...this.config };
  }

  save(updates: Partial<AppConfig>): AppConfig {
    this.config = this.mergeDefaults({ ...this.config, ...updates });
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save config:', err);
    }
    return this.get();
  }
}
