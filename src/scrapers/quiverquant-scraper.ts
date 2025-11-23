/**
 * QuiverQuant scraper implementation
 */

import { BaseScraper } from './base-scraper';
import { Product, ScrapingError } from '../types';
import { quiverquantConfig } from '../config/site-selectors';
import { logger } from '../utils/logger';

export class QuiverQuantScraper extends BaseScraper {
  constructor() {
    super(quiverquantConfig, 'quiverquant');
  }

  /**
   * Main scraping method - extracts trades from given URLs
   */
  async scrapeProducts(productUrls: string[]): Promise<{ products: Product[]; errors: ScrapingError[] }> {
    const products: Product[] = [];
    const errors: ScrapingError[] = [];

    for (const url of productUrls) {
      try {
        await this.rateLimit();
        
        logger.debug(`Scraping QuiverQuant URL: ${url}`);
        
        await this.navigateToUrl(url);
        
        const trades = await this.scrapeTrades(url);
        products.push(...trades);
        
        logger.info(`Extracted ${trades.length} trades from ${url}`, {
          retailer: 'quiverquant',
          url,
          tradeCount: trades.length
        });
        
      } catch (error) {
        const errorMessage = `Failed to scrape ${url}: ${error instanceof Error ? error.message : String(error)}`;
        logger.productExtractionFailed('quiverquant', url, errorMessage);
        errors.push(this.createScrapingError(errorMessage, url));
      }
    }

    return { products, errors };
  }

  /**
   * Scrape trades from the table
   */
  private async scrapeTrades(url: string): Promise<Product[]> {
    if (!this.page) return [];

    const products: Product[] = [];

    try {
      // Wait for table to load
      const tableExists = await this.waitForSelector(this.config.selectors.productCard, 10000);
      if (!tableExists) {
        logger.warn('Trading table not found', { url });
        return [];
      }

      // Get all row elements (groups of 6 <a> tags)
      // We select all <a> children of the table container
      const allRowElements = await this.page.$$(this.config.selectors.productCard);
      logger.info(`Found ${allRowElements.length} row elements`, { url });
      
      // Process elements
      let i = 0;
      while (i < allRowElements.length) {
        try {
          const element = allRowElements[i];
          const isTicker = await element.evaluate(el => el.classList.contains('ticker-link'));
          
          if (!isTicker) {
            i++;
            continue;
          }

          // Found start of row, ensure we have enough elements
          if (i + 5 >= allRowElements.length) break;

          const tickerEl = allRowElements[i];
          const transactionEl = allRowElements[i + 1];
          const filedDateEl = allRowElements[i + 2];
          const tradedDateEl = allRowElements[i + 3];
          
          // Extract data
          const tickerText = await tickerEl.textContent();
          const ticker = tickerText?.trim() || 'UNKNOWN';

          const transactionText = await transactionEl.textContent();
          const transactionType = transactionText?.includes('Purchase') ? 'Purchase' : 'Sale';
          
          // Amount is in the span inside the second element
          const amountEl = await transactionEl.$('span');
          const amountText = await amountEl?.textContent();
          const amount = amountText?.trim() || '';

          // Dates
          const filedDateText = await filedDateEl.textContent();
          const tradedDateText = await tradedDateEl.textContent();
          const date = tradedDateText?.trim() || filedDateText?.trim() || new Date().toISOString().split('T')[0];

          // Construct a title like "NVDA - Purchase - 2023-11-22"
          const title = `${ticker} - ${transactionType} - ${date}`;

          // Parse amount to get a "price" (using the lower bound of the range for sorting/tracking)
          let price = 0;
          if (amount) {
            const match = amount.match(/\$([\d,]+)/);
            if (match) {
              price = parseFloat(match[1].replace(/,/g, ''));
            }
          }

          // Generate unique ID for history tracking
          // Create a hash-like string from key attributes
          const idString = `${ticker}-${date}-${transactionType}-${amount}`;
          // Simple hash function for shorter IDs
          let hash = 0;
          for (let j = 0; j < idString.length; j++) {
            const char = idString.charCodeAt(j);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
          }
          const id = `qq-${Math.abs(hash).toString(16)}`;

          const product: Product = {
            retailer: 'quiverquant',
            title: title,
            brand: ticker,
            size_text: amount,
            current_price: price,
            regular_price: price,
            percent_off: 0,
            promo_text: transactionType,
            product_url: url,
            image_url: undefined,
            id: id,
            scraped_at: new Date().toISOString()
          };

          this.validateProduct(product);

          products.push(product);
          
          // Advance by 6 (size of a row)
          i += 6;

        } catch (error) {
          logger.debug(`Error extracting trade row at index ${i}`, {
            error: error instanceof Error ? error.message : String(error)
          });
          i++; // Skip one and try to find next ticker
          continue;
        }
      }

      return products;

    } catch (error) {
      logger.warn('Error scraping trades table', {
        url,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }
}
