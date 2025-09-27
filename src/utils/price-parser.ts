/**
 * Robust price parsing utility for various retailer formats
 */

import { logger } from './logger';

export interface ParsedPrice {
  /** The numeric value of the price in CAD */
  value: number;
  /** The original text that was parsed */
  originalText: string;
  /** Currency symbol if detected */
  currency?: string;
  /** Whether this appears to be a sale/discounted price */
  isSalePrice?: boolean;
  /** Additional context (e.g., "each", "per kg", "from") */
  context?: string;
}

export interface PriceParsingResult {
  /** Successfully parsed current/sale price */
  currentPrice?: ParsedPrice;
  /** Successfully parsed regular/original price */
  regularPrice?: ParsedPrice;
  /** Calculated discount percentage (0-100) */
  discountPercent?: number;
  /** Any promotional text found */
  promoText?: string;
  /** Errors encountered during parsing */
  errors: string[];
}

/**
 * Extract numeric value from price text
 */
function extractNumericPrice(text: string): number | null {
  // Check for negative prices first
  if (text.includes('$-') || /\$\s*-/.test(text)) {
    return null;
  }
  
  // Look for all price patterns and find the most likely one
  const pricePatterns = [
    // Prefer prices with dollar signs
    /\$(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/g,
    // Then standalone numbers that look like prices
    /\b(\d{1,3}(?:,\d{3})*\.\d{2})\b/g,
    // Finally any number with potential price context
    /\b(\d+(?:\.\d+)?)\b/g
  ];
  
  for (const pattern of pricePatterns) {
    const matches = Array.from(text.matchAll(pattern));
    if (matches.length > 0) {
      // For multiple matches, try to find the most likely price
      for (const match of matches) {
        const cleaned = match[1].replace(/,/g, '');
        const parsed = parseFloat(cleaned);
        
        if (!isNaN(parsed) && parsed > 0) {
          // For save contexts, skip save amounts but not sale prices
          if (text.toLowerCase().includes('save')) {
            // Only skip if this looks like a save amount (e.g., "Save $5")
            const savePattern = new RegExp(`save\\s*\\$?${match[1]}\\b`, 'i');
            if (savePattern.test(text) && parsed < 50) {
              continue; // Skip small save amounts
            }
          }
          
          return parsed;
        }
      }
    }
  }
  
  return null;
}

/**
 * Detect currency from text
 */
function detectCurrency(text: string): string | undefined {
  if (text.includes('$') || text.toLowerCase().includes('cad')) {
    return 'CAD';
  }
  if (text.includes('€')) {
    return 'EUR';
  }
  if (text.includes('£')) {
    return 'GBP';
  }
  return undefined;
}

/**
 * Detect if price appears to be a sale price
 */
function detectSalePrice(text: string): boolean {
  const saleIndicators = [
    'sale', 'save', 'was', 'now', 'special', 'promo', 'discount', 
    'clearance', 'reduced', 'off', '%', 'deal', 'member', 'optimum'
  ];
  
  const lowerText = text.toLowerCase();
  return saleIndicators.some(indicator => lowerText.includes(indicator));
}

/**
 * Extract context information from price text
 */
function extractContext(text: string): string | undefined {
  const contextPatterns = [
    /\b(each|per\s+\w+|from|starting\s+at|up\s+to)\b/i
  ];
  
  for (const pattern of contextPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].toLowerCase();
    }
  }
  
  return undefined;
}

/**
 * Parse a single price string into a ParsedPrice object
 */
export function parsePrice(priceText: string): ParsedPrice | null {
  if (!priceText || typeof priceText !== 'string') {
    return null;
  }

  const trimmed = priceText.trim();
  if (!trimmed) {
    return null;
  }

  const numericValue = extractNumericPrice(trimmed);
  if (numericValue === null || numericValue <= 0) {
    return null;
  }

  return {
    value: numericValue,
    originalText: trimmed,
    currency: detectCurrency(trimmed),
    isSalePrice: detectSalePrice(trimmed),
    context: extractContext(trimmed)
  };
}

/**
 * Parse multiple price texts (e.g., current price and regular price)
 */
