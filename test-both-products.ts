import { PetSmartScraper } from './src/scrapers/petsmart-scraper';
import { logger } from './src/utils/logger';

async function testBothProducts() {
  logger.setLogLevel('debug');
  const scraper = new PetSmartScraper();
  
  const testUrls = [
    'https://www.petsmart.ca/cat/food-and-treats/wet-food/authority-everyday-health-adult-cat-wet-food---55-oz-flaked-in-gravy-51010.html', // Should be $2.89 with NO regular price
    'https://www.petsmart.ca/cat/food-and-treats/dry-food/authority-everyday-health-senior-dry-cat-food---chicken-and-rice-with-grain-51031.html' // Should be $19.67 with $24.67 regular
  ];
  
  const result = await scraper.scrape(testUrls);
  
  console.log('\n📊 Results:');
  result.products.forEach((product, i) => {
    console.log(`\nProduct ${i + 1}: ${product.title}`);
    console.log(`  Current: $${product.current_price}`);
    console.log(`  Regular: ${product.regular_price ? '$' + product.regular_price : 'none'}`);
    console.log(`  Discount: ${product.percent_off ? product.percent_off + '%' : 'none'}`);
  });
}

testBothProducts().catch(console.error);
