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
   * Initialize browser and create context with anti-detection measures
   */
  protected async initializeBrowser(): Promise<void> {
    try {
      logger.debug(`Initializing browser for ${this.retailerName}`);
      
      // Launch browser with stealth arguments
      this.browser = await chromium.launch({
        headless: true,
        timeout: 30000,
        args: [
          '--no-default-browser-check',
          '--no-first-run',
          '--disable-default-apps',
          '--disable-popup-blocking',
          '--disable-translate',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-device-discovery-notifications',
          '--no-sandbox',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-blink-features=AutomationControlled'
        ]
      });

      // Generate more realistic user agent and viewport
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
      ];
      
      const viewports = [
        { width: 1920, height: 1080 },
        { width: 1366, height: 768 },
        { width: 1440, height: 900 },
        { width: 1536, height: 864 }
      ];
      
      const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
      const randomViewport = viewports[Math.floor(Math.random() * viewports.length)];
      
      logger.debug(`Using user agent: ${randomUserAgent}`, { retailer: this.retailerName });
      logger.debug(`Using viewport: ${randomViewport.width}x${randomViewport.height}`, { retailer: this.retailerName });

      this.context = await this.browser.newContext({
        userAgent: randomUserAgent,
        viewport: randomViewport,
        acceptDownloads: false,
        ignoreHTTPSErrors: true,
        locale: 'en-CA',
        timezoneId: 'America/Toronto',
        extraHTTPHeaders: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept-Language': 'en-CA,en;q=0.9,en-US;q=0.8',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1'
        }
      });

      this.page = await this.context.newPage();
      
      // Remove webdriver property and other automation indicators
      await this.page.addInitScript(() => {
        // Remove webdriver property
        delete (window.navigator as any).webdriver;
        
        // Override the plugins property to avoid headless detection
        Object.defineProperty(window.navigator, 'plugins', {
          get: () => [
            {
              0: {type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format', enabledPlugin: Plugin},
              description: 'Portable Document Format',
              filename: 'internal-pdf-viewer',
              length: 1,
              name: 'Chrome PDF Plugin'
            }
          ]
        });
        
        // Override the languages property
        Object.defineProperty(window.navigator, 'languages', {
          get: () => ['en-CA', 'en', 'en-US']
        });
        
        // Override the platform property
        Object.defineProperty(window.navigator, 'platform', {
          get: () => 'Win32'
        });
        
        // Mock realistic hardware concurrency
        Object.defineProperty(window.navigator, 'hardwareConcurrency', {
          get: () => 8
        });
      });
      
      // Set longer timeouts for potentially slow-loading pages
      this.page.setDefaultTimeout(25000);
      this.page.setDefaultNavigationTimeout(30000);
      
      logger.debug(`Browser initialized for ${this.retailerName}`);
    } catch (error) {
      const errorMessage = `Failed to initialize browser: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMessage, { retailer: this.retailerName });
      throw new Error(errorMessage);
    }
  }

  /**
   * Navigate to a URL with retries, error handling, and human-like behavior
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

        // Add human-like delay before navigation
        const preNavigationDelay = 500 + Math.random() * 1500; // 0.5-2 seconds
        await new Promise(resolve => setTimeout(resolve, preNavigationDelay));
        
        // Try multiple wait strategies
        const waitStrategies = [
          'networkidle',
          'domcontentloaded', 
          'load'
        ];
        
        let navigated = false;
        for (const waitUntil of waitStrategies) {
          try {
            await this.page.goto(url, {
              waitUntil: waitUntil as any,
              timeout: 30000
            });
            navigated = true;
            logger.debug(`Navigation succeeded with waitUntil: ${waitUntil}`, {
              retailer: this.retailerName,
              url,
              waitUntil
            });
            break;
          } catch (strategyError) {
            logger.debug(`Navigation strategy ${waitUntil} failed, trying next`, {
              retailer: this.retailerName,
              error: strategyError instanceof Error ? strategyError.message : String(strategyError)
            });
            continue;
          }
        }
        
        if (!navigated) {
          throw new Error('All navigation strategies failed');
        }

        // Simulate human reading/interaction time
        const humanDelay = 2000 + Math.random() * 3000; // 2-5 seconds
        await this.page.waitForTimeout(humanDelay);
        
        // Add subtle mouse movements to simulate human presence
        await this.simulateHumanBehavior();
        
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
          // Progressive backoff with randomization
          const baseWaitTime = attempt * 2000;
          const randomDelay = Math.random() * 2000; // Add 0-2 seconds randomness
          const waitTime = baseWaitTime + randomDelay;
          
          logger.debug(`Waiting ${waitTime}ms before retry`, {
            retailer: this.retailerName,
            attempt,
            waitTime
          });
          
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    throw new Error(`Failed to navigate to ${url} after ${maxRetries} attempts. Last error: ${lastError?.message}`);
  }

  /**
   * Simulate subtle human-like behavior on the page
   */
  private async simulateHumanBehavior(): Promise<void> {
    if (!this.page) return;

    try {
      // Get viewport size
      const viewport = this.page.viewportSize();
      if (!viewport) return;
      
      // Simulate subtle mouse movements
      const movements = 2 + Math.floor(Math.random() * 3); // 2-4 movements
      
      for (let i = 0; i < movements; i++) {
        const x = Math.floor(Math.random() * viewport.width);
        const y = Math.floor(Math.random() * viewport.height);
        
        await this.page.mouse.move(x, y, {
          steps: 3 + Math.floor(Math.random() * 5) // 3-7 steps for smooth movement
        });
        
        // Small delay between movements
        await this.page.waitForTimeout(200 + Math.random() * 300);
      }
      
      // Occasionally scroll slightly
      if (Math.random() < 0.3) { // 30% chance
        const scrollDistance = 100 + Math.floor(Math.random() * 300); // 100-400px
        await this.page.evaluate((distance) => {
          window.scrollBy(0, distance);
        }, scrollDistance);
        
        await this.page.waitForTimeout(500 + Math.random() * 1000);
      }
      
    } catch (error) {
      // Don't let simulation errors break the main flow
      logger.debug('Human behavior simulation failed', {
        retailer: this.retailerName,
        error: error instanceof Error ? error.message : String(error)
      });
    }
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
