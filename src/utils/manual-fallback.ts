/**
 * Manual fallback utility for when automated scraping fails
 * Provides prompts for manual data entry
 */

import { Product } from '../types';
import { logger } from './logger';
import * as readline from 'readline';

export class ManualFallback {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  /**
   * Prompt user to manually enter product information
   */
  async promptForProductData(url: string, retailer: string): Promise<Product | null> {
    try {
      console.log('\n' + '='.repeat(60));
      console.log(`🚫 AUTOMATED SCRAPING FAILED FOR: ${retailer.toUpperCase()}`);
      console.log(`📄 URL: ${url}`);
      console.log('='.repeat(60));
      console.log('📝 Please manually visit the URL and enter the product information:');
      console.log('   (Press Enter to skip any field, or type "skip" to skip this product)\n');

      const title = await this.promptForField('Product Title');
      if (title === 'skip') return null;

      const currentPrice = await this.promptForField('Current Price (e.g., 12.99)');
      if (currentPrice === 'skip') return null;

      const regularPrice = await this.promptForField('Regular Price (leave empty if no discount)');
      const brand = await this.promptForField('Brand');
      const sizeText = await this.promptForField('Size/Weight (e.g., 500ml, 12 count)');
      const promoText = await this.promptForField('Promotion Text (e.g., save 20%, points offer)');

      // Parse the prices
      const currentPriceValue = currentPrice ? parseFloat(currentPrice.replace(/[^0-9.]/g, '')) : undefined;
      const regularPriceValue = regularPrice ? parseFloat(regularPrice.replace(/[^0-9.]/g, '')) : undefined;
      
      let percentOff: number | undefined;
      if (currentPriceValue && regularPriceValue && regularPriceValue > currentPriceValue) {
        percentOff = Math.round(((regularPriceValue - currentPriceValue) / regularPriceValue) * 100);
      }

      const product: Product = {
        retailer: retailer as any,
        title: title || 'Manual Entry',
        brand: brand || undefined,
        size_text: sizeText || undefined,
        current_price: currentPriceValue,
        regular_price: regularPriceValue,
        percent_off: percentOff,
        promo_text: promoText || undefined,
        product_url: url,
        image_url: undefined,
        scraped_at: new Date().toISOString()
      };

      console.log('\n✅ Product data entered successfully!');
      console.log('📊 Product Summary:', JSON.stringify(product, null, 2));

      const confirm = await this.promptForField('Looks correct? (y/n)', 'y');
      if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes' || confirm === '') {
        logger.info('Manual product data entry completed', {
          retailer,
          url,
          title: product.title,
          current_price: product.current_price
        });
        return product;
      } else {
        console.log('❌ Product entry cancelled by user');
        return null;
      }

    } catch (error) {
      logger.error('Manual fallback failed', {
        error: error instanceof Error ? error.message : String(error),
        url,
        retailer
      });
      return null;
    }
  }

  /**
   * Prompt user for a specific field
   */
  private async promptForField(fieldName: string, defaultValue: string = ''): Promise<string> {
    return new Promise((resolve) => {
      const prompt = defaultValue 
        ? `${fieldName} [${defaultValue}]: `
        : `${fieldName}: `;
      
      this.rl.question(prompt, (answer) => {
        resolve(answer.trim() || defaultValue);
      });
    });
  }

  /**
   * Ask user if they want to use manual fallback
   */
  async shouldUseManualFallback(url: string, retailer: string): Promise<boolean> {
    return new Promise((resolve) => {
      console.log(`\n⚠️  Automated scraping failed for ${retailer}: ${url}`);
      this.rl.question('Do you want to enter the product data manually? (y/n) [n]: ', (answer) => {
        const response = answer.trim().toLowerCase();
        resolve(response === 'y' || response === 'yes');
      });
    });
  }

  /**
   * Close the readline interface
   */
  close(): void {
    this.rl.close();
  }
}
