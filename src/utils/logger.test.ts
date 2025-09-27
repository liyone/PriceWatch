/**
 * Tests for logging utility
 */

import { Logger } from './logger';

// Mock console methods
const originalConsole = {
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error
};

let logOutput: { level: string; message: string }[] = [];

beforeEach(() => {
  logOutput = [];
  
  // Mock console methods to capture output
  console.debug = jest.fn((message: string) => {
    logOutput.push({ level: 'debug', message });
  });
  console.info = jest.fn((message: string) => {
    logOutput.push({ level: 'info', message });
  });
  console.warn = jest.fn((message: string) => {
    logOutput.push({ level: 'warn', message });
  });
  console.error = jest.fn((message: string) => {
    logOutput.push({ level: 'error', message });
  });
});

afterEach(() => {
  // Restore console methods
  console.debug = originalConsole.debug;
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
});

describe('Logger', () => {
  describe('log level filtering', () => {
    test('should only log messages at or above the set log level', () => {
      const logger = new Logger('warn', false);
      
      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');
      
      expect(logOutput).toHaveLength(2);
      expect(logOutput[0]).toEqual({ level: 'warn', message: 'WARN  warn message' });
      expect(logOutput[1]).toEqual({ level: 'error', message: 'ERROR error message' });
    });

    test('should log all messages when level is debug', () => {
      const logger = new Logger('debug', false);
      
      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');
      
      expect(logOutput).toHaveLength(4);
    });
  });

  describe('message formatting', () => {
    test('should include timestamp when enabled', () => {
      const logger = new Logger('info', true);
      
      logger.info('test message');
      
      expect(logOutput[0].message).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] INFO  test message$/);
    });

    test('should not include timestamp when disabled', () => {
      const logger = new Logger('info', false);
      
      logger.info('test message');
      
      expect(logOutput[0].message).toBe('INFO  test message');
    });

    test('should include metadata when provided', () => {
      const logger = new Logger('info', false);
      
      logger.info('test message', { key: 'value', count: 42 });
      
      expect(logOutput[0].message).toBe('INFO  test message {"key":"value","count":42}');
    });
  });

  describe('specialized logging methods', () => {
    test('scrapingStart should log with correct metadata', () => {
      const logger = new Logger('info', false);
      
      logger.scrapingStart('petsmart', 5);
      
      expect(logOutput[0].message).toContain('Starting scrape operation');
      expect(logOutput[0].message).toContain('"retailer":"petsmart"');
      expect(logOutput[0].message).toContain('"productCount":5');
      expect(logOutput[0].message).toContain('"operation":"scraping_start"');
    });

    test('scrapingComplete should log with correct metadata', () => {
      const logger = new Logger('info', false);
      
      logger.scrapingComplete('petvalu', 8, 2, 1500);
      
      expect(logOutput[0].message).toContain('Scraping completed');
      expect(logOutput[0].message).toContain('"retailer":"petvalu"');
      expect(logOutput[0].message).toContain('"successCount":8');
      expect(logOutput[0].message).toContain('"errorCount":2');
      expect(logOutput[0].message).toContain('"durationMs":1500');
    });

    test('productExtracted should log with correct metadata', () => {
      const logger = new Logger('debug', false);
      
      logger.productExtracted('shoppers', 'https://example.com/product', 29.99);
      
      expect(logOutput[0].message).toContain('Product extracted');
      expect(logOutput[0].message).toContain('"retailer":"shoppers"');
      expect(logOutput[0].message).toContain('"price":29.99');
    });

    test('alertSent should log with correct metadata', () => {
      const logger = new Logger('info', false);
      
      logger.alertSent('discord', 'Test Product', 25);
      
      expect(logOutput[0].message).toContain('Alert sent');
      expect(logOutput[0].message).toContain('"alertType":"discord"');
      expect(logOutput[0].message).toContain('"productTitle":"Test Product"');
      expect(logOutput[0].message).toContain('"discount":25');
    });
  });

  describe('log level management', () => {
    test('should allow changing log level dynamically', () => {
      const logger = new Logger('info', false);
      
      logger.debug('should not appear');
      expect(logOutput).toHaveLength(0);
      
      logger.setLogLevel('debug');
      expect(logOutput).toHaveLength(1); // Log level change message
      
      logger.debug('should appear now');
      expect(logOutput).toHaveLength(2);
      expect(logOutput[1].message).toContain('should appear now');
    });

    test('should return current log level', () => {
      const logger = new Logger('warn');
      
      expect(logger.getLogLevel()).toBe('warn');
      
      logger.setLogLevel('debug');
      expect(logger.getLogLevel()).toBe('debug');
    });
  });
});
