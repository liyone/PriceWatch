/**
 * Shoppers Drug Mart scraper implementation
 * Extends BaseScraper with Shoppers-specific logic
 */

import { BaseScraper } from './base-scraper';
import { Product, ScrapingError } from '../types';
import { shoppersConfig } from '../config/site-selectors';
import { parsePrices } from '../utils/price-parser';
import { logger } from '../utils/logger';
import { ManualFallback } from '../utils/manual-fallback';

export class ShoppersScraper extends BaseScraper {
  private manualFallback?: ManualFallback;
  private enableManualFallback: boolean;

  constructor(enableManualFallback: boolean = false) {
    super(shoppersConfig, 'shoppers');
    this.enableManualFallback = enableManualFallback;
    if (enableManualFallback) {
      this.manualFallback = new ManualFallback();
    }
  }

  /**
   * Extract products from a category page
   */
  protected async extractProductCards(url: string): Promise<Product[]> {
    if (!this.page) return [];

    try {
      // Wait for product grid to load
      const hasProducts = await this.waitForSelector(this.config.selectors.productCard);
      if (!hasProducts) {
        logger.warn('Product grid not found on category page', { url });
        return [];
      }

      const productCards = await this.page.$$(this.config.selectors.productCard);
      const products: Product[] = [];

      for (const card of productCards) {
        try {
          const product = await this.parseProductCard(card, url);
          if (product) {
            products.push(product);
          }
        } catch (cardError) {
          logger.debug('Failed to parse product card', {
            error: cardError instanceof Error ? cardError.message : String(cardError),
            url
          });
        }
      }

      logger.info(`Extracted ${products.length} products from category page`, {
        retailer: this.retailerName,
        url,
        productCount: products.length
      });

      return products;
    } catch (error) {
      logger.error('Failed to extract product cards', {
        error: error instanceof Error ? error.message : String(error),
        url
      });
      return [];
    }
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
                        await this.waitForSelector('[data-testid="product-title"]', 5000);
      
      if (!pageLoaded) {
        logger.warn('Page content not loaded within timeout', { url });
        // Don't return null immediately - try to extract anyway
      }

      // Extract product information with multiple fallback strategies
      const title = await this.safeTextContent('h1') || 
                   await this.safeTextContent('.product-title, .product-name') ||
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
      
      let regularPriceText = await this.safeTextContent(this.config.selectors.regularPrice || '');
      logger.debug('Regular price from config selectors', { regularPriceText, selectors: this.config.selectors.regularPrice });
      
      if (!regularPriceText) {
        regularPriceText = await this.safeTextContent('.was-price, .original-price, .reg-price, .price-original');
        logger.debug('Regular price from fallback selectors', { regularPriceText });
      }
      
      if (!regularPriceText) {
        regularPriceText = await this.extractRegularPriceFromPage();
        logger.debug('Regular price from page extraction', { regularPriceText });
      }

      // Extract promotional text (including PC Points)
      const promoText = await this.safeTextContent(this.config.selectors.promo || '') ||
                       await this.safeTextContent('.promo, .badge, .points-text, .pc-points');

      // Extract additional info - prioritize title extraction over page elements
      const brand = this.extractBrandFromTitle(title) ||
                   await this.safeTextContent(this.config.selectors.brand || '');

      const sizeText = await this.safeTextContent(this.config.selectors.size || '') ||
                      this.extractSizeFromTitle(title);

      const imageUrl = await this.safeGetAttribute('img[src*="product"], .product-image img', 'src');

      // Parse prices using the price parsing utility
      const priceResult = parsePrices(currentPriceText, regularPriceText, promoText);

      const product: Product = {
        retailer: this.retailerName as 'shoppers',
        title: title.trim(),
        brand: brand || undefined,
        size_text: sizeText || undefined,
        current_price: priceResult.currentPrice?.value,
        regular_price: priceResult.regularPrice?.value,
        percent_off: priceResult.discountPercent,
        promo_text: priceResult.promoText || promoText || undefined,
        product_url: url,
        image_url: imageUrl || undefined,
        scraped_at: new Date().toISOString()
      };

      // Log the successful extraction
      logger.productExtracted(this.retailerName, url, product.current_price);
      
      return product;

    } catch (error) {
      logger.productExtractionFailed(this.retailerName, url, 
        error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Parse a product card from category page
   */
  private async parseProductCard(card: any, pageUrl: string): Promise<Product | null> {
    try {
      // Extract title
      const titleElement = await card.$(this.config.selectors.title);
      const title = titleElement ? await titleElement.textContent() : null;
      
      if (!title) return null;

      // Extract product URL
      const linkElement = await card.$(this.config.selectors.productLink);
      const href = linkElement ? await linkElement.getAttribute('href') : null;
      const productUrl = href ? 
        (href.startsWith('http') ? href : `${this.config.baseUrl}${href}`) : 
        pageUrl;

      // Extract current price
      const priceElement = await card.$(this.config.selectors.currentPrice);
      const currentPriceText = priceElement ? await priceElement.textContent() : null;

      // Extract regular price
      const regularPriceElement = await card.$(this.config.selectors.regularPrice || '');
      const regularPriceText = regularPriceElement ? await regularPriceElement.textContent() : null;

      // Extract promotional text
      const promoElement = await card.$(this.config.selectors.promo || '');
      const promoText = promoElement ? await promoElement.textContent() : null;

      // Parse prices
      const priceResult = parsePrices(currentPriceText, regularPriceText, promoText);

      return {
        retailer: this.retailerName as 'shoppers',
        title: title.trim(),
        brand: this.extractBrandFromTitle(title),
        size_text: this.extractSizeFromTitle(title),
        current_price: priceResult.currentPrice?.value,
        regular_price: priceResult.regularPrice?.value,
        percent_off: priceResult.discountPercent,
        promo_text: priceResult.promoText || promoText || undefined,
        product_url: productUrl,
        image_url: undefined, // Category cards may not have reliable images
        scraped_at: new Date().toISOString()
      };

    } catch (error) {
      logger.debug('Failed to parse product card', {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Implementation of abstract scrapeProducts method
   */
  async scrapeProducts(productUrls: string[]): Promise<{ products: Product[]; errors: ScrapingError[] }> {
    const products: Product[] = [];
    const errors: ScrapingError[] = [];

    for (const url of productUrls) {
      try {
        const product = await this.scrapeUrl(url);
        if (product) {
          products.push(product);
        } else if (this.enableManualFallback && this.manualFallback) {
          // Automated scraping failed, try manual fallback
          logger.warn('Automated scraping failed, attempting manual fallback', {
            retailer: this.retailerName,
            url
          });
          
          const shouldUseFallback = await this.manualFallback.shouldUseManualFallback(url, this.retailerName);
          if (shouldUseFallback) {
            const manualProduct = await this.manualFallback.promptForProductData(url, this.retailerName);
            if (manualProduct) {
              products.push(manualProduct);
              logger.info('Manual fallback successful', {
                retailer: this.retailerName,
                url,
                title: manualProduct.title
              });
            }
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Scraping attempt failed completely', {
          retailer: this.retailerName,
          url,
          error: errorMessage
        });

        // Try manual fallback for critical errors too
        if (this.enableManualFallback && this.manualFallback) {
          try {
            const shouldUseFallback = await this.manualFallback.shouldUseManualFallback(url, this.retailerName);
            if (shouldUseFallback) {
              const manualProduct = await this.manualFallback.promptForProductData(url, this.retailerName);
              if (manualProduct) {
                products.push(manualProduct);
                continue; // Skip adding to errors since we got manual data
              }
            }
          } catch (fallbackError) {
            logger.error('Manual fallback also failed', {
              retailer: this.retailerName,
              url,
              fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
            });
          }
        }

        errors.push(this.createScrapingError(
          errorMessage,
          url,
          'error'
        ));
      }
    }

    // Clean up manual fallback resources
    if (this.manualFallback) {
      this.manualFallback.close();
    }

    return { products, errors };
  }

  /**
   * Main scraping method - determines page type and extracts accordingly
   */
  private async scrapeUrl(url: string): Promise<Product | null> {
    try {
      logger.debug(`Scraping Shoppers URL: ${url}`);
      
      // Navigate to the product page or category page
      await this.navigateToUrl(url);
      
      // Check if this is a category page (multiple products) or single product page
      // Shoppers product URLs typically contain "/p/" like "/p/BB_056796906606"
      const isProductPage = url.includes('/p/') || /\/p\/[A-Z0-9_]+/i.test(url);
      
      if (isProductPage) {
        // Single product page
        const product = await this.scrapeSingleProduct(url);
        if (product) {
          return product;
        }
      } else {
        // Category page - extract first few products
        const products = await this.extractProductCards(url);
        if (products.length > 0) {
          // For category pages, return the first product as an example
          return products[0];
        }
      }

      return null;
    } catch (error) {
      logger.error(`Failed to scrape Shoppers URL: ${url}`, {
        error: error instanceof Error ? error.message : String(error),
        url
      });
      return null;
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
      if (pageTitle && pageTitle.trim() && !pageTitle.toLowerCase().includes('shoppers')) {
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
      // Get all text content and log for debugging
      const pageText = await this.page.textContent('body');
      if (!pageText) return null;

      // Log all price patterns found on the page for debugging
      const allPriceMatches = pageText.match(/\$\d{1,4}(?:\.\d{2})?/g);
      logger.debug('All prices found on page', { allPriceMatches });

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

      // Look for product-specific price pairs (current price + regular price)
      if (allPriceMatches && allPriceMatches.length >= 2) {
        const prices = allPriceMatches
          .map(p => parseFloat(p.replace('$', '')))
          .filter(p => p > 0.50 && p < 1000);

        // Count frequency of each price to identify prominent product prices
        const priceFrequency = new Map<number, number>();
        prices.forEach(price => {
          priceFrequency.set(price, (priceFrequency.get(price) || 0) + 1);
        });

        // Get prices that appear multiple times (likely product prices)
        const frequentPrices = Array.from(priceFrequency.entries())
          .filter(([_, count]) => count >= 2)
          .map(([price, count]) => ({ price, count }))
          .sort((a, b) => b.price - a.price);

        logger.debug('Price frequency analysis', { 
          priceFrequency: Object.fromEntries(priceFrequency),
          frequentPrices: frequentPrices
        });

        // CONSERVATIVE approach: Only find regular price if there are EXACTLY 2 reasonable product prices
        const reasonableProductPrices = frequentPrices.filter(p => 
          p.price > 1 && p.price < 200 && p.count >= 2  // Product prices for baby formula/drugs can be higher than $50
        );

        if (reasonableProductPrices.length === 2) {
          const higherPrice = reasonableProductPrices[0].price;
          const lowerPrice = reasonableProductPrices[1].price;
          
          // Calculate discount percentage
          const discountPercent = ((higherPrice - lowerPrice) / higherPrice) * 100;
          
          // Only proceed if it's a reasonable discount (5-60%) 
          if (discountPercent >= 5 && discountPercent <= 60) {
            logger.debug('Found EXACTLY 2 reasonable product prices with valid discount', { 
              higherPrice,
              lowerPrice,
              discountPercent: discountPercent.toFixed(1),
              higherCount: reasonableProductPrices[0].count,
              lowerCount: reasonableProductPrices[1].count
            });
            return `$${higherPrice.toFixed(2)}`;
          }
        }

        logger.debug('No valid regular price found - product likely not discounted', {
          reasonableProductPrices: reasonableProductPrices.map(p => ({ price: p.price, count: p.count }))
        });
      }

      // Try to look for CSS-styled strikethrough elements
      try {
        const strikethroughElements = await this.page.$$('*[style*="text-decoration: line-through"], .strike-through, .crossed-out');
        for (const element of strikethroughElements) {
          const text = await element.textContent();
          if (text) {
            const priceMatch = text.match(/\$?\d{1,4}(?:\.\d{2})?/);
            if (priceMatch) {
              const price = parseFloat(priceMatch[0].replace('$', ''));
              if (price > 0.50 && price < 1000) {
                logger.debug('Found strikethrough price', { text, price });
                return `$${price.toFixed(2)}`;
              }
            }
          }
        }
      } catch (elementError) {
        logger.debug('Error searching for strikethrough elements', { elementError });
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

      // Common price patterns for Shoppers
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
      'Enfamil', 'Similac', 'Gerber', 'Nestle', 'Huggies', 'Pampers', 'Johnson\'s', 
      'Aveeno', 'Cetaphil', 'Neutrogena', 'L\'Oreal', 'Maybelline', 'CoverGirl',
      'Tylenol', 'Advil', 'Reactine', 'Claritin', 'Benadryl', 'Pepto-Bismol',
      'Olay', 'Dove', 'Head & Shoulders', 'Pantene', 'Herbal Essences'
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
    // Common size patterns for baby formula, diapers, and personal care products
    const sizePatterns = [
      /(\d+(?:\.\d+)?\s*(?:ml|mL|L|l))\b/i,  // Liquid volumes
      /(\d+(?:\.\d+)?\s*(?:g|kg|oz|lb|lbs))\b/i,  // Weight formats
      /(\d+\s*(?:count|ct|pack))\b/i,  // Count formats
      /(Size\s+\d+(?:-\d+)?)\b/i,  // "Size 1", "Size 2-3" for diapers
      /(\d+(?:\.\d+)?\s*(?:fl\s*oz|fluid\s*ounce)s?)\b/i,  // Fluid ounces
      /(\d+(?:\.\d+)?x\d+(?:\.\d+)?\s*(?:ml|mL|oz))\b/i,  // Multi-pack formats like "6x240ml"
      /(Ready\s+to\s+Feed)/i,  // Ready to feed format
      /(Powder)/i,  // Powder format
    ];

    for (const pattern of sizePatterns) {
      const match = title.match(pattern);
      if (match) {
        let size = match[1].trim();
        // Standardize common abbreviations
        size = size.replace(/\bml\b/i, 'mL');
        size = size.replace(/\bl\b/i, 'L');
        size = size.replace(/\bg\b/i, 'g');
        size = size.replace(/\bkg\b/i, 'kg');
        return size;
      }
    }

    return undefined;
  }
}
