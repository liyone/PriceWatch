import { PetSmartScraper } from './src/scrapers/petsmart-scraper';
import { logger } from './src/utils/logger';

async function testPricing() {
  // Enable debug logging to see what's happening
  logger.setLogLevel('debug');
  
  const scraper = new PetSmartScraper();
  
  try {
    console.log('🧪 Testing discounted product price extraction...');
    
    const testUrl = 'https://www.petsmart.ca/cat/food-and-treats/dry-food/authority-everyday-health-senior-dry-cat-food---chicken-and-rice-with-grain-51031.html';
    
    const result = await scraper.scrape([testUrl]);
    
    if (result.products.length > 0) {
      const product = result.products[0];
      
      console.log('📦 Product Details:');
      console.log('  Title:', product.title);
      console.log('  Current Price:', product.current_price);
      console.log('  Regular Price:', product.regular_price);
      console.log('  Percent Off:', product.percent_off);
      console.log('  Promo Text:', product.promo_text);
      
      // Expected values based on the page content:
      console.log('\n🎯 Expected vs Actual:');
      console.log('  Expected Current: $19.67');
      console.log('  Expected Regular: $24.67');
      console.log('  Expected Discount: ~20%');
      
      if (product.regular_price && product.current_price) {
        const calculatedDiscount = Math.round(((product.regular_price - product.current_price) / product.regular_price) * 100);
        console.log('  Calculated Discount:', calculatedDiscount + '%');
      }
      
    } else {
      console.log('❌ No products extracted!');
      console.log('Errors:', result.errors);
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

testPricing();
