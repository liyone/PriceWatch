/**
 * Tests for the base scraper class
 */

import { BaseScraper } from './base-scraper';
import { Product, SiteConfig, ScrapingError } from '../types';

// Mock scraper implementation for testing
class TestScraper extends BaseScraper {
  constructor() {
    const testConfig: SiteConfig = {
      baseUrl: 'https://example.com',
      selectors: {
        productCard: '.product',
        title: '.title',
        currentPrice: '.price',
        regularPrice: '.regular-price',
        productLink: 'a',
        image: 'img'
      },
      delay: 500,
      maxRetries: 2
    };

    super(testConfig, 'test-retailer');
  }

  async scrapeProducts(productUrls: string[]): Promise<{ products: Product[]; errors: ScrapingError[] }> {
    const products: Product[] = [];
    const errors: ScrapingError[] = [];

    for (const url of productUrls) {
      try {
        // Simulate scraping logic
        if (url.includes('valid-product')) {
          products.push({
            retailer: 'petsmart',
            title: 'Test Product',
            current_price: 29.99,
            product_url: url,
            scraped_at: new Date().toISOString()
          });
        } else if (url.includes('error-product')) {
          errors.push(this.createScrapingError('Test error', url));
        }
      } catch (error) {
        errors.push(this.createScrapingError(
          error instanceof Error ? error.message : String(error),
          url
        ));
      }
    }

    return { products, errors };
  }
}

describe('BaseScraper', () => {
  let scraper: TestScraper;

  beforeEach(() => {
    scraper = new TestScraper();
  });

  afterEach(async () => {
    await scraper.cleanup();
  });

  describe('constructor', () => {
    test('should initialize with config and retailer name', () => {
      expect(scraper).toBeInstanceOf(BaseScraper);
    });
  });

  describe('createScrapingError', () => {
    test('should create error with correct properties', () => {
      const error = scraper['createScrapingError']('Test error message', 'https://example.com/product', 'warning');
      
      expect(error.retailer).toBe('test-retailer');
      expect(error.message).toBe('Test error message');
      expect(error.product_url).toBe('https://example.com/product');
      expect(error.severity).toBe('warning');
      expect(error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    test('should create error with default severity', () => {
      const error = scraper['createScrapingError']('Test error');
      expect(error.severity).toBe('error');
    });
  });

  describe('scrape method', () => {
    test('should handle successful scraping', async () => {
      const productUrls = ['https://example.com/valid-product-1', 'https://example.com/valid-product-2'];
      
      const result = await scraper.scrape(productUrls);
      
      expect(result.products).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      expect(result.products[0].title).toBe('Test Product');
      expect(result.products[0].current_price).toBe(29.99);
    });

    test('should handle scraping errors', async () => {
      const productUrls = ['https://example.com/error-product'];
      
      const result = await scraper.scrape(productUrls);
      
      expect(result.products).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Test error');
      expect(result.errors[0].product_url).toBe('https://example.com/error-product');
    });

    test('should handle mixed success and error cases', async () => {
      const productUrls = [
        'https://example.com/valid-product',
        'https://example.com/error-product',
        'https://example.com/unknown-product'
      ];
      
      const result = await scraper.scrape(productUrls);
      
      expect(result.products).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('rate limiting', () => {
    test('should implement rate limiting delay', async () => {
      const startTime = Date.now();
      await scraper['rateLimit']();
      const endTime = Date.now();
      
      const elapsed = endTime - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(500); // At least the base delay
      expect(elapsed).toBeLessThan(1500); // Not too much longer with jitter
    });
  });

  describe('error handling', () => {
    test('should create appropriate error objects', () => {
      const error = scraper['createScrapingError']('Connection failed', 'https://example.com/product', 'critical');
      
      expect(error).toEqual({
        retailer: 'test-retailer',
        product_url: 'https://example.com/product',
        message: 'Connection failed',
        severity: 'critical',
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      });
    });
  });

  describe('browser management', () => {
    test('should initialize and cleanup browser properly', async () => {
      const productUrls = ['https://example.com/valid-product'];
      
      const result = await scraper.scrape(productUrls);
      
      // Browser should be cleaned up after scraping
      expect(scraper['browser']).toBeNull();
      expect(scraper['context']).toBeNull();
      expect(scraper['page']).toBeNull();
      
      expect(result.products).toHaveLength(1);
    });
  });
});
