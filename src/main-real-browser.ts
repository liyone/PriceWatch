/**
 * Main entry point for real browser mode in GitHub Actions
 * Uses virtual display + real browser to bypass bot detection
 */

import { RealBrowserScraper } from './scrapers/real-browser-scraper';
import { logger } from './utils/logger';
import { writeProductsToCSV } from './utils/csv';
import { Product } from './types';

async function runRealBrowserScraping() {
  logger.info('🌐 Starting Real Browser Scraping Mode', {
    environment: process.env.NODE_ENV || 'development',
    display: process.env.DISPLAY,
    githubActions: process.env.GITHUB_ACTIONS === 'true'
  });

  const scraper = new RealBrowserScraper();
  const allProducts: Product[] = [];

  try {
    await scraper.initialize();

    // Test Shoppers URLs (the ones that were blocked before)
    const shoppersUrls = [
      'https://www.shoppersdrugmart.ca/enfamil-neuropro-baby-formula-0-12-months-ready-to-feed-bo/p/BB_056796906606?variantCode=056796906606&source=nspt',
      'https://www.shoppersdrugmart.ca/enfamil-neuropro-gentlease-baby-formula-0-12-months-powder/p/BB_056796006610?variantCode=056796006610&source=nspt'
    ];

    logger.info('🛒 Scraping Shoppers with real browser', {
      urlCount: shoppersUrls.length
    });

    const { products, errors } = await scraper.scrapeShoppersProducts(shoppersUrls);

    allProducts.push(...products);

    logger.info('📊 Real browser scraping results', {
      productsFound: products.length,
      errorsCount: errors.length,
      successRate: products.length / shoppersUrls.length * 100
    });

    // Log individual results
    products.forEach(product => {
      logger.info('✅ Product scraped successfully', {
        retailer: product.retailer,
        title: product.title,
        currentPrice: product.current_price,
        regularPrice: product.regular_price,
        discount: product.percent_off
      });
    });

    errors.forEach(error => {
      logger.error('❌ Scraping error', {
        url: error.product_url,
        message: error.message
      });
    });

    // Write results to CSV
    if (allProducts.length > 0) {
      const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const filename = `data/deals_${timestamp}_real_browser.csv`;

      await writeProductsToCSV(allProducts, filename);

      logger.info('📄 CSV file written', {
        filename,
        productCount: allProducts.length
      });
    } else {
      logger.warn('No products to write to CSV');
    }

  } catch (error) {
    logger.error('💥 Real browser scraping failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;

  } finally {
    await scraper.close();
  }

  return {
    productsScraped: allProducts.length,
    success: allProducts.length > 0
  };
}

// Run if called directly
if (require.main === module) {
  runRealBrowserScraping()
    .then(result => {
      logger.info('🎉 Real browser scraping completed', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      logger.error('💥 Fatal error in real browser mode', {
        error: error instanceof Error ? error.message : String(error)
      });
      process.exit(1);
    });
}

export { runRealBrowserScraping };