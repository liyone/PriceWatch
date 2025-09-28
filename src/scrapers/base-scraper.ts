/**
 * Abstract base scraper class with common functionality
 * All site-specific scrapers should extend this class
 */

import { Browser, BrowserContext, Page, chromium } from 'playwright';
import { Product, SiteConfig, ScrapingError } from '../types';
import { logger } from '../utils/logger';

export abstract class BaseScraper {
  protected browser: Browser | null = null;
  protected context: BrowserContext | null = null;
  protected page: Page | null = null;
  protected config: SiteConfig;
  protected retailerName: string;

  constructor(config: SiteConfig, retailerName: string) {
    this.config = config;
    this.retailerName = retailerName;
  }

  /**
   * Initialize browser and create context
   */
  protected async initializeBrowser(): Promise<void> {
    try {
      logger.debug(`Initializing browser for ${this.retailerName}`);
      
      this.browser = await chromium.launch({
        headless: true,
        timeout: 30000
      });

      this.context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        acceptDownloads: false,
        ignoreHTTPSErrors: true
      });

      this.page = await this.context.newPage();
      
      // Set reasonable timeouts
      this.page.setDefaultTimeout(15000);
      this.page.setDefaultNavigationTimeout(20000);
      
      logger.debug(`Browser initialized for ${this.retailerName}`);
    } catch (error) {
      const errorMessage = `Failed to initialize browser: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMessage, { retailer: this.retailerName });
      throw new Error(errorMessage);
    }
  }

  /**
   * Navigate to a URL with retries and error handling
   */
  protected async navigateToUrl(url: string, maxRetries: number = 3): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized. Call initializeBrowser first.');
    }

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.debug(`Navigating to ${url} (attempt ${attempt}/${maxRetries})`, {
          retailer: this.retailerName,
          url,
          attempt
        });

        await this.page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 20000
        });

        // Wait a bit for dynamic content
        await this.page.waitForTimeout(1000);
        
        logger.debug(`Successfully navigated to ${url}`, {
          retailer: this.retailerName,
          url
        });
        
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(`Navigation attempt ${attempt} failed for ${url}`, {
          retailer: this.retailerName,
          url,
          attempt,
          error: lastError.message
        });

        if (attempt < maxRetries) {
          // Wait before retry
          const waitTime = attempt * 1000; // Progressive backoff
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    throw new Error(`Failed to navigate to ${url} after ${maxRetries} attempts. Last error: ${lastError?.message}`);
  }

  /**
   * Wait for selector with timeout and error handling
   */
  protected async waitForSelector(selector: string, timeout: number = 10000): Promise<boolean> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    try {
      await this.page.waitForSelector(selector, { timeout });
      return true;
    } catch (error) {
      logger.warn(`Selector not found: ${selector}`, {
        retailer: this.retailerName,
        selector,
        timeout
      });
      return false;
    }
  }

  /**
   * Safely extract text from an element
   */
  protected async safeTextContent(selector: string): Promise<string | null> {
    if (!this.page) {
      return null;
    }

    try {
      const element = await this.page.$(selector);
      if (!element) {
        return null;
      }
      
      const text = await element.textContent();
      return text?.trim() || null;
    } catch (error) {
      logger.debug(`Failed to extract text from ${selector}`, {
        retailer: this.retailerName,
        selector,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Safely extract attribute from an element
   */
  protected async safeGetAttribute(selector: string, attribute: string): Promise<string | null> {
    if (!this.page) {
      return null;
    }

    try {
      const element = await this.page.$(selector);
      if (!element) {
        return null;
      }
      
      const value = await element.getAttribute(attribute);
      return value?.trim() || null;
    } catch (error) {
      logger.debug(`Failed to extract attribute ${attribute} from ${selector}`, {
        retailer: this.retailerName,
        selector,
        attribute,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Scroll page to load dynamic content
   */
  protected async scrollToLoadContent(): Promise<void> {
    if (!this.page) {
      return;
    }

    try {
      logger.debug(`Scrolling page to load content`, { retailer: this.retailerName });
      
      // Scroll to bottom of page gradually
      await this.page.evaluate(() => {
        const scrollStep = 500;
        const scrollDelay = 100;
        
        return new Promise<void>((resolve) => {
          let currentPosition = 0;
          const maxHeight = document.body.scrollHeight;
          
          const scrollInterval = setInterval(() => {
            window.scrollTo(0, currentPosition);
            currentPosition += scrollStep;
            
            if (currentPosition >= maxHeight) {
              clearInterval(scrollInterval);
              resolve();
            }
          }, scrollDelay);
        });
      });

      // Wait for potential lazy loading
      await this.page.waitForTimeout(2000);
      
      logger.debug(`Page scrolling completed`, { retailer: this.retailerName });
    } catch (error) {
      logger.warn(`Failed to scroll page`, {
        retailer: this.retailerName,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Rate limiting delay between requests
   */
  protected async rateLimit(): Promise<void> {
    const delayMs = this.config.delay + Math.random() * 500; // Add jitter
    logger.debug(`Rate limiting: waiting ${delayMs}ms`, { retailer: this.retailerName });
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  /**
   * Create error object for failed scraping
   */
  protected createScrapingError(
    message: string,
    productUrl?: string,
    severity: ScrapingError['severity'] = 'error'
  ): ScrapingError {
    return {
      retailer: this.retailerName,
      product_url: productUrl,
      message,
      severity,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Clean up browser resources
   */
  async cleanup(): Promise<void> {
    try {
      logger.debug(`Cleaning up browser resources for ${this.retailerName}`);
      
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
      
      logger.debug(`Browser cleanup completed for ${this.retailerName}`);
    } catch (error) {
      logger.warn(`Error during browser cleanup`, {
        retailer: this.retailerName,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Abstract method that must be implemented by each scraper
   * This method should contain the main scraping logic for the specific retailer
   */
  abstract scrapeProducts(productUrls: string[]): Promise<{ products: Product[]; errors: ScrapingError[] }>;

  /**
   * Main entry point for scraping - handles initialization and cleanup
   */
  async scrape(productUrls: string[]): Promise<{ products: Product[]; errors: ScrapingError[] }> {
    try {
      logger.scrapingStart(this.retailerName, productUrls.length);
      const startTime = Date.now();
      
      await this.initializeBrowser();
      const result = await this.scrapeProducts(productUrls);
      
      const duration = Date.now() - startTime;
      logger.scrapingComplete(this.retailerName, result.products.length, result.errors.length, duration);
      
      return result;
    } catch (error) {
      const errorMessage = `Scraping failed for ${this.retailerName}: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMessage);
      
      return {
        products: [],
        errors: [this.createScrapingError(errorMessage, undefined, 'critical')]
      };
    } finally {
      await this.cleanup();
    }
  }
}