export function parsePrices(
  currentPriceText?: string | null,
  regularPriceText?: string | null,
  promoText?: string | null
): PriceParsingResult {
  const errors: string[] = [];
  let currentPrice: ParsedPrice | undefined;
  let regularPrice: ParsedPrice | undefined;
  let discountPercent: number | undefined;

  // Parse current price
  if (currentPriceText) {
    const parsedCurrent = parsePrice(currentPriceText);
    if (parsedCurrent) {
      currentPrice = parsedCurrent;
    } else {
      errors.push(`Failed to parse current price: "${currentPriceText}"`);
    }
  }

  // Parse regular price
  if (regularPriceText) {
    const parsedRegular = parsePrice(regularPriceText);
    if (parsedRegular) {
      regularPrice = parsedRegular;
    } else {
      errors.push(`Failed to parse regular price: "${regularPriceText}"`);
    }
  }

  // Calculate discount percentage
  if (currentPrice && regularPrice && regularPrice.value > currentPrice.value) {
    discountPercent = Math.round(((regularPrice.value - currentPrice.value) / regularPrice.value) * 100);
  }

  return {
    currentPrice,
    regularPrice,
    discountPercent,
    promoText: promoText?.trim() || undefined,
    errors
  };
}

/**
 * Calculate discount percentage between two prices
 */
export function calculateDiscountPercent(currentPrice: number, regularPrice: number): number {
  if (regularPrice <= 0 || currentPrice < 0 || currentPrice > regularPrice) {
    return 0;
  }
  
  return Math.round(((regularPrice - currentPrice) / regularPrice) * 100);
}

/**
 * Validate price parsing result
 */
export function validatePriceResult(result: PriceParsingResult): boolean {
  // Must have at least a current price
  if (!result.currentPrice) {
    return false;
  }

  // Price must be positive
  if (result.currentPrice.value <= 0) {
    return false;
  }

  // If both prices exist, regular should be >= current
  if (result.regularPrice && result.currentPrice) {
    if (result.regularPrice.value < result.currentPrice.value) {
      return false;
    }
  }

  // Discount percent should be reasonable (0-100)
  if (result.discountPercent !== undefined) {
    if (result.discountPercent < 0 || result.discountPercent > 100) {
      return false;
    }
  }

  return true;
}

/**
 * Format price for display
 */
export function formatPrice(price: ParsedPrice): string {
  const currency = price.currency || '$';
  const formatted = `${currency}${price.value.toFixed(2)}`;
  
  if (price.context) {
    return `${formatted} ${price.context}`;
  }
  
  return formatted;
}

/**
 * Parse price with logging for debugging
 */
export function parsePriceWithLogging(
  priceText: string,
  context: { retailer?: string; productUrl?: string } = {}
): ParsedPrice | null {
  const result = parsePrice(priceText);
  
  if (result) {
    logger.debug('Price parsed successfully', {
      originalText: priceText,
      parsedValue: result.value,
      currency: result.currency,
      isSalePrice: result.isSalePrice,
      context: result.context,
      ...context
    });
  } else {
    logger.warn('Price parsing failed', {
      originalText: priceText,
      ...context
    });
  }
  
  return result;
}

/**
 * Common price patterns for different retailers
 */
export const PRICE_PATTERNS = {
  // Standard formats
  STANDARD: /\$?(\d{1,3}(?:,\d{3})*\.?\d{0,2})/,
  
  // Sale formats
  SALE_NOW: /(?:now|sale)[:\s]*\$?(\d{1,3}(?:,\d{3})*\.?\d{0,2})/i,
  SAVE_AMOUNT: /save[:\s]*\$?(\d{1,3}(?:,\d{3})*\.?\d{0,2})/i,
  
  // Range formats
  FROM_PRICE: /from[:\s]*\$?(\d{1,3}(?:,\d{3})*\.?\d{0,2})/i,
  UP_TO_PRICE: /up\s+to[:\s]*\$?(\d{1,3}(?:,\d{3})*\.?\d{0,2})/i,
  
  // Promotional formats
  MEMBER_PRICE: /member[:\s]*\$?(\d{1,3}(?:,\d{3})*\.?\d{0,2})/i,
  SPECIAL_PRICE: /special[:\s]*\$?(\d{1,3}(?:,\d{3})*\.?\d{0,2})/i
};

/**
 * Extract price using specific pattern
 */
export function extractPriceWithPattern(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern);
  if (!match || !match[1]) {
    return null;
  }
  
  return extractNumericPrice(match[1]);
}
