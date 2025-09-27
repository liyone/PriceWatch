/**
 * Configuration loader for products and scraping settings
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { ScrapingConfig, ProductConfig, RetailerConfig } from '../types';
import { getSiteConfig } from './site-selectors';
import { logger } from '../utils/logger';

/**
 * Load configuration from YAML file
 */
export function loadConfig(configPath: string = 'src/config/products.yaml'): ScrapingConfig {
  try {
    logger.debug('Loading configuration from YAML file', { configPath });
    
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }

    const fileContents = fs.readFileSync(configPath, 'utf8');
    const rawConfig = yaml.load(fileContents) as any;

    // Validate and transform the configuration
    const config: ScrapingConfig = {
      retailers: {
        petsmart: createRetailerConfig('petsmart', rawConfig.retailers?.petsmart),
        petvalu: createRetailerConfig('petvalu', rawConfig.retailers?.petvalu),
        shoppers: createRetailerConfig('shoppers', rawConfig.retailers?.shoppers)
      },
      alerts: {
        min_discount_percent: rawConfig.alerts?.min_discount_percent || 20,
        discord_webhook: process.env.DISCORD_WEBHOOK,
        discord_enabled: rawConfig.alerts?.discord_enabled || false,
        deduplication_hours: rawConfig.alerts?.deduplication_hours || 24
      },
      output: {
        data_directory: rawConfig.output?.data_directory || 'data',
        git_commit: rawConfig.output?.git_commit || false
      }
    };

    // Log configuration summary
    const enabledRetailers = Object.entries(config.retailers)
      .filter(([_, retailerConfig]) => retailerConfig.enabled)
      .map(([name, _]) => name);
    
    const totalProducts = Object.values(config.retailers)
      .reduce((total, retailer) => total + (retailer.enabled ? retailer.products.length : 0), 0);

    logger.configLoaded('products', totalProducts);
    logger.info('Configuration loaded successfully', {
      enabledRetailers,
      totalProducts,
      alertThreshold: config.alerts.min_discount_percent,
      discordEnabled: config.alerts.discord_enabled
    });

    return config;

  } catch (error) {
    const errorMessage = `Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Create retailer configuration with validation
 */
function createRetailerConfig(
  retailerName: 'petsmart' | 'petvalu' | 'shoppers',
  rawRetailerConfig: any
): RetailerConfig {
  const siteConfig = getSiteConfig(retailerName);
  
  return {
    config: siteConfig,
    products: (rawRetailerConfig?.products || []).map((product: any) => ({
      url: product.url,
      category_url: product.category_url,
      name: product.name || 'Unnamed Product',
      brand_filter: product.brand_filter,
      size_filter: product.size_filter,
      alert_threshold: product.alert_threshold || 20
    })),
    enabled: rawRetailerConfig?.enabled || false
  };
}

/**
 * Get all product URLs that need to be scraped for a retailer
 */
export function getProductUrlsForRetailer(
  retailerConfig: RetailerConfig
): string[] {
  const urls: string[] = [];
  
  for (const product of retailerConfig.products) {
    if (product.url) {
      urls.push(product.url);
    } else if (product.category_url) {
      urls.push(product.category_url);
    }
  }
  
  return urls;
}

/**
 * Get enabled retailers from configuration
 */
export function getEnabledRetailers(config: ScrapingConfig): Array<{
  name: 'petsmart' | 'petvalu' | 'shoppers';
  config: RetailerConfig;
}> {
  const enabled: Array<{ name: 'petsmart' | 'petvalu' | 'shoppers'; config: RetailerConfig }> = [];
  
  for (const [name, retailerConfig] of Object.entries(config.retailers)) {
    if (retailerConfig.enabled) {
      enabled.push({
        name: name as 'petsmart' | 'petvalu' | 'shoppers',
        config: retailerConfig
      });
    }
  }
  
  return enabled;
}

/**
 * Validate configuration
 */
export function validateConfig(config: ScrapingConfig): string[] {
  const errors: string[] = [];
  
  // Check if at least one retailer is enabled
  const enabledRetailers = Object.values(config.retailers).filter(r => r.enabled);
  if (enabledRetailers.length === 0) {
    errors.push('No retailers are enabled in configuration');
  }
  
  // Check if enabled retailers have products
  for (const [name, retailerConfig] of Object.entries(config.retailers)) {
    if (retailerConfig.enabled && retailerConfig.products.length === 0) {
      errors.push(`Retailer ${name} is enabled but has no products configured`);
    }
    
    // Validate product configurations
    for (let i = 0; i < retailerConfig.products.length; i++) {
      const product = retailerConfig.products[i];
      if (!product.url && !product.category_url) {
        errors.push(`Retailer ${name}, product ${i}: must have either 'url' or 'category_url'`);
      }
      
      if (!product.name || product.name.trim().length === 0) {
        errors.push(`Retailer ${name}, product ${i}: must have a valid 'name'`);
      }
    }
  }
  
  // Validate alert settings (skip in test mode)
  const isTestMode = process.env.TEST_MODE === 'true' || process.env.NODE_ENV === 'test';
  if (config.alerts.discord_enabled && !config.alerts.discord_webhook && !process.env.DISCORD_WEBHOOK && !isTestMode) {
    errors.push('Discord alerts are enabled but DISCORD_WEBHOOK environment variable is not set');
  }
  
  if (config.alerts.min_discount_percent < 0 || config.alerts.min_discount_percent > 100) {
    errors.push('min_discount_percent must be between 0 and 100');
  }
  
  return errors;
}

/**
 * Load and validate configuration with error handling
 */
export function loadAndValidateConfig(configPath?: string): ScrapingConfig {
  const config = loadConfig(configPath);
  const validationErrors = validateConfig(config);
  
  if (validationErrors.length > 0) {
    const errorMessage = `Configuration validation failed:\n${validationErrors.join('\n')}`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }
  
  return config;
}

/**
 * Get product configuration by URL for determining alert thresholds
 */
export function getProductConfigByUrl(
  config: ScrapingConfig,
  retailer: 'petsmart' | 'petvalu' | 'shoppers',
  url: string
): ProductConfig | undefined {
  const retailerConfig = config.retailers[retailer];
  if (!retailerConfig.enabled) {
    return undefined;
  }
  
  return retailerConfig.products.find(product => 
    product.url === url || product.category_url === url
  );
}
