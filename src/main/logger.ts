// src/main/logger.ts - Centralized logging with event emission
import { BrowserWindow } from 'electron';
import { IPC_CHANNELS, LogEvent } from '../shared/types';

export class Logger {
  private mainWindow: BrowserWindow | null = null;
  private logs: LogEvent[] = [];
  private maxLogs = 1000;

  setWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  private emit(level: LogEvent['level'], message: string, data?: unknown): void {
    const event: LogEvent = {
      timestamp: Date.now(),
      level,
      message,
      data,
    };

    this.logs.push(event);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Log to console
    const prefix = `[AutoPoke][${level.toUpperCase()}]`;
    if (level === 'error') {
      console.error(prefix, message, data ?? '');
    } else if (level === 'warn') {
      console.warn(prefix, message, data ?? '');
    } else {
      console.log(prefix, message, data ?? '');
    }

    // Send to renderer if window exists
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      try {
        this.mainWindow.webContents.send(IPC_CHANNELS.LOG_EVENT, event);
      } catch {
        // Window may be closing
      }
    }
  }

  info(message: string, data?: unknown): void {
    this.emit('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.emit('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    this.emit('error', message, data);
  }

  debug(message: string, data?: unknown): void {
    this.emit('debug', message, data);
  }

  getLogs(limit?: number): LogEvent[] {
    if (limit) {
      return this.logs.slice(-limit);
    }
    return [...this.logs];
  }
}

// Singleton logger
export const logger = new Logger();
