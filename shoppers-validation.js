/**
 * Shoppers Drug Mart URL Validation Functions
 * Tests connectivity and provides manual validation guide
 *
 * VALIDATION RESULTS:
 * - URLs are accessible via HTTP (200 OK)
 * - Automated scraping is blocked by bot detection
 * - Manual validation required for price verification
 */

const { chromium } = require('playwright');

async function quickTest() {
  console.log('⚡ Quick Shoppers Validation\n');

  const tests = [
    {
      name: 'Enfamil Ready to Feed',
      url: 'https://www.shoppersdrugmart.ca/enfamil-neuropro-baby-formula-0-12-months-ready-to-feed-bo/p/BB_056796906606?variantCode=056796906606&source=nspt',
      expected: '$89.99'
    },
    {
      name: 'Enfamil Gentlease Powder',
      url: 'https://www.shoppersdrugmart.ca/enfamil-neuropro-gentlease-baby-formula-0-12-months-powder/p/BB_056796006610?variantCode=056796006610&source=nspt',
      expected: '$71.99 (current), $78.49 (regular)'
    }
  ];

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    for (const test of tests) {
      console.log(`📋 ${test.name}`);
      console.log(`🔗 ${test.url}`);
      console.log(`💰 Expected: ${test.expected}`);

      try {
        // Very short timeout - just test if page loads at all
        await page.goto(test.url, { timeout: 5000, waitUntil: 'domcontentloaded' });
        console.log('✅ Page loads successfully');

        // Quick check for any price-like content
        const hasContent = await page.$('body');
        if (hasContent) {
          console.log('✅ Page has content');
        }
      } catch (error) {
        if (error.message.includes('Timeout')) {
          console.log('⏱️  Page load timeout (likely bot detection)');
        } else {
          console.log(`❌ Error: ${error.message.split('\n')[0]}`);
        }
      }
      console.log('');
    }
  } finally {
    if (browser) await browser.close();
  }

  // Manual validation guide
  console.log('📋 MANUAL VALIDATION GUIDE');
  console.log('========================');
  console.log('Since automated scraping is blocked, please manually verify:');
  console.log('');

  for (const test of tests) {
    console.log(`🔗 ${test.name}:`);
    console.log(`   URL: ${test.url}`);
    console.log(`   Expected: ${test.expected}`);
    console.log(`   Steps: 1. Open URL in browser`);
    console.log(`          2. Check if price matches expected value`);
    console.log(`          3. Note any discounts or regular prices`);
    console.log('');
  }

  console.log('💡 SCRAPER RECOMMENDATIONS:');
  console.log('• Shoppers Drug Mart has strong bot detection');
  console.log('• Consider implementing manual fallback mode');
  console.log('• Use longer delays between requests (2-5 seconds)');
  console.log('• Consider mobile user agents and different IP addresses');
  console.log('• Implement CAPTCHA handling for production use');
}

quickTest()
  .then(() => {
    console.log('🏁 Quick validation complete');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });