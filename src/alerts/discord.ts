/**
 * Discord webhook integration for deal notifications
 */

import { Product } from '../types';
import { logger } from '../utils/logger';
import * as https from 'https';
import * as http from 'http';

export interface DiscordMessage {
  content?: string;
  embeds?: DiscordEmbed[];
  username?: string;
  avatar_url?: string;
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: DiscordField[];
  footer?: {
    text: string;
    icon_url?: string;
  };
  timestamp?: string;
  thumbnail?: {
    url: string;
  };
  url?: string;
}

export interface DiscordField {
  name: string;
  value: string;
  inline?: boolean;
}

export class DiscordAlert {
  private webhookUrl: string;
  private deduplicationCache: Set<string> = new Set();
  private deduplicationHours: number;

  constructor(webhookUrl: string, deduplicationHours: number = 24) {
    this.webhookUrl = webhookUrl;
    this.deduplicationHours = deduplicationHours;
  }

  /**
   * Send alert for products with qualifying discounts
   */
  async sendDealsAlert(products: Product[], minDiscountPercent: number = 20): Promise<void> {
    try {
      const qualifyingDeals = products.filter(product => 
        product.percent_off !== undefined && 
        product.percent_off >= minDiscountPercent
      );

      if (qualifyingDeals.length === 0) {
        logger.debug('No qualifying deals found for Discord alert', {
          totalProducts: products.length,
          minDiscountPercent
        });
        return;
      }

      // Filter out duplicates
      const newDeals = qualifyingDeals.filter(deal => 
        !this.isDuplicate(deal)
      );

      if (newDeals.length === 0) {
        logger.debug('All deals are duplicates, skipping Discord alert', {
          qualifyingDeals: qualifyingDeals.length
        });
        return;
      }

      // Mark deals as sent to prevent duplicates
      newDeals.forEach(deal => this.markAsSent(deal));

      // Send alerts in batches (Discord has embed limits)
      const batches = this.batchDeals(newDeals, 10); // Max 10 embeds per message
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const isFirstBatch = i === 0;
        const message = this.createDealsMessage(batch, isFirstBatch, batches.length > 1 ? i + 1 : undefined);
        
        await this.sendMessage(message);
        
        // Small delay between batches to avoid rate limits
        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      logger.alertSent('discord', `${newDeals.length} deals`, newDeals[0]?.percent_off || 0);
      
    } catch (error) {
      logger.error('Failed to send Discord deals alert', {
        error: error instanceof Error ? error.message : String(error),
        productsCount: products.length
      });
      throw error;
    }
  }

  /**
   * Send error notification to Discord
   */
  async sendErrorAlert(errorMessage: string, context?: Record<string, any>): Promise<void> {
    try {
      const message: DiscordMessage = {
        embeds: [{
          title: '🚨 PriceWatch Scraper Error',
          description: errorMessage,
          color: 0xFF0000, // Red
          fields: context ? Object.entries(context).map(([key, value]) => ({
            name: key,
            value: String(value),
            inline: true
          })) : undefined,
          footer: {
            text: 'PriceWatch Error Alert'
          },
          timestamp: new Date().toISOString()
        }]
      };

      await this.sendMessage(message);
      logger.info('Error alert sent to Discord', { errorMessage });
      
    } catch (error) {
      logger.error('Failed to send Discord error alert', {
        error: error instanceof Error ? error.message : String(error),
        originalError: errorMessage
      });
    }
  }

