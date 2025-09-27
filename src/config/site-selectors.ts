/**
 * CSS selectors and configuration for each retailer
 * These may need periodic updates as websites change their layouts
 */

import { SiteConfig } from '../types';

/**
 * PetSmart configuration
 * Updated based on real site structure analysis
 */
export const petsmartConfig: SiteConfig = {
  baseUrl: 'https://www.petsmart.ca',
  selectors: {
    // Product grid container (for category pages)
    productCard: '.product-tile, .product-item, .product-card, .grid-item',
    
    // Product information - updated for actual PetSmart structure
    title: 'h1, .pdp-product-name, .product-title, .product-name, h3 a, .tile-title',
    
    // Price selectors - PetSmart shows price as simple text
    currentPrice: '.price, .product-price, .price-current, .sale-price, .price-now, .price .value, [data-price]',
    
    // Regular/original price (for sales)
    regularPrice: '.price-original, .price-was, .price-reg, .price-standard, .was-price',
    
    // Product link (for category pages)
    productLink: 'a[href*="/product/"], a[href*="petsmart.ca"], .product-link, .tile-link',
    
    // Product image
    image: '.product-image img, .tile-image img, img[alt*="product"], .product-gallery img, .pdp-image img',
    
    // Promotional badges/text - look for offers and autoship info
    promo: '.badge, .promo-text, .sale-badge, .discount-text, .points-text, .offer-text, .autoship-text',
    
    // Brand name - PetSmart shows brand separately
    brand: '.brand-name, .product-brand, [data-brand], .brand',
    
    // Size/quantity information - often in title or separate element
    size: '.product-size, .size-info, .quantity-info, .weight-info'
  },
  delay: 800, // Delay between requests in milliseconds
  maxRetries: 3
};

/**
 * Pet Valu configuration
 * Placeholder for future implementation
 */
export const petvaluConfig: SiteConfig = {
  baseUrl: 'https://www.petvalu.ca',
  selectors: {
    productCard: '.product-item, .product-card',
    title: '.product-title, .product-name',
    currentPrice: '.price-current, .sale-price',
    regularPrice: '.price-original, .price-was',
    productLink: 'a[href*="/product/"]',
    image: '.product-image img',
    promo: '.badge, .promo-text',
    brand: '.brand-name',
    size: '.product-size'
  },
  delay: 600,
  maxRetries: 3
};

/**
 * Shoppers Drug Mart configuration
 * Placeholder for future implementation
 */
export const shoppersConfig: SiteConfig = {
  baseUrl: 'https://www.shoppersdrugmart.ca',
  selectors: {
    productCard: '.product-tile, .product-item',
    title: '.product-title, .product-name',
    currentPrice: '.price-current, .pc-price',
    regularPrice: '.price-original, .price-reg',
    productLink: 'a[href*="/product/"]',
    image: '.product-image img',
    promo: '.badge, .pc-points, .promo-text',
    brand: '.brand-name',
    size: '.product-size'
  },
  delay: 700,
  maxRetries: 3
};

/**
 * Get configuration for a specific retailer
 */
export function getSiteConfig(retailer: 'petsmart' | 'petvalu' | 'shoppers'): SiteConfig {
  switch (retailer) {
    case 'petsmart':
      return petsmartConfig;
    case 'petvalu':
      return petvaluConfig;
    case 'shoppers':
      return shoppersConfig;
    default:
      throw new Error(`Unknown retailer: ${retailer}`);
  }
}

/**
 * Common selector patterns that work across many e-commerce sites
 */
export const commonSelectors = {
  // Fallback selectors for price detection
  priceSelectors: [
    '[class*="price"]',
    '[data-price]',
    '.cost',
    '.amount',
    '.value'
  ],
  
  // Fallback selectors for product titles
  titleSelectors: [
    'h1', 'h2', 'h3',
    '[class*="title"]',
    '[class*="name"]',
    '[data-title]'
  ],
  
  // Fallback selectors for product links
  linkSelectors: [
    'a[href*="/product/"]',
    'a[href*="/item/"]',
    'a[href*="/p/"]',
    '.product-link a',
    '.tile a'
  ],
  
  // Fallback selectors for images
  imageSelectors: [
    '.product-image img',
    '.tile-image img',
    'img[alt*="product"]',
    'img[src*="product"]'
  ]
};

/**
 * Validation function to check if selectors are working
 */
export function validateSelectors(retailer: string, foundElements: Record<string, number>): boolean {
  const minimumExpected = {
    productCard: 1,   // At least 1 product found
    title: 1,         // At least 1 title found
    currentPrice: 1   // At least 1 price found
  };
  
  for (const [selector, minCount] of Object.entries(minimumExpected)) {
    if ((foundElements[selector] || 0) < minCount) {
      console.warn(`Selector validation failed for ${retailer}: ${selector} found ${foundElements[selector] || 0}, expected at least ${minCount}`);
      return false;
    }
  }
  
  return true;
}
