/**
 * Test script for the enhanced stealth shoppers scraping
 */

import { ShoppersScraper } from './src/scrapers/shoppers-scraper';
import { logger } from './src/utils/logger';

async function testStealthScraping() {
  // Enable debug logging to see all the stealth measures in action
  logger.setLogLevel('debug');
  
  console.log('🕵️  Testing Enhanced Anti-Detection Shoppers Scraping');
  console.log('====================================================');
  
  // Test URLs - using both products from the config
  const testUrls = [
    // Enfamil product that was failing before
    'https://www.shoppersdrugmart.ca/enfamil-neuropro-baby-formula-0-12-months-ready-to-feed-bo/p/BB_056796906606?variantCode=056796906606&source=nspt',
    
    // Second product for additional testing
    'https://www.shoppersdrugmart.ca/huggies-little-snugglers-baby-diapers-size-1/p/BB_062300244631?variantCode=062300244631'
  ];
  
  console.log(`\n🎯 Testing ${testUrls.length} product URLs with enhanced stealth features:`);
  testUrls.forEach((url, index) => {
    console.log(`${index + 1}. ${url.substring(0, 80)}...`);
  });
  
  console.log('\n🛡️  Enhanced Features Active:');
  console.log('   ✅ Random User Agents & Viewports');
  console.log('   ✅ Realistic HTTP Headers (Canadian locale)');
  console.log('   ✅ Anti-automation script injection');
  console.log('   ✅ Human-like mouse movements & scrolling');
  console.log('   ✅ Progressive retry with backoff');
  console.log('   ✅ Multiple navigation strategies');
  console.log('   ✅ Random delays (2-5 second reading time)');
  
  // Create scraper instance WITHOUT manual fallback for now to test automation
  const scraper = new ShoppersScraper(false);
  
  try {
    console.log('\n🚀 Starting enhanced scraping...\n');
    const startTime = Date.now();
    
    const result = await scraper.scrape(testUrls);
    
    const duration = Date.now() - startTime;
    
    console.log('\n📊 SCRAPING RESULTS');
    console.log('===================');
    console.log(`⏱️  Total Duration: ${(duration / 1000).toFixed(2)} seconds`);
    console.log(`✅ Products Found: ${result.products.length}`);
    console.log(`❌ Errors: ${result.errors.length}`);
    
    if (result.products.length > 0) {
      console.log('\n🛒 SUCCESSFULLY SCRAPED PRODUCTS:');
      result.products.forEach((product, index) => {
        console.log(`\n${index + 1}. ${product.title}`);
        console.log(`   💰 Price: $${product.current_price}`);
        if (product.regular_price && product.regular_price !== product.current_price) {
          console.log(`   💸 Regular Price: $${product.regular_price} (${product.percent_off}% off)`);
        }
        console.log(`   🏷️  Brand: ${product.brand || 'N/A'}`);
        console.log(`   📏 Size: ${product.size_text || 'N/A'}`);
        if (product.promo_text) {
          console.log(`   🎉 Promo: ${product.promo_text}`);
        }
        console.log(`   🔗 URL: ${product.product_url}`);
      });
    }
    
    if (result.errors.length > 0) {
      console.log('\n❌ ERRORS ENCOUNTERED:');
      result.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.message}`);
        if (error.product_url) {
          console.log(`   URL: ${error.product_url}`);
        }
      });
    }
    
    // Determine success level
    const successRate = (result.products.length / testUrls.length) * 100;
    
    console.log('\n📈 SUCCESS ANALYSIS');
    console.log('===================');
    console.log(`Success Rate: ${successRate.toFixed(1)}%`);
    
    if (successRate >= 100) {
      console.log('🎉 EXCELLENT! All products scraped successfully with stealth measures!');
    } else if (successRate >= 50) {
      console.log('✅ GOOD! Majority of products scraped. Some sites may still have strong protection.');
    } else if (successRate > 0) {
      console.log('⚠️  PARTIAL SUCCESS. Some products scraped, but improvements may be needed.');
    } else {
      console.log('❌ ALL SCRAPING FAILED. The site may have very strong anti-bot protection.');
      console.log('💡 Consider running with manual fallback: new ShoppersScraper(true)');
    }
    
  } catch (error) {
    console.error('\n💥 CRITICAL ERROR:', error);
    logger.error('Test scraping failed with critical error', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

// Run the test
if (require.main === module) {
  testStealthScraping().catch(console.error);
}

export { testStealthScraping };
