/**
 * CSV utility functions for writing scraped data
 */

import * as fs from 'fs';
import * as path from 'path';
import { format, parse } from 'fast-csv';
import { Product, CSVRow } from '../types';

/**
 * Converts Product objects to CSV-compatible rows
 */
export function productToCSVRow(product: Product): CSVRow {
  return {
    retailer: product.retailer,
    product_title: product.title,
    brand: product.brand || '',
    size_text: product.size_text || '',
    current_price: product.current_price?.toFixed(2) || '',
    regular_price: product.regular_price?.toFixed(2) || '',
    percent_off: product.percent_off?.toString() || '',
    promo_text: product.promo_text || '',
    product_url: product.product_url,
    image_url: product.image_url || '',
    scraped_at: product.scraped_at
  };
}

/**
 * Generates filename for CSV output based on current date
 */
export function generateCSVFilename(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `deals_${year}${month}${day}.csv`;
}

/**
 * Ensures the output directory exists
 */
export function ensureDataDirectory(dataDir: string): void {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

/**
 * Writes products to CSV file with standardized format
 */
export async function writeProductsToCSV(
  products: Product[],
  outputPath?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Use provided path or generate default
      const filename = outputPath || generateCSVFilename();
      const dataDir = path.dirname(filename);
      
      // Ensure directory exists
      ensureDataDirectory(dataDir);
      
      // Convert products to CSV rows
      const csvRows = products.map(productToCSVRow);
      
      // Define CSV headers
      const headers = [
        'retailer',
        'product_title', 
        'brand',
        'size_text',
        'current_price',
        'regular_price',
        'percent_off',
        'promo_text',
        'product_url',
        'image_url',
        'scraped_at'
      ];
      
      // Create write stream
      const writeStream = fs.createWriteStream(filename);
      
      // Configure CSV formatter
      const csvStream = format({
        headers: headers,
        writeHeaders: true,
        quote: '"',
        delimiter: ','
      });
      
      // Handle completion
      writeStream.on('finish', () => {
        resolve(filename);
      });
      
      // Handle errors
      writeStream.on('error', (error) => {
        reject(new Error(`Failed to write CSV file: ${error.message}`));
      });
      
      csvStream.on('error', (error) => {
        reject(new Error(`CSV formatting error: ${error.message}`));
      });
      
      // Pipe CSV stream to file
      csvStream.pipe(writeStream);
      
      // Write data rows
      csvRows.forEach(row => csvStream.write(row));
      
      // End the stream
      csvStream.end();
      
    } catch (error) {
      reject(new Error(`CSV write error: ${error}`));
    }
  });
}

/**
 * Appends products to existing CSV file or creates new one
 */
export async function appendProductsToCSV(
  products: Product[],
  filename: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const dataDir = path.dirname(filename);
      ensureDataDirectory(dataDir);
      
      const csvRows = products.map(productToCSVRow);
      const fileExists = fs.existsSync(filename);
      
      // Create append stream
      const writeStream = fs.createWriteStream(filename, { flags: 'a' });
      
      // Configure CSV formatter (no headers if file exists)
      const csvStream = format({
        headers: false,
        writeHeaders: !fileExists,
        quote: '"',
        delimiter: ','
      });
      
      // Handle completion
      writeStream.on('finish', () => {
        resolve(filename);
      });
      
      // Handle errors
      writeStream.on('error', (error) => {
        reject(new Error(`Failed to append to CSV file: ${error.message}`));
      });
      
      csvStream.on('error', (error) => {
        reject(new Error(`CSV formatting error: ${error.message}`));
      });
      
      // Pipe and write
      csvStream.pipe(writeStream);
      csvRows.forEach(row => csvStream.write(row));
      csvStream.end();
      
    } catch (error) {
      reject(new Error(`CSV append error: ${error}`));
    }
  });
}

/**
 * Gets the path for today's CSV file
 */
export function getTodaysCSVPath(dataDir: string = 'data'): string {
  const filename = generateCSVFilename();
  return path.join(dataDir, filename);
}

/**
 * Reads products from a CSV file
 */
export async function readProductsFromCSV(filename: string): Promise<Product[]> {
  return new Promise((resolve, reject) => {
    const products: Product[] = [];
    
    if (!fs.existsSync(filename)) {
      resolve([]);
      return;
    }
    
    const stream = fs.createReadStream(filename)
      .pipe(parse({ headers: true }))
      .on('error', (error) => {
        reject(new Error(`Failed to read CSV file: ${error.message}`));
      })
      .on('data', (row: CSVRow) => {
        try {
          const product: Product = {
            retailer: row.retailer as 'petsmart' | 'petvalu' | 'shoppers',
            title: row.product_title,
            brand: row.brand || undefined,
            size_text: row.size_text || undefined,
            current_price: row.current_price ? parseFloat(row.current_price) : undefined,
            regular_price: row.regular_price ? parseFloat(row.regular_price) : undefined,
            percent_off: row.percent_off ? parseInt(row.percent_off) : undefined,
            promo_text: row.promo_text || undefined,
            product_url: row.product_url,
            image_url: row.image_url || undefined,
            scraped_at: row.scraped_at
          };
          products.push(product);
        } catch (error) {
          console.warn(`Failed to parse CSV row: ${error}`);
        }
      })
      .on('end', () => {
        resolve(products);
      });
  });
}
