/**
 * Structured logging utility for debugging and monitoring
 */

import { LogLevel, LogEntry } from '../types';

export class Logger {
  private logLevel: LogLevel;
  private includeTimestamp: boolean;
  
  constructor(logLevel: LogLevel = 'info', includeTimestamp: boolean = true) {
    this.logLevel = logLevel;
    this.includeTimestamp = includeTimestamp;
  }

  /**
   * Log levels in order of severity (lowest to highest)
   */
  private static readonly LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };

  /**
   * Check if a log level should be output based on current log level
   */
  private shouldLog(level: LogLevel): boolean {
    return Logger.LOG_LEVELS[level] >= Logger.LOG_LEVELS[this.logLevel];
  }

  /**
   * Format log entry for console output
   */
  private formatLogEntry(entry: LogEntry): string {
    const timestamp = this.includeTimestamp ? `[${entry.timestamp}] ` : '';
    const level = entry.level.toUpperCase().padEnd(5);
    const metadata = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : '';
    
    return `${timestamp}${level} ${entry.message}${metadata}`;
  }

  /**
   * Create a log entry object
   */
  private createLogEntry(level: LogLevel, message: string, metadata?: Record<string, any>): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      metadata
    };
  }

  /**
   * Generic log method
   */
  private log(level: LogLevel, message: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry = this.createLogEntry(level, message, metadata);
    const formattedMessage = this.formatLogEntry(entry);

    // Output to appropriate console method based on level
    switch (level) {
      case 'debug':
        console.debug(formattedMessage);
        break;
      case 'info':
        console.info(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      case 'error':
        console.error(formattedMessage);
        break;
    }
  }

  /**
   * Log debug message (detailed information for troubleshooting)
   */
  debug(message: string, metadata?: Record<string, any>): void {
    this.log('debug', message, metadata);
  }

  /**
   * Log info message (general information about operation)
   */
  info(message: string, metadata?: Record<string, any>): void {
    this.log('info', message, metadata);
  }

  /**
   * Log warning message (something unexpected but not critical)
   */
  warn(message: string, metadata?: Record<string, any>): void {
    this.log('warn', message, metadata);
  }

  /**
   * Log error message (something went wrong)
   */
  error(message: string, metadata?: Record<string, any>): void {
    this.log('error', message, metadata);
  }

  /**
   * Log scraping operation start
   */
  scrapingStart(retailer: string, productCount: number): void {
    this.info(`Starting scrape operation`, {
      retailer,
      productCount,
      operation: 'scraping_start'
    });
  }

  /**
   * Log scraping operation completion
   */
  scrapingComplete(retailer: string, successCount: number, errorCount: number, durationMs: number): void {
    this.info(`Scraping completed`, {
      retailer,
      successCount,
      errorCount,
      durationMs,
      operation: 'scraping_complete'
    });
  }

  /**
   * Log product extraction success
   */
  productExtracted(retailer: string, productUrl: string, price?: number): void {
    this.debug(`Product extracted`, {
      retailer,
      productUrl,
      price,
      operation: 'product_extracted'
    });
  }

  /**
   * Log product extraction failure
   */
  productExtractionFailed(retailer: string, productUrl: string, error: string): void {
    this.warn(`Product extraction failed`, {
      retailer,
      productUrl,
      error,
      operation: 'product_extraction_failed'
    });
  }

  /**
   * Log CSV operation
   */
  csvOperation(operation: 'write' | 'read', filename: string, recordCount: number): void {
    this.info(`CSV ${operation} operation`, {
      operation: `csv_${operation}`,
      filename,
      recordCount
    });
  }

  /**
   * Log alert sent
   */
  alertSent(alertType: 'discord' | 'email', productTitle: string, discount: number): void {
    this.info(`Alert sent`, {
      alertType,
      productTitle,
      discount,
      operation: 'alert_sent'
    });
  }

  /**
   * Log configuration loaded
   */
  configLoaded(configType: string, itemCount: number): void {
    this.debug(`Configuration loaded`, {
      configType,
      itemCount,
      operation: 'config_loaded'
    });
  }

  /**
   * Log GitHub Actions specific information
   */
  githubAction(event: string, details?: Record<string, any>): void {
    this.info(`GitHub Action: ${event}`, {
      ...details,
      operation: 'github_action',
      event
    });
  }

  /**
   * Set log level dynamically
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
    this.info(`Log level changed to ${level}`);
  }

  /**
   * Get current log level
   */
  getLogLevel(): LogLevel {
    return this.logLevel;
  }
}

// Default logger instance
export const logger = new Logger(
  (process.env.LOG_LEVEL as LogLevel) || 'info',
  true
);

// Convenience functions using default logger
export const debug = (message: string, metadata?: Record<string, any>) => 
  logger.debug(message, metadata);

export const info = (message: string, metadata?: Record<string, any>) => 
  logger.info(message, metadata);

export const warn = (message: string, metadata?: Record<string, any>) => 
  logger.warn(message, metadata);

export const error = (message: string, metadata?: Record<string, any>) => 
  logger.error(message, metadata);

export default logger;
