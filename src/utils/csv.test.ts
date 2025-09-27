/**
 * Tests for CSV utility functions
 */

import * as fs from 'fs';
import * as path from 'path';
import { Product } from '../types';
import {
  productToCSVRow,
  generateCSVFilename,
  writeProductsToCSV,
  readProductsFromCSV,
  getTodaysCSVPath
} from './csv';

// Test data
const mockProducts: Product[] = [
  {
    retailer: 'petsmart',
    title: "Hill's Science Diet Adult 7kg",
    brand: "Hill's",
    size_text: '7kg',
    current_price: 89.99,
    regular_price: 109.99,
    percent_off: 18,
    promo_text: 'Save 20%',
    product_url: 'https://www.petsmart.ca/test-product-1',
    image_url: 'https://www.petsmart.ca/test-image-1.jpg',
    scraped_at: '2025-09-27T14:30:00Z'
  },
  {
    retailer: 'petvalu',
    title: 'Royal Canin Medium Adult',
    current_price: 64.99,
    product_url: 'https://www.petvalu.ca/test-product-2',
    scraped_at: '2025-09-27T14:31:00Z'
  }
];

const testDir = 'test-data';

// Clean up test files before and after tests
beforeEach(() => {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true });
  }
});

afterEach(() => {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true });
  }
});

describe('CSV Utilities', () => {
  describe('productToCSVRow', () => {
    test('should convert product with all fields to CSV row', () => {
      const product = mockProducts[0];
      const csvRow = productToCSVRow(product);
      
      expect(csvRow.retailer).toBe('petsmart');
      expect(csvRow.product_title).toBe("Hill's Science Diet Adult 7kg");
      expect(csvRow.brand).toBe("Hill's");
      expect(csvRow.current_price).toBe('89.99');
      expect(csvRow.regular_price).toBe('109.99');
      expect(csvRow.percent_off).toBe('18');
    });

    test('should handle product with missing optional fields', () => {
      const product = mockProducts[1];
      const csvRow = productToCSVRow(product);
      
      expect(csvRow.retailer).toBe('petvalu');
      expect(csvRow.brand).toBe('');
      expect(csvRow.regular_price).toBe('');
      expect(csvRow.percent_off).toBe('');
    });
  });

  describe('generateCSVFilename', () => {
    test('should generate filename with correct format', () => {
      const date = new Date(2025, 8, 27); // Month is 0-indexed, so 8 = September
      const filename = generateCSVFilename(date);
      expect(filename).toBe('deals_20250927.csv');
    });

    test('should pad month and day with zeros', () => {
      const date = new Date(2025, 0, 5); // January 5
      const filename = generateCSVFilename(date);
      expect(filename).toBe('deals_20250105.csv');
    });
  });

  describe('writeProductsToCSV', () => {
    test('should write products to CSV file successfully', async () => {
      const filename = path.join(testDir, 'test_deals.csv');
      
      const resultPath = await writeProductsToCSV(mockProducts, filename);
      
      expect(resultPath).toBe(filename);
      expect(fs.existsSync(filename)).toBe(true);
      
      // Verify file content
      const content = fs.readFileSync(filename, 'utf8');
      expect(content).toContain('retailer,product_title');
      expect(content).toContain('petsmart');
      expect(content).toContain("Hill's Science Diet Adult 7kg");
    });

    test('should create directory if it does not exist', async () => {
      const filename = path.join(testDir, 'subdir', 'test_deals.csv');
      
      await writeProductsToCSV(mockProducts, filename);
      
      expect(fs.existsSync(filename)).toBe(true);
    });
  });

  describe('readProductsFromCSV', () => {
    test('should read products from CSV file correctly', async () => {
      const filename = path.join(testDir, 'test_deals.csv');
      
      // First write the file
      await writeProductsToCSV(mockProducts, filename);
      
      // Then read it back
      const products = await readProductsFromCSV(filename);
      
      expect(products).toHaveLength(2);
      expect(products[0].retailer).toBe('petsmart');
      expect(products[0].title).toBe("Hill's Science Diet Adult 7kg");
      expect(products[0].current_price).toBe(89.99);
      expect(products[1].retailer).toBe('petvalu');
    });

    test('should return empty array for non-existent file', async () => {
      const products = await readProductsFromCSV('non-existent.csv');
      expect(products).toEqual([]);
    });
  });

  describe('getTodaysCSVPath', () => {
    test('should return correct path for today', () => {
      const today = new Date();
      const expectedFilename = generateCSVFilename(today);
      const result = getTodaysCSVPath(testDir);
      
      expect(result).toBe(path.join(testDir, expectedFilename));
    });
  });
});
