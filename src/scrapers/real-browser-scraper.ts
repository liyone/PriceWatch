/**
 * Real Browser Scraper for GitHub Actions
 * Uses actual browsers with virtual display to bypass bot detection
 */

import { chromium, firefox, Browser, BrowserContext, Page } from 'playwright';
import { logger } from '../utils/logger';
import { Product, ScrapingError } from '../types';
import { shoppersConfig } from '../config/site-selectors';
import { parsePrices } from '../utils/price-parser';

export class RealBrowserScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  constructor() {}

  /**
   * Initialize real browser with maximum human-like behavior
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing real browser for GitHub Actions', {
        display: process.env.DISPLAY,
        realBrowserMode: true
      });

      // Use real browser with human-like settings
      this.browser = await chromium.launch({
        headless: false, // Real browser!
        slowMo: 100,     // Human-like speed
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--start-maximized',
          '--disable-blink-features=AutomationControlled', // Still try to hide automation
          '--disable-web-security',
          '--allow-running-insecure-content',
          '--disable-features=VizDisplayCompositor'
        ]
      });

      // Create context with real user behavior
      this.context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'en-CA',
        timezoneId: 'America/Toronto',
        geolocation: { latitude: 43.6532, longitude: -79.3832 }, // Toronto
        permissions: ['geolocation'],
        extraHTTPHeaders: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-CA,en;q=0.9,en-US;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      this.page = await this.context.newPage();

      // Add human-like scripts
      await this.page.addInitScript(() => {
        // Remove obvious automation markers
        delete (window as any).navigator.webdriver;

        // Mock human-like properties
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });

        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5], // Mock plugins
        });

        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-CA', 'en', 'en-US'],
        });
      });

      logger.info('Real browser initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize real browser', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Scrape Shoppers products with real browser
   */
  async scrapeShoppersProducts(urls: string[]): Promise<{ products: Product[]; errors: ScrapingError[] }> {
    const products: Product[] = [];
    const errors: ScrapingError[] = [];

    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    for (const url of urls) {
      try {
        logger.info('Scraping Shoppers URL with real browser', { url });

        // Human-like navigation
        await this.simulateHumanBrowsing();

        // Navigate to product page
        const response = await this.page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });

        logger.info('Page response', {
          status: response?.status(),
          url: response?.url()
        });

        if (response && response.status() !== 200) {
          throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
        }

        // Wait for page to fully load
        await this.page.waitForTimeout(3000 + Math.random() * 2000);

        // Take screenshot for debugging
        await this.page.screenshot({ path: `shoppers-${Date.now()}.png` });

        // Extract product data
        const product = await this.extractShoppersProduct(url);

        if (product) {
          products.push(product);
          logger.info('Successfully scraped Shoppers product', {
            title: product.title,
            price: product.current_price
          });
        } else {
          logger.warn('Could not extract product data', { url });
        }

        // Human-like delay between requests
        await this.page.waitForTimeout(5000 + Math.random() * 5000);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Failed to scrape Shoppers product', {
          url,
          error: errorMessage
        });

        errors.push({
          retailer: 'shoppers',
          product_url: url,
          message: errorMessage,
          severity: 'error',
          timestamp: new Date().toISOString()
        });
      }
    }

    return { products, errors };
  }

  /**
   * Extract product data from Shoppers page
   */
  private async extractShoppersProduct(url: string): Promise<Product | null> {
    if (!this.page) return null;

    try {
      // Extract title
      const title = await this.page.textContent('h1') ||
                   await this.page.textContent('.product-title') ||
                   await this.page.textContent('[data-testid="product-title"]');

      if (!title) {
        logger.warn('Product title not found');
        return null;
      }

      // Extract prices using the validated selectors
      const priceContainer = await this.page.$('[data-testid="price-container"]');

      if (!priceContainer) {
        logger.warn('Price container not found');
        return null;
      }

      const priceText = await priceContainer.textContent();
      logger.info('Found price container', { priceText });

      if (!priceText) {
        return null;
      }

      // Extract current price
      const currentPriceMatch = priceText.match(/\$(\d+(?:\.\d{2})?)/);
      const currentPrice = currentPriceMatch ? parseFloat(currentPriceMatch[1]) : undefined;

      // Extract regular price (strikethrough)
      const strikethroughElement = await priceContainer.$('.plp__priceStrikeThrough__2MAlQ');
      let regularPrice: number | undefined;
      let discountPercent: number | undefined;

      if (strikethroughElement) {
        const strikethroughText = await strikethroughElement.textContent();
        const regularPriceMatch = strikethroughText?.match(/\$(\d+(?:\.\d{2})?)/);
        if (regularPriceMatch) {
          regularPrice = parseFloat(regularPriceMatch[1]);
          if (currentPrice && regularPrice) {
            discountPercent = ((regularPrice - currentPrice) / regularPrice) * 100;
          }
        }
      }

      // Extract brand and size from title
      const brand = this.extractBrand(title);
      const size = this.extractSize(title);

      const product: Product = {
        retailer: 'shoppers',
        title: title.trim(),
        brand,
        size_text: size,
        current_price: currentPrice,
        regular_price: regularPrice,
        percent_off: discountPercent ? Math.round(discountPercent * 10) / 10 : undefined,
        promo_text: undefined,
        product_url: url,
        image_url: undefined,
        scraped_at: new Date().toISOString()
      };

      logger.info('Extracted product data', {
        title: product.title,
        currentPrice: product.current_price,
        regularPrice: product.regular_price,
        discount: product.percent_off
      });

      return product;

    } catch (error) {
      logger.error('Error extracting product data', {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Simulate human browsing behavior
   */
  private async simulateHumanBrowsing(): Promise<void> {
    if (!this.page) return;

    try {
      // Random mouse movements
      const x = Math.random() * 800 + 100;
      const y = Math.random() * 600 + 100;
      await this.page.mouse.move(x, y);

      // Random small delay
      await this.page.waitForTimeout(500 + Math.random() * 1000);

      // Occasional scroll
      if (Math.random() < 0.3) {
        await this.page.evaluate(() => {
          window.scrollTo(0, Math.random() * 200);
        });
      }

    } catch (error) {
      // Ignore errors in human simulation
      logger.debug('Human simulation error (ignored)', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Extract brand from title
   */
  private extractBrand(title: string): string | undefined {
    const brands = ['Enfamil', 'Similac', 'Gerber', 'Nestle'];
    for (const brand of brands) {
      if (title.toLowerCase().includes(brand.toLowerCase())) {
        return brand;
      }
    }
    return undefined;
  }

  /**
   * Extract size from title
   */
  private extractSize(title: string): string | undefined {
    const sizePatterns = [
      /(Ready\s+to\s+Feed)/i,
      /(Powder)/i,
      /(\d+(?:\.\d+)?\s*(?:ml|mL|L|oz|g|kg))/i
    ];

    for (const pattern of sizePatterns) {
      const match = title.match(pattern);
      if (match) {
        return match[1];
      }
    }
    return undefined;
  }

  /**
   * Clean up browser resources
   */
  async close(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }

      if (this.context) {
        await this.context.close();
        this.context = null;
      }

      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }

      logger.info('Real browser closed successfully');

    } catch (error) {
      logger.error('Error closing real browser', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}