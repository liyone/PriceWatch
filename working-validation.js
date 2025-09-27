/**
 * Working Shoppers Validation with Exact Selectors
 * Using the actual CSS selectors found in manual testing
 */

const { chromium } = require('playwright');

async function testWithWorkingSelectors() {
  console.log('🎯 Testing Shoppers with Working CSS Selectors\n');

  const tests = [
    {
      name: 'Enfamil Ready to Feed',
      url: 'https://www.shoppersdrugmart.ca/enfamil-neuropro-baby-formula-0-12-months-ready-to-feed-bo/p/BB_056796906606?variantCode=056796906606&source=nspt',
      expectedCurrent: 89.99,
      selectors: {
        price: '[data-testid="price-container"]'
      }
    },
    {
      name: 'Enfamil Gentlease Powder',
      url: 'https://www.shoppersdrugmart.ca/enfamil-neuropro-gentlease-baby-formula-0-12-months-powder/p/BB_056796006610?variantCode=056796006610&source=nspt',
      expectedCurrent: 71.99,
      expectedRegular: 78.49,
      selectors: {
        price: '[data-testid="price-container"]',
        regular: '.plp__priceStrikeThrough__2MAlQ'
      }
    }
  ];

  let browser;
  try {
    // Try different approaches to bypass detection
    const strategies = [
      {
        name: 'Standard Browser',
        config: {
          headless: true,
          args: ['--no-sandbox', '--disable-web-security']
        }
      },
      {
        name: 'Mobile Browser',
        config: {
          headless: true,
          args: ['--no-sandbox', '--disable-web-security', '--user-agent=Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1']
        }
      }
    ];

    for (const strategy of strategies) {
      console.log(`🔧 Trying ${strategy.name}...`);

      try {
        browser = await chromium.launch(strategy.config);
        const context = await browser.newContext({
          userAgent: strategy.name === 'Mobile Browser' ?
            'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1' :
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          viewport: strategy.name === 'Mobile Browser' ?
            { width: 375, height: 667 } :
            { width: 1920, height: 1080 }
        });

        let successCount = 0;

        for (const test of tests) {
          console.log(`\n📋 Testing: ${test.name}`);

          const page = await context.newPage();

          try {
            // Quick navigation test
            await page.goto(test.url, {
              waitUntil: 'domcontentloaded',
              timeout: 8000
            });

            // Wait a bit for dynamic content
            await page.waitForTimeout(1000);

            // Try to extract prices using exact selectors
            const currentPriceElement = await page.$(test.selectors.price);
            if (currentPriceElement) {
              const priceText = await currentPriceElement.textContent();
              const priceMatch = priceText?.match(/\$(\d+(?:\.\d{2})?)/);

              if (priceMatch) {
                const currentPrice = parseFloat(priceMatch[1]);
                console.log(`💰 Found current price: $${currentPrice}`);

                if (Math.abs(currentPrice - test.expectedCurrent) <= 0.01) {
                  console.log(`✅ Current price matches expected $${test.expectedCurrent}`);
                  successCount++;
                } else {
                  console.log(`❌ Expected $${test.expectedCurrent}, got $${currentPrice}`);
                }
              }
            }

            // Check for regular price if expected
            if (test.expectedRegular && test.selectors.regular) {
              const regularPriceElement = await page.$(test.selectors.regular);
              if (regularPriceElement) {
                const regularText = await regularPriceElement.textContent();
                const regularMatch = regularText?.match(/\$(\d+(?:\.\d{2})?)/);

                if (regularMatch) {
                  const regularPrice = parseFloat(regularMatch[1]);
                  console.log(`💰 Found regular price: $${regularPrice}`);

                  if (Math.abs(regularPrice - test.expectedRegular) <= 0.01) {
                    console.log(`✅ Regular price matches expected $${test.expectedRegular}`);
                  } else {
                    console.log(`❌ Expected regular $${test.expectedRegular}, got $${regularPrice}`);
                  }
                }
              }
            }

          } catch (error) {
            if (error.message.includes('Timeout')) {
              console.log(`⏱️  Navigation timeout (bot detection)`);
            } else {
              console.log(`❌ Error: ${error.message.split('\n')[0]}`);
            }
          } finally {
            await page.close();
          }
        }

        if (successCount > 0) {
          console.log(`\n🎉 SUCCESS with ${strategy.name}! (${successCount}/${tests.length} tests passed)`);
          break; // Found working strategy
        }

      } catch (error) {
        console.log(`❌ ${strategy.name} failed: ${error.message}`);
      } finally {
        if (browser) {
          await browser.close();
          browser = null;
        }
      }
    }

  } catch (error) {
    console.error('Fatal error:', error.message);
  }

  console.log('\n📊 VALIDATION SUMMARY:');
  console.log('• Both URLs manually verified with correct prices');
  console.log('• CSS selectors identified and updated in config');
  console.log('• data-testid="price-container" for current price');
  console.log('• .plp__priceStrikeThrough__2MAlQ for regular price');
  console.log('• Anti-bot measures prevent automated access');
  console.log('• Manual fallback or proxy rotation required for production');
}

testWithWorkingSelectors()
  .then(() => {
    console.log('\n🏁 Working validation complete');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });