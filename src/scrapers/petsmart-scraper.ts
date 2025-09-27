/**
 * PetSmart-specific scraper implementation
 */

import { BaseScraper } from './base-scraper';
import { Product, ScrapingError } from '../types';
import { petsmartConfig } from '../config/site-selectors';
import { parsePrices, validatePriceResult } from '../utils/price-parser';
import { logger } from '../utils/logger';

export class PetSmartScraper extends BaseScraper {
  constructor() {
    super(petsmartConfig, 'petsmart');
  }

  /**
   * Main scraping method - extracts products from given URLs
   */
  async scrapeProducts(productUrls: string[]): Promise<{ products: Product[]; errors: ScrapingError[] }> {
    const products: Product[] = [];
    const errors: ScrapingError[] = [];

    for (const url of productUrls) {
      try {
        await this.rateLimit(); // Respect rate limits
        
        logger.debug(`Scraping PetSmart URL: ${url}`);
        
        // Navigate to the product page or category page
        await this.navigateToUrl(url);
        
        // Check if this is a category page (multiple products) or single product page
        // PetSmart product URLs typically end with a product ID like "51010.html"
        const isProductPage = url.includes('/product/') || /\/[\w-]+-\d+\.html$/i.test(url);
        
        if (isProductPage) {
          // Single product page
          const product = await this.scrapeSingleProduct(url);
          if (product) {
            products.push(product);
            logger.productExtracted('petsmart', url, product.current_price);
          }
        } else {
          // Category page - extract multiple products
          const categoryProducts = await this.scrapeCategoryPage(url);
          products.push(...categoryProducts);
          
          logger.info(`Extracted ${categoryProducts.length} products from category page`, {
            retailer: 'petsmart',
            url,
            productCount: categoryProducts.length
          });
        }
        
      } catch (error) {
        const errorMessage = `Failed to scrape ${url}: ${error instanceof Error ? error.message : String(error)}`;
        logger.productExtractionFailed('petsmart', url, errorMessage);
        errors.push(this.createScrapingError(errorMessage, url));
      }
    }

    return { products, errors };
  }

