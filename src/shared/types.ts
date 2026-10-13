// src/shared/types.ts - Core type definitions for AutoPokeSurvivor

/**
 * Possible game screen states
 */
export enum GameScreen {
  UNKNOWN = 'unknown',
  LOADING = 'loading',
  MAIN_MENU = 'main_menu',
  CHARACTER_SELECT = 'character_select',
  PLAYING = 'playing',
  UPGRADE_SELECT = 'upgrade_select',
  PAUSED = 'paused',
  GAME_OVER = 'game_over',
  RESULTS = 'results',
  ERROR = 'error',
}

/**
 * Confidence level for observed values
 */
export enum Confidence {
  VERIFIED = 'verified',
  ESTIMATED = 'estimated',
  UNKNOWN = 'unknown',
}

/**
 * An observed value with confidence tracking
 */
export interface ObservedValue<T> {
  value: T;
  confidence: Confidence;
  timestamp: number;
}

/**
 * Position in 2D space
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Player state as observed from the game
 */
export interface PlayerState {
  position: ObservedValue<Position> | null;
  health: ObservedValue<number> | null;
  maxHealth: ObservedValue<number> | null;
  level: ObservedValue<number> | null;
  experience: ObservedValue<number> | null;
  experienceToNext: ObservedValue<number> | null;
}

/**
 * Enemy information
 */
export interface EnemyInfo {
  position: Position;
  type?: string;
  health?: number;
}

/**
 * Available upgrade option
 */
export interface UpgradeOption {
  index: number;
  name: string;
  description: string;
  level?: number;
  rarity?: string;
}

/**
 * Complete game state snapshot
 */
export interface GameState {
  screen: ObservedValue<GameScreen>;
  player: PlayerState | null;
  enemies: ObservedValue<EnemyInfo[]> | null;
  upgrades: ObservedValue<UpgradeOption[]> | null;
  timer: ObservedValue<number> | null;
  killCount: ObservedValue<number> | null;
  currency: ObservedValue<number> | null;
  /** Raw observation timestamp */
  observedAt: number;
}

/**
 * Actions the bot can perform
 */
export enum ActionType {
  NONE = 'none',
  MOVE = 'move',
  CLICK = 'click',
  SELECT_UPGRADE = 'select_upgrade',
  START_GAME = 'start_game',
  RESTART = 'restart',
  PAUSE = 'pause',
  WAIT = 'wait',
}

/**
 * Movement direction
 */
export interface MoveDirection {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

/**
 * An action to be executed
 */
export interface GameAction {
  type: ActionType;
  direction?: MoveDirection;
  clickPosition?: Position;
  upgradeIndex?: number;
  reason: string;
}

/**
 * Automation state
 */
export enum AutomationState {
  STOPPED = 'stopped',
  STARTING = 'starting',
  RUNNING = 'running',
  PAUSING = 'pausing',
  ERROR = 'error',
}

/**
 * Run record for statistics
 */
export interface RunRecord {
  id: string;
  startTime: number;
  endTime: number | null;
  duration: number | null;
  result: 'completed' | 'died' | 'stopped' | 'error' | 'unknown';
  character?: string;
  upgrades: string[];
  killCount: number | null;
  currencyBefore: number | null;
  currencyAfter: number | null;
  currencyEarned: number | null;
  maxLevel: number | null;
  maxTimer: number | null;
  errors: string[];
  manualInterventions: number;
  progressionConfirmed: boolean;
}

/**
 * Application configuration
 */
export interface AppConfig {
  gameUrl: string;
  automation: AutomationConfig;
  strategy: StrategyConfig;
  display: DisplayConfig;
}

export interface AutomationConfig {
  /** ms between observation cycles */
  observationInterval: number;
  /** ms between actions */
  actionInterval: number;
  /** Max consecutive errors before stopping */
  maxConsecutiveErrors: number;
  /** Auto-restart after game over */
  autoRestart: boolean;
  /** Max runs before stopping (0 = unlimited) */
  maxRuns: number;
  /** Timeout for stalled game detection (ms) */
  stallTimeout: number;
}

export interface StrategyConfig {
  /** Movement strategy: 'circle', 'kite', 'random' */
  movementStrategy: string;
  /** Upgrade priority list (names or patterns) */
  upgradePriorities: string[];
  /** Whether to avoid edges */
  avoidEdges: boolean;
  /** Minimum safe distance from enemies */
  enemySafeDistance: number;
}

export interface DisplayConfig {
  windowWidth: number;
  windowHeight: number;
  showDevTools: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: AppConfig = {
  gameUrl: 'https://pokesurvivor.com/',
  automation: {
    observationInterval: 200,
    actionInterval: 100,
    maxConsecutiveErrors: 10,
    autoRestart: true,
    maxRuns: 0,
    stallTimeout: 30000,
  },
  strategy: {
    movementStrategy: 'kite',
    upgradePriorities: [],
    avoidEdges: true,
    enemySafeDistance: 100,
  },
  display: {
    windowWidth: 1280,
    windowHeight: 800,
    showDevTools: false,
  },
};

/**
 * IPC channel names for secure preload bridge
 */
export const IPC_CHANNELS = {
  // Renderer -> Main
  GET_CONFIG: 'get-config',
  SAVE_CONFIG: 'save-config',
  START_AUTOMATION: 'start-automation',
  STOP_AUTOMATION: 'stop-automation',
  GET_STATS: 'get-stats',
  GET_RUNS: 'get-runs',
  GET_GAME_STATE: 'get-game-state',
  CLEAR_RUNS: 'clear-runs',

  // Main -> Renderer
  AUTOMATION_STATE_CHANGED: 'automation-state-changed',
  GAME_STATE_UPDATED: 'game-state-updated',
  LOG_EVENT: 'log-event',
  RUN_COMPLETED: 'run-completed',
  ERROR: 'error',
} as const;

/**
 * Log event for the UI
 */
export interface LogEvent {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: unknown;
}

/**
 * Statistics summary
 */
export interface StatsSummary {
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  averageDuration: number | null;
  bestDuration: number | null;
  totalCurrencyEarned: number | null;
  currencyPerHour: number | null;
  averageKills: number | null;
  averageLevel: number | null;
  totalPlayTime: number;
  lastRunAt: number | null;
}
