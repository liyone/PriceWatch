/**
 * History manager to track seen items and prevent duplicate alerts
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

export class HistoryManager {
  private historyFile: string;
  private seenIds: Set<string>;
  private isDirty: boolean = false;

  constructor(dataDir: string = 'data') {
    this.historyFile = path.join(dataDir, 'history.json');
    this.seenIds = new Set();
    this.load();
  }

  /**
   * Load history from file
   */
  private load(): void {
    try {
      if (fs.existsSync(this.historyFile)) {
        const data = fs.readFileSync(this.historyFile, 'utf8');
        const json = JSON.parse(data);
        if (Array.isArray(json)) {
          this.seenIds = new Set(json);
          logger.debug(`Loaded ${this.seenIds.size} items from history`);
        }
      }
    } catch (error) {
      logger.warn('Failed to load history file', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Save history to file
   */
  save(): void {
    if (!this.isDirty) return;

    try {
      const data = JSON.stringify(Array.from(this.seenIds));
      fs.writeFileSync(this.historyFile, data, 'utf8');
      this.isDirty = false;
      logger.debug(`Saved ${this.seenIds.size} items to history`);
    } catch (error) {
      logger.error('Failed to save history file', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Check if an item has been seen before
   */
  hasSeen(id: string): boolean {
    return this.seenIds.has(id);
  }

  /**
   * Mark an item as seen
   */
  markSeen(id: string): void {
    if (!this.seenIds.has(id)) {
      this.seenIds.add(id);
      this.isDirty = true;
    }
  }

  /**
   * Get total count of seen items
   */
  getCount(): number {
    return this.seenIds.size;
  }
}