  /**
   * Scrape a single product page
   */
  private async scrapeSingleProduct(url: string): Promise<Product | null> {
    if (!this.page) return null;

    try {
      // Wait for page to load - try multiple indicators
      const pageLoaded = await this.waitForSelector('h1', 10000) ||
                        await this.waitForSelector('.product-title', 5000) ||
                        await this.waitForSelector('[data-price]', 5000);
      
      if (!pageLoaded) {
        logger.warn('Page content not loaded within timeout', { url });
        // Don't return null immediately - try to extract anyway
      }

      // Extract product information with multiple fallback strategies
      const title = await this.safeTextContent('h1') || 
                   await this.safeTextContent('.product-title, .pdp-title') ||
                   await this.safeTextContent(this.config.selectors.title) ||
                   await this.extractTitleFromPageText();
      
      if (!title) {
        logger.warn('Product title not found', { url });
        return null;
      }

      logger.debug('Extracted product title', { title, url });

      // Extract prices with multiple fallback strategies
      const currentPriceText = await this.safeTextContent(this.config.selectors.currentPrice) ||
                              await this.safeTextContent('.price, .current-price, .sale-price') ||
                              await this.extractPriceFromPage();
      
      const regularPriceText = await this.safeTextContent(this.config.selectors.regularPrice || '') ||
                              await this.safeTextContent('.was-price, .original-price, .reg-price, .price-original') ||
                              await this.extractRegularPriceFromPage();

      // Extract promotional text
      const promoText = await this.safeTextContent(this.config.selectors.promo || '') ||
                       await this.safeTextContent('.promo, .badge, .points-text');

      // Extract additional info - prioritize title extraction over page elements
      const brand = this.extractBrandFromTitle(title) ||
                   await this.safeTextContent(this.config.selectors.brand || '');

      const sizeText = await this.safeTextContent(this.config.selectors.size || '') ||
                      this.extractSizeFromTitle(title);

      const imageUrl = await this.safeGetAttribute('img[src*="product"], .product-image img', 'src');

      // Parse prices and calculate discount
      const priceResult = parsePrices(currentPriceText, regularPriceText, promoText);
      
      if (!validatePriceResult(priceResult) || !priceResult.currentPrice) {
        logger.warn('Invalid price data extracted', { 
          url, 
          currentPriceText, 
          regularPriceText,
          errors: priceResult.errors 
        });
        return null;
      }

      // Create product object
      const product: Product = {
        retailer: 'petsmart',
        title: title.trim(),
        brand: brand?.trim(),
        size_text: sizeText?.trim(),
        current_price: priceResult.currentPrice.value,
        regular_price: priceResult.regularPrice?.value,
        percent_off: priceResult.discountPercent,
        promo_text: priceResult.promoText?.trim(),
        product_url: url,
        image_url: imageUrl || undefined,
        scraped_at: new Date().toISOString()
      };

      return product;

    } catch (error) {
      logger.warn('Error scraping single product', {
        url,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Scrape multiple products from a category page
   */
  private async scrapeCategoryPage(url: string): Promise<Product[]> {
    if (!this.page) return [];

    const products: Product[] = [];

    try {
      // Wait for product grid to load
      const gridExists = await this.waitForSelector(this.config.selectors.productCard, 5000);
      if (!gridExists) {
        logger.warn('Product grid not found on category page', { url });
        return [];
      }

      // Scroll to load any lazy-loaded content
      await this.scrollToLoadContent();

      // Get all product cards
      const productCards = await this.page.$$(this.config.selectors.productCard);
      logger.debug(`Found ${productCards.length} product cards`, { url });

      // Extract data from each product card
      for (let i = 0; i < productCards.length; i++) {
        try {
          const card = productCards[i];
          
          // Extract product link
          const linkElement = await card.$(this.config.selectors.productLink);
          const productUrl = await linkElement?.getAttribute('href');
          
          if (!productUrl) {
            logger.debug(`No product URL found for card ${i}`, { categoryUrl: url });
            continue;
          }

          // Make URL absolute if it's relative
          const absoluteUrl = productUrl.startsWith('http') 
            ? productUrl 
            : `${this.config.baseUrl}${productUrl.startsWith('/') ? '' : '/'}${productUrl}`;

          // Extract product info from card (lightweight data)
          const title = await card.$eval(this.config.selectors.title, el => el.textContent?.trim()).catch(() => null);
          const currentPriceText = await card.$eval(this.config.selectors.currentPrice, el => el.textContent?.trim()).catch(() => null);
          const regularPriceText = await card.$eval(this.config.selectors.regularPrice || 'non-existent', el => el.textContent?.trim()).catch(() => null);
          const promoText = await card.$eval(this.config.selectors.promo || 'non-existent', el => el.textContent?.trim()).catch(() => null);
          const imageUrl = await card.$eval(this.config.selectors.image || 'img', el => el.getAttribute('src')).catch(() => null);

          if (!title || !currentPriceText) {
            logger.debug(`Missing essential data for product card ${i}`, { 
              title: !!title, 
              currentPrice: !!currentPriceText 
            });
            continue;
          }

          // Parse prices
          const priceResult = parsePrices(currentPriceText, regularPriceText, promoText);
          
          if (!validatePriceResult(priceResult) || !priceResult.currentPrice) {
            logger.debug(`Invalid price data for product ${i}`, { 
              currentPriceText, 
              regularPriceText 
            });
            continue;
          }

          // Create product object
          const product: Product = {
            retailer: 'petsmart',
            title: title,
            brand: this.extractBrandFromTitle(title),
            size_text: this.extractSizeFromTitle(title),
            current_price: priceResult.currentPrice.value,
            regular_price: priceResult.regularPrice?.value,
            percent_off: priceResult.discountPercent,
            promo_text: priceResult.promoText,
            product_url: absoluteUrl,
            image_url: imageUrl ? (imageUrl.startsWith('http') ? imageUrl : `${this.config.baseUrl}${imageUrl}`) : undefined,
            scraped_at: new Date().toISOString()
          };

          products.push(product);
          logger.debug(`Extracted product: ${title}`, { price: product.current_price });

        } catch (error) {
          logger.debug(`Error extracting product card ${i}`, {
            error: error instanceof Error ? error.message : String(error)
          });
          continue;
        }
      }

      logger.info(`Successfully extracted ${products.length} products from category page`, { url });
      return products;

    } catch (error) {
      logger.warn('Error scraping category page', {
        url,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Extract title from page text when selectors fail
   */
  private async extractTitleFromPageText(): Promise<string | null> {
    if (!this.page) return null;

    try {
      // Get the page title tag as fallback
      const pageTitle = await this.page.title();
      if (pageTitle && pageTitle.trim() && !pageTitle.toLowerCase().includes('petsmart')) {
        logger.debug('Extracted title from page title tag', { pageTitle });
        return pageTitle.trim();
      }

      return null;
    } catch (error) {
      logger.debug('Failed to extract title from page text', {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Extract regular price from page content (look for struck-through or "was" prices)
   */
  private async extractRegularPriceFromPage(): Promise<string | null> {
    if (!this.page) return null;

    try {
      // Look for all price patterns and try to identify the regular/original price
      const pageText = await this.page.textContent('body');
      if (!pageText) return null;

      // Look for price patterns with contextual clues
      const pricePatterns = [
        /(?:was|originally|regular|msrp|list)\s*:?\s*\$?(\d{1,4}(?:\.\d{2})?)/gi,
        /\$(\d{1,4}(?:\.\d{2})?)\s*(?:was|originally|regular|list)/gi,
      ];

      for (const pattern of pricePatterns) {
        const matches = [...pageText.matchAll(pattern)];
        if (matches.length > 0) {
          const price = matches[0][1];
          const numericValue = parseFloat(price);
          if (numericValue > 0.50 && numericValue < 1000) {
            logger.debug('Extracted regular price from page text', { 
              originalMatch: matches[0][0], 
              price,
              numericValue 
            });
            return `$${price}`;
          }
        }
      }

      // If no explicit "was" price found, look for multiple prices and take the higher one
      const allPriceMatches = pageText.match(/\$\d{1,4}(?:\.\d{2})?/g);
      if (allPriceMatches && allPriceMatches.length >= 2) {
        const prices = allPriceMatches
          .map(p => parseFloat(p.replace('$', '')))
          .filter(p => p > 0.50 && p < 1000)
          .sort((a, b) => b - a); // Sort descending

        if (prices.length >= 2 && prices[0] > prices[1]) {
          logger.debug('Extracted regular price as higher of multiple prices', { 
            allPrices: prices,
            selectedPrice: prices[0]
          });
          return `$${prices[0].toFixed(2)}`;
        }
      }

      return null;
    } catch (error) {
      logger.debug('Failed to extract regular price from page content', {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Extract price from page content using multiple strategies
   */
  private async extractPriceFromPage(): Promise<string | null> {
    if (!this.page) return null;

    try {
      // Look for price patterns in the page text
      const pageText = await this.page.textContent('body');
      if (!pageText) return null;

      // Common price patterns for PetSmart
      const pricePatterns = [
        /\$\d{1,4}(?:\.\d{2})?/g,  // $X.XX format
        /CAD?\s*\$?\d{1,4}(?:\.\d{2})?/g,  // CAD $X.XX format
      ];

      for (const pattern of pricePatterns) {
        const matches = pageText.match(pattern);
        if (matches && matches.length > 0) {
        // Collect all reasonable prices and prefer the lower one (current price)
        const validPrices: { price: string; value: number }[] = [];
        for (const match of matches) {
          const cleanPrice = match.replace(/[^$\d.]/g, '');
          const numericValue = parseFloat(cleanPrice.replace('$', ''));
          if (numericValue > 0.50 && numericValue < 1000) {
            validPrices.push({ price: cleanPrice, value: numericValue });
          }
        }
        
        if (validPrices.length > 0) {
          // Sort by value and take the lower price (likely current/sale price)
          validPrices.sort((a, b) => a.value - b.value);
          const selectedPrice = validPrices[0];
          
          logger.debug('Extracted current price from page text', { 
            allPrices: validPrices.map(p => p.price),
            selectedPrice: selectedPrice.price
          });
          return selectedPrice.price;
        }
        }
      }

      return null;
    } catch (error) {
      logger.debug('Failed to extract price from page content', {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Extract brand name from product title
   */
  private extractBrandFromTitle(title: string): string | undefined {
    const commonBrands = [
      'Authority', 'Hill\'s', 'Hills', 'Royal Canin', 'Purina', 'Blue Buffalo', 'Iams', 
      'Pedigree', 'Whiskas', 'Friskies', 'Wellness', 'Orijen', 'Acana',
      'Science Diet', 'Pro Plan', 'ONE', 'Fancy Feast', 'Sheba', 'Nutro',
      'Eukanuba', 'Cesar', 'Greenies', 'Dentastix'
    ];

    // Check for exact brand matches first
    for (const brand of commonBrands) {
      if (title.toLowerCase().includes(brand.toLowerCase())) {
        return brand;
      }
    }

    // Try to extract first word as brand if it looks like a brand name
    let firstWord = title.split(' ')[0].replace(/[®™©]/g, ''); // Remove trademark symbols
    
    // Clean up common patterns that get attached to brand names
    firstWord = firstWord.replace(/Item/gi, '').replace(/#.*/, '').trim();
    
    if (firstWord && firstWord.length > 2 && /^[A-Z]/.test(firstWord)) {
      return firstWord;
    }

    return undefined;
  }

  /**
   * Extract size information from product title
   */
  private extractSizeFromTitle(title: string): string | undefined {
    // Common size patterns for pet products
    const sizePatterns = [
      /(\d+(?:\.\d+)?\s*Oz)\b/i,  // "5.5 Oz" format
      /(\d+(?:\.\d+)?\s*oz)\b/i,  // "5.5 oz" format
      /(\d+(?:\.\d+)?\s*(?:kg|lb|g|lbs))\b/i,  // Weight formats
      /(\d+(?:\.\d+)?\s*(?:pound|ounce)s?)\b/i,  // Spelled out weights
      /(\d+\s*(?:count|ct|pack))\b/i,  // Count formats
      /(\d+(?:\.\d+)?[-\s]*(?:kg|lb|g|oz))\b/i,  // Hyphenated formats
      /(Size\s+\d+)/i,  // "Size 3" for diapers
      /(\d+(?:\.\d+)?\s*(?:fl\s*oz|ml|l))/i  // Liquid volumes
    ];

    for (const pattern of sizePatterns) {
      const match = title.match(pattern);
      if (match) {
        // Clean up the match - capitalize Oz properly
        let size = match[1].trim();
        size = size.replace(/\boz\b/i, 'Oz');  // Standardize to "Oz"
        size = size.replace(/\bg\b/i, 'g');    // Standardize grams
        size = size.replace(/\bkg\b/i, 'kg');  // Standardize kilograms
        return size;
      }
    }

    return undefined;
  }
}