  /**
   * Send summary notification
   */
  async sendSummaryAlert(summary: {
    totalProducts: number;
    successfulScrapes: number;
    errors: number;
    dealsFound: number;
    executionTimeMs: number;
    csvFile: string;
    csvUrl?: string;
  }): Promise<void> {
    try {
      const embed: DiscordEmbed = {
        title: '📊 PriceWatch Scraping Summary',
        color: summary.errors > 0 ? 0xFFAA00 : 0x00FF00, // Orange if errors, green if success
        fields: [
          {
            name: '📦 Products Scraped',
            value: `${summary.successfulScrapes}/${summary.totalProducts}`,
            inline: true
          },
          {
            name: '🎯 Deals Found',
            value: summary.dealsFound.toString(),
            inline: true
          },
          {
            name: '⚡ Execution Time',
            value: `${(summary.executionTimeMs / 1000).toFixed(1)}s`,
            inline: true
          },
          {
            name: '📄 CSV File',
            value: summary.csvUrl ? `[${summary.csvFile}](${summary.csvUrl})` : summary.csvFile,
            inline: false
          }
        ],
        footer: {
          text: 'PriceWatch Summary'
        },
        timestamp: new Date().toISOString()
      };

      if (summary.errors > 0) {
        embed.fields?.push({
          name: '⚠️ Errors',
          value: summary.errors.toString(),
          inline: true
        });
      }

      const message: DiscordMessage = {
        content: summary.dealsFound > 0 ? `🎉 Found ${summary.dealsFound} new deals!` : undefined,
        embeds: [embed]
      };

      await this.sendMessage(message);
      logger.info('Summary alert sent to Discord', summary);
      
    } catch (error) {
      logger.error('Failed to send Discord summary alert', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Create rich message for deals
   */
  private createDealsMessage(deals: Product[], isFirstBatch: boolean, batchNumber?: number): DiscordMessage {
    const embeds: DiscordEmbed[] = deals.map(deal => {
      const embed: DiscordEmbed = {
        title: `🏷️ ${deal.title}`,
        color: this.getDiscountColor(deal.percent_off || 0),
        fields: [
          {
            name: '💰 Current Price',
            value: `$${deal.current_price?.toFixed(2)}`,
            inline: true
          },
          {
            name: '🏪 Retailer',
            value: deal.retailer.charAt(0).toUpperCase() + deal.retailer.slice(1),
            inline: true
          }
        ],
        footer: {
          text: 'PriceWatch Deal Alert'
        },
        timestamp: deal.scraped_at,
        url: deal.product_url
      };

      // Add regular price and discount if available
      if (deal.regular_price && deal.percent_off) {
        embed.fields?.splice(1, 0, {
          name: '🔥 Discount',
          value: `${deal.percent_off}% OFF`,
          inline: true
        });
        
        embed.fields?.push({
          name: '📉 Was',
          value: `$${deal.regular_price.toFixed(2)}`,
          inline: true
        });
        
        embed.description = `**Save $${(deal.regular_price - deal.current_price!).toFixed(2)}**`;
      }

      // Add brand and size if available
      if (deal.brand) {
        embed.fields?.push({
          name: '🏭 Brand',
          value: deal.brand,
          inline: true
        });
      }

      if (deal.size_text) {
        embed.fields?.push({
          name: '📏 Size',
          value: deal.size_text,
          inline: true
        });
      }

      // Add promo text if available
      if (deal.promo_text) {
        embed.fields?.push({
          name: '🎁 Promotion',
          value: deal.promo_text,
          inline: false
        });
      }

      // Add thumbnail if image available
      if (deal.image_url) {
        embed.thumbnail = {
          url: deal.image_url
        };
      }

      return embed;
    });

    const message: DiscordMessage = {
      embeds
    };

    // Add header message for first batch
    if (isFirstBatch) {
      const dealCount = deals.length;
      const emojis = ['🎉', '💰', '🔥', '⚡'];
      const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
      
      message.content = `${randomEmoji} **New Deal${dealCount > 1 ? 's' : ''} Alert!** Found ${dealCount} qualifying deal${dealCount > 1 ? 's' : ''}`;
      
      if (batchNumber) {
        message.content += ` (Batch ${batchNumber})`;
      }
    }

    return message;
  }

  /**
   * Get color based on discount percentage
   */
  private getDiscountColor(discountPercent: number): number {
    if (discountPercent >= 50) return 0xFF0000; // Red - amazing deal
    if (discountPercent >= 30) return 0xFF6600; // Orange - great deal
    if (discountPercent >= 20) return 0xFFAA00; // Yellow - good deal
    return 0x00AA00; // Green - decent deal
  }

  /**
   * Split deals into batches for Discord's embed limits
   */
  private batchDeals(deals: Product[], batchSize: number): Product[][] {
    const batches: Product[][] = [];
    for (let i = 0; i < deals.length; i += batchSize) {
      batches.push(deals.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Check if deal is duplicate (already sent recently)
   */
  private isDuplicate(deal: Product): boolean {
    const key = this.getDuplicationKey(deal);
    return this.deduplicationCache.has(key);
  }

  /**
   * Mark deal as sent to prevent duplicates
   */
  private markAsSent(deal: Product): void {
    const key = this.getDuplicationKey(deal);
    this.deduplicationCache.add(key);
    
    // Schedule removal after deduplication period
    setTimeout(() => {
      this.deduplicationCache.delete(key);
    }, this.deduplicationHours * 60 * 60 * 1000);
  }

  /**
   * Generate unique key for deal deduplication
   */
  private getDuplicationKey(deal: Product): string {
    return `${deal.retailer}-${deal.product_url}-${deal.current_price}`;
  }

  /**
   * Send message to Discord webhook
   */
  private async sendMessage(message: DiscordMessage): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const url = new URL(this.webhookUrl);
        const postData = JSON.stringify(message);
        
        const options = {
          hostname: url.hostname,
          port: url.port || 443,
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
            'User-Agent': 'PriceWatch-Scraper/1.0'
          }
        };

        const client = url.protocol === 'https:' ? https : http;
        const req = client.request(options, (res) => {
          let responseData = '';
          
          res.on('data', (chunk) => {
            responseData += chunk;
          });
          
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              logger.debug('Discord message sent successfully', {
                statusCode: res.statusCode,
                embeds: message.embeds?.length || 0,
                hasContent: !!message.content
              });
              resolve();
            } else {
              reject(new Error(`Discord webhook failed: ${res.statusCode} - ${responseData}`));
            }
          });
        });

        req.on('error', (error) => {
          reject(error);
        });

        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Discord webhook request timeout'));
        });

        req.setTimeout(10000); // 10 second timeout
        req.write(postData);
        req.end();
        
      } catch (error) {
        logger.error('Failed to send Discord message', {
          error: error instanceof Error ? error.message : String(error),
          webhookUrl: this.webhookUrl.replace(/\/[^\/]+$/, '/***') // Hide webhook token
        });
        reject(error);
      }
    });
  }
}

/**
 * Factory function to create Discord alert instance
 */
export function createDiscordAlert(webhookUrl?: string, deduplicationHours: number = 24): DiscordAlert | null {
  if (!webhookUrl) {
    logger.warn('Discord webhook URL not provided, alerts disabled');
    return null;
  }

  if (!webhookUrl.includes('discord.com/api/webhooks/')) {
    logger.error('Invalid Discord webhook URL format');
    return null;
  }

  return new DiscordAlert(webhookUrl, deduplicationHours);
}
