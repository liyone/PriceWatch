import { ShoppersScraper } from './src/scrapers/shoppers-scraper';
import { logger } from './src/utils/logger';

async function testShoppers() {
  logger.setLogLevel('debug');
  const scraper = new ShoppersScraper();
  
  const testUrls = [
    'https://www.shoppersdrugmart.ca/enfamil-neuropro-baby-formula-0-12-months-ready-to-feed-bo/p/BB_056796906606?variantCode=056796906606&source=nspt', // Regular product
    'https://www.shoppersdrugmart.ca/enfamil-neuropro-gentlease-baby-formula-0-12-months-powder/p/BB_056796006610?variantCode=056796006610&source=nspt' // Discount product
  ];
  
  const result = await scraper.scrape(testUrls);
  
  console.log('\n📊 Shoppers Results:');
  result.products.forEach((product, i) => {
    console.log(`\nProduct ${i + 1}: ${product.title}`);
    console.log(`  Current: $${product.current_price}`);
    console.log(`  Regular: ${product.regular_price ? '$' + product.regular_price : 'none'}`);
    console.log(`  Discount: ${product.percent_off ? product.percent_off + '%' : 'none'}`);
    console.log(`  Brand: ${product.brand || 'none'}`);
    console.log(`  Size: ${product.size_text || 'none'}`);
    console.log(`  Promo: ${product.promo_text || 'none'}`);
  });

  if (result.errors.length > 0) {
    console.log('\n❌ Errors:');
    result.errors.forEach(error => {
      console.log(`  - ${error.message}`);
    });
  }
}

testShoppers().catch(console.error);
