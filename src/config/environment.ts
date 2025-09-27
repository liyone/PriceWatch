/**
 * Environment configuration and validation
 */

import { logger } from '../utils/logger';

export interface EnvironmentConfig {
  // Core settings
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  nodeEnv: 'development' | 'production' | 'test';
  
  // Alert settings
  discordWebhook?: string;
  alertMinPercent: number;
  testMode: boolean;
  
  // Scraper settings
  enabledRetailers: string[];
  
  // GitHub context (for Actions)
  github?: {
    runId?: string;
    runNumber?: string;
    ref?: string;
    sha?: string;
    repository?: string;
    actor?: string;
  };
}

/**
 * Load and validate environment configuration
 */
export function loadEnvironmentConfig(): EnvironmentConfig {
  const config: EnvironmentConfig = {
    // Core settings
    logLevel: (process.env.LOG_LEVEL as any) || 'info',
    nodeEnv: (process.env.NODE_ENV as any) || 'development',
    
    // Alert settings
    discordWebhook: process.env.DISCORD_WEBHOOK,
    alertMinPercent: parseInt(process.env.ALERT_MIN_PERCENT || '20', 10),
    testMode: process.env.TEST_MODE === 'true',
    
    // Scraper settings
    enabledRetailers: parseEnabledRetailers(process.env.ENABLED_RETAILERS),
    
    // GitHub context
    github: process.env.GITHUB_RUN_ID ? {
      runId: process.env.GITHUB_RUN_ID,
      runNumber: process.env.GITHUB_RUN_NUMBER,
      ref: process.env.GITHUB_REF,
      sha: process.env.GITHUB_SHA,
      repository: process.env.GITHUB_REPOSITORY,
      actor: process.env.GITHUB_ACTOR,
    } : undefined
  };
  
  // Validate configuration
  validateEnvironmentConfig(config);
  
  logger.configLoaded('environment', Object.keys(config).length);
  
  return config;
}

/**
 * Parse enabled retailers from environment variable
 */
function parseEnabledRetailers(retailersEnv?: string): string[] {
  if (!retailersEnv || retailersEnv === 'all') {
    return ['petsmart', 'petvalu', 'shoppers'];
  }
  
  return retailersEnv
    .split(',')
    .map(r => r.trim().toLowerCase())
    .filter(r => ['petsmart', 'petvalu', 'shoppers'].includes(r));
}

/**
 * Validate environment configuration
 */
function validateEnvironmentConfig(config: EnvironmentConfig): void {
  const errors: string[] = [];
  
  // Validate log level
  if (!['debug', 'info', 'warn', 'error'].includes(config.logLevel)) {
    errors.push(`Invalid log level: ${config.logLevel}`);
  }
  
  // Validate node environment
  if (!['development', 'production', 'test'].includes(config.nodeEnv)) {
    errors.push(`Invalid NODE_ENV: ${config.nodeEnv}`);
  }
  
  // Validate alert threshold
  if (isNaN(config.alertMinPercent) || config.alertMinPercent < 0 || config.alertMinPercent > 100) {
    errors.push(`Invalid alert minimum percentage: ${config.alertMinPercent}. Must be 0-100.`);
  }
  
  // Validate Discord webhook format (if provided)
  if (config.discordWebhook && !config.discordWebhook.includes('discord.com/api/webhooks/')) {
    errors.push('Invalid Discord webhook URL format');
  }
  
  // Validate enabled retailers
  if (config.enabledRetailers.length === 0) {
    errors.push('No valid retailers enabled');
  }
  
  if (errors.length > 0) {
    const errorMessage = `Environment configuration validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }
  
  // Log configuration summary
  logger.info('Environment configuration loaded', {
    logLevel: config.logLevel,
    nodeEnv: config.nodeEnv,
    alertMinPercent: config.alertMinPercent,
    testMode: config.testMode,
    enabledRetailers: config.enabledRetailers,
    hasDiscordWebhook: !!config.discordWebhook,
    isGitHubActions: !!config.github
  });
}

/**
 * Check if running in GitHub Actions
 */
export function isGitHubActions(): boolean {
  return !!process.env.GITHUB_ACTIONS;
}

/**
 * Check if running in test mode
 */
export function isTestMode(): boolean {
  return process.env.NODE_ENV === 'test' || process.env.TEST_MODE === 'true';
}

/**
 * Get timezone for scheduling info
 */
export function getTimezone(): string {
  return process.env.TZ || 'UTC';
}
