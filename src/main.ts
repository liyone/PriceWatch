/**
 * Main entry point for the PriceWatch scraper
 * Orchestrates the entire scraping, alerting, and CSV generation process
 */

import { loadAndValidateConfig, getEnabledRetailers, getProductUrlsForRetailer } from './config/config-loader';
import { loadEnvironmentConfig, isGitHubActions, isTestMode } from './config/environment';
import { PetSmartScraper } from './scrapers/petsmart-scraper';
import { writeProductsToCSV, getTodaysCSVPath } from './utils/csv';
import { createDiscordAlert } from './alerts/discord';
import { logger } from './utils/logger';
import { Product, ScrapingError, ScrapingResult } from './types';

/**
 * Main orchestration function
 */
export async function main(): Promise<ScrapingResult> {
  const startTime = Date.now();
  let allProducts: Product[] = [];
  let allErrors: ScrapingError[] = [];
  let alertsSent = 0;

  try {
    // Load environment configuration first
    const envConfig = loadEnvironmentConfig();
    logger.setLogLevel(envConfig.logLevel);

    logger.info('🚀 PriceWatch scraper starting...', {
      timestamp: new Date().toISOString(),
      environment: envConfig.nodeEnv,
      platform: process.platform,
      isGitHubActions: isGitHubActions(),
      testMode: isTestMode(),
      githubRunId: envConfig.github?.runId
    });

    if (isGitHubActions()) {
      logger.githubAction('scraper_start', {
        runId: envConfig.github?.runId,
        runNumber: envConfig.github?.runNumber,
        trigger: process.env.GITHUB_EVENT_NAME
      });
    }

    // Load and validate configuration
    logger.info('📋 Loading configuration...');
    const config = loadAndValidateConfig();
    
    const enabledRetailers = getEnabledRetailers(config);
    logger.info(`🏪 Found ${enabledRetailers.length} enabled retailers`, {
      retailers: enabledRetailers.map(r => r.name)
    });

    if (enabledRetailers.length === 0) {
      throw new Error('No enabled retailers found in configuration');
    }

    // Initialize Discord alerts if configured (override with environment if test mode)
    const discordWebhook = isTestMode() ? undefined : (envConfig.discordWebhook || config.alerts.discord_webhook);
    const discordAlert = createDiscordAlert(
      discordWebhook,
      config.alerts.deduplication_hours
    );

    if (config.alerts.discord_enabled && discordAlert && !isTestMode()) {
      logger.info('💬 Discord alerts enabled');
    } else {
      logger.info('🔇 Discord alerts disabled', {
        testMode: isTestMode(),
        hasWebhook: !!discordWebhook,
        alertsEnabled: config.alerts.discord_enabled
      });
    }

    // Process each enabled retailer
    for (const { name: retailerName, config: retailerConfig } of enabledRetailers) {
      try {
        logger.info(`🏪 Processing retailer: ${retailerName}`);
        
        // Get product URLs for this retailer
        const productUrls = getProductUrlsForRetailer(retailerConfig);
        if (productUrls.length === 0) {
          logger.warn(`No product URLs configured for ${retailerName}, skipping`);
          continue;
        }

        logger.info(`📦 Found ${productUrls.length} products to scrape for ${retailerName}`, {
          retailer: retailerName,
          productCount: productUrls.length
        });

        // Create scraper for this retailer
        let scraper;
        switch (retailerName) {
          case 'petsmart':
            scraper = new PetSmartScraper();
            break;
          case 'petvalu':
            logger.warn(`${retailerName} scraper not implemented yet, skipping`);
            continue;
          case 'shoppers':
            logger.warn(`${retailerName} scraper not implemented yet, skipping`);
            continue;
          default:
            logger.error(`Unknown retailer: ${retailerName}`);
            continue;
        }

        // Scrape products
        const result = await scraper.scrape(productUrls);
        
        allProducts.push(...result.products);
        allErrors.push(...result.errors);

        logger.info(`✅ Completed ${retailerName}`, {
          retailer: retailerName,
          productsFound: result.products.length,
          errorsCount: result.errors.length
        });

      } catch (retailerError) {
        const errorMessage = `Failed to process retailer ${retailerName}: ${retailerError instanceof Error ? retailerError.message : String(retailerError)}`;
        logger.error(errorMessage);
        
        allErrors.push({
          retailer: retailerName,
          message: errorMessage,
          severity: 'critical',
          timestamp: new Date().toISOString()
        });

        // Send error alert to Discord if configured
        if (discordAlert) {
          try {
            await discordAlert.sendErrorAlert(errorMessage, { retailer: retailerName });
          } catch (alertError) {
            logger.error('Failed to send error alert to Discord', {
              originalError: errorMessage,
              alertError: alertError instanceof Error ? alertError.message : String(alertError)
            });
          }
        }
      }
    }

    // Generate CSV output
    if (allProducts.length > 0) {
      logger.info('📄 Generating CSV output...');
      const csvPath = getTodaysCSVPath(config.output.data_directory);
      await writeProductsToCSV(allProducts, csvPath);
      logger.csvOperation('write', csvPath, allProducts.length);
    } else {
      logger.warn('No products extracted, skipping CSV generation');
    }

    // Send deal alerts
    if (discordAlert && allProducts.length > 0) {
      try {
        logger.info('🔔 Checking for deal alerts...');
        const alertThreshold = envConfig.alertMinPercent || config.alerts.min_discount_percent;
        const dealsFound = allProducts.filter(p => 
          p.percent_off !== undefined && 
          p.percent_off >= alertThreshold
        ).length;

        if (dealsFound > 0) {
          await discordAlert.sendDealsAlert(allProducts, alertThreshold);
          alertsSent = dealsFound;
          logger.info(`🎉 Sent alerts for ${dealsFound} qualifying deals (${alertThreshold}%+ discount)`);
        } else {
          logger.info(`📭 No qualifying deals found for alerts (${alertThreshold}%+ discount threshold)`);
        }
      } catch (alertError) {
        logger.error('Failed to send deal alerts', {
          error: alertError instanceof Error ? alertError.message : String(alertError)
        });
      }
    }

    // Send summary alert
    if (discordAlert) {
      try {
        const executionTime = Date.now() - startTime;
        const csvPath = getTodaysCSVPath(config.output.data_directory);
        
        await discordAlert.sendSummaryAlert({
          totalProducts: enabledRetailers.reduce((total, r) => total + getProductUrlsForRetailer(r.config).length, 0),
          successfulScrapes: allProducts.length,
          errors: allErrors.length,
          dealsFound: alertsSent,
          executionTimeMs: executionTime,
          csvFile: csvPath.split('/').pop() || csvPath.split('\\').pop() || csvPath
        });
      } catch (alertError) {
        logger.error('Failed to send summary alert', {
          error: alertError instanceof Error ? alertError.message : String(alertError)
        });
      }
    }

    // Final summary
    const executionTime = Date.now() - startTime;
    const summary: ScrapingResult = {
      products: allProducts,
      errors: allErrors,
      summary: {
        total_products: allProducts.length,
        successful_scrapes: allProducts.length,
        failed_scrapes: allErrors.length,
        alerts_sent: alertsSent,
        execution_time_ms: executionTime
      }
    };

    logger.info('🎯 PriceWatch scraping completed', {
      totalProducts: allProducts.length,
      totalErrors: allErrors.length,
      alertsSent,
      executionTimeMs: executionTime,
      successRate: allProducts.length > 0 ? ((allProducts.length / (allProducts.length + allErrors.length)) * 100).toFixed(1) + '%' : '0%'
    });

    if (isGitHubActions()) {
      logger.githubAction('scraper_complete', {
        runId: envConfig.github?.runId,
        productsExtracted: allProducts.length,
        errorsCount: allErrors.length,
        alertsSent,
        executionTimeMs: executionTime
      });
    }

    return summary;

  } catch (error) {
    const errorMessage = `PriceWatch scraper failed: ${error instanceof Error ? error.message : String(error)}`;
    logger.error(errorMessage, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    // Try to send critical error alert
    let config = null;
    try {
      config = loadAndValidateConfig();
    } catch (configError) {
      logger.debug('Could not load config for error alert', {
        configError: configError instanceof Error ? configError.message : String(configError)
      });
    }
    if (config) {
      const discordAlert = createDiscordAlert(config.alerts.discord_webhook);
      if (discordAlert) {
        try {
          await discordAlert.sendErrorAlert(errorMessage, { 
            critical: true,
            executionTimeMs: Date.now() - startTime 
          });
        } catch (alertError) {
          logger.error('Failed to send critical error alert', {
            originalError: errorMessage,
            alertError: alertError instanceof Error ? alertError.message : String(alertError)
          });
        }
      }
    }

    // Return partial results
    const executionTime = Date.now() - startTime;
    return {
      products: allProducts,
      errors: [
        ...allErrors,
        {
          retailer: 'system',
          message: errorMessage,
          severity: 'critical',
          timestamp: new Date().toISOString()
        }
      ],
      summary: {
        total_products: allProducts.length,
        successful_scrapes: allProducts.length,
        failed_scrapes: allErrors.length + 1,
        alerts_sent: alertsSent,
        execution_time_ms: executionTime
      }
    };
  }
}

// CLI execution
if (require.main === module) {
  main()
    .then((result) => {
      const exitCode = result.errors.length > 0 ? 1 : 0;
      logger.info(`Exiting with code ${exitCode}`);
      process.exit(exitCode);
    })
    .catch((error) => {
      logger.error('Fatal error in main execution', {
        error: error instanceof Error ? error.message : String(error)
      });
      process.exit(1);
    });
}
