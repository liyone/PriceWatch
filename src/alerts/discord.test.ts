/**
 * Tests for Discord webhook integration
 */

import { DiscordAlert, createDiscordAlert } from './discord';
import { Product } from '../types';

describe('Discord Alert', () => {
  const mockWebhookUrl = 'https://discord.com/api/webhooks/123/mock-webhook';
  
  describe('createDiscordAlert', () => {
    test('should create Discord alert with valid webhook URL', () => {
      const alert = createDiscordAlert(mockWebhookUrl);
      expect(alert).toBeInstanceOf(DiscordAlert);
    });

    test('should return null for undefined webhook URL', () => {
      const alert = createDiscordAlert(undefined);
      expect(alert).toBeNull();
    });

    test('should return null for invalid webhook URL', () => {
      const alert = createDiscordAlert('https://invalid-url.com');
      expect(alert).toBeNull();
    });
  });

  describe('DiscordAlert', () => {
    let alert: DiscordAlert;
    
    beforeEach(() => {
      alert = new DiscordAlert(mockWebhookUrl, 1); // 1 hour deduplication for testing
    });

    test('should create message for qualifying deals', async () => {
      const mockProducts: Product[] = [
        {
          retailer: 'petsmart',
          title: 'Test Pet Food',
          brand: 'TestBrand',
          size_text: '5kg',
          current_price: 24.99,
          regular_price: 34.99,
          percent_off: 29,
          promo_text: 'Save $10',
          product_url: 'https://example.com/product',
          image_url: 'https://example.com/image.jpg',
          scraped_at: new Date().toISOString()
        }
      ];

      // Mock the private sendMessage method to avoid actual HTTP calls
      const sendMessageSpy = jest.spyOn(alert as any, 'sendMessage');
      sendMessageSpy.mockResolvedValue(undefined);

      await alert.sendDealsAlert(mockProducts, 20);

      expect(sendMessageSpy).toHaveBeenCalledTimes(1);
      const messageArg = sendMessageSpy.mock.calls[0][0] as any;
      
      expect(messageArg.content).toContain('New Deal Alert');
      expect(messageArg.embeds).toHaveLength(1);
      expect(messageArg.embeds[0].title).toBe('🏷️ Test Pet Food');
      expect(messageArg.embeds[0].fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: '💰 Current Price', value: '$24.99' }),
          expect.objectContaining({ name: '🔥 Discount', value: '29% OFF' }),
          expect.objectContaining({ name: '🏪 Retailer', value: 'Petsmart' })
        ])
      );

      sendMessageSpy.mockRestore();
    });

    test('should not send alert for deals below threshold', async () => {
      const mockProducts: Product[] = [
        {
          retailer: 'petsmart',
          title: 'Test Pet Food',
          current_price: 29.99,
          regular_price: 34.99,
          percent_off: 15, // Below 20% threshold
          product_url: 'https://example.com/product',
          scraped_at: new Date().toISOString()
        }
      ];

      const sendMessageSpy = jest.spyOn(alert as any, 'sendMessage');
      sendMessageSpy.mockResolvedValue(undefined);

      await alert.sendDealsAlert(mockProducts, 20);

      expect(sendMessageSpy).not.toHaveBeenCalled();
      sendMessageSpy.mockRestore();
    });

    test('should handle deduplication correctly', async () => {
      const mockProduct: Product = {
        retailer: 'petsmart',
        title: 'Test Pet Food',
        current_price: 24.99,
        regular_price: 34.99,
        percent_off: 29,
        product_url: 'https://example.com/product',
        scraped_at: new Date().toISOString()
      };

      const sendMessageSpy = jest.spyOn(alert as any, 'sendMessage');
      sendMessageSpy.mockResolvedValue(undefined);

      // Send first alert
      await alert.sendDealsAlert([mockProduct], 20);
      expect(sendMessageSpy).toHaveBeenCalledTimes(1);

      // Send same product again - should be deduplicated
      await alert.sendDealsAlert([mockProduct], 20);
      expect(sendMessageSpy).toHaveBeenCalledTimes(1); // Still only 1 call

      sendMessageSpy.mockRestore();
    });

    test('should send error alert', async () => {
      const sendMessageSpy = jest.spyOn(alert as any, 'sendMessage');
      sendMessageSpy.mockResolvedValue(undefined);

      await alert.sendErrorAlert('Test error message', { context: 'test' });

      expect(sendMessageSpy).toHaveBeenCalledTimes(1);
      const messageArg = sendMessageSpy.mock.calls[0][0] as any;
      
      expect(messageArg.embeds[0].title).toBe('🚨 PriceWatch Scraper Error');
      expect(messageArg.embeds[0].description).toBe('Test error message');
      expect(messageArg.embeds[0].color).toBe(0xFF0000); // Red

      sendMessageSpy.mockRestore();
    });

    test('should send summary alert', async () => {
      const summary = {
        totalProducts: 10,
        successfulScrapes: 8,
        errors: 2,
        dealsFound: 3,
        executionTimeMs: 5000,
        csvFile: 'deals_20250927.csv'
      };

      const sendMessageSpy = jest.spyOn(alert as any, 'sendMessage');
      sendMessageSpy.mockResolvedValue(undefined);

      await alert.sendSummaryAlert(summary);

      expect(sendMessageSpy).toHaveBeenCalledTimes(1);
      const messageArg = sendMessageSpy.mock.calls[0][0] as any;
      
      expect(messageArg.content).toContain('Found 3 new deals');
      expect(messageArg.embeds[0].title).toBe('📊 PriceWatch Scraping Summary');
      expect(messageArg.embeds[0].color).toBe(0xFFAA00); // Orange (has errors)

      sendMessageSpy.mockRestore();
    });
  });
});
