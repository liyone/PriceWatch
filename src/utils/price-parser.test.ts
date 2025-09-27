/**
 * Comprehensive tests for price parsing utility with edge cases
 */

import {
  parsePrice,
  parsePrices,
  calculateDiscountPercent,
  validatePriceResult,
  formatPrice,
  extractPriceWithPattern,
  PRICE_PATTERNS,
  ParsedPrice,
  PriceParsingResult
} from './price-parser';

describe('Price Parser', () => {
  describe('parsePrice', () => {
    describe('standard price formats', () => {
      test('should parse simple dollar amount', () => {
        const result = parsePrice('$29.99');
        expect(result).toEqual({
          value: 29.99,
          originalText: '$29.99',
          currency: 'CAD',
          isSalePrice: false,
          context: undefined
        });
      });

      test('should parse price without dollar sign', () => {
        const result = parsePrice('34.99');
        expect(result).toEqual({
          value: 34.99,
          originalText: '34.99',
          currency: undefined,
          isSalePrice: false,
          context: undefined
        });
      });

      test('should parse price with commas', () => {
        const result = parsePrice('$1,299.99');
        expect(result).toEqual({
          value: 1299.99,
          originalText: '$1,299.99',
          currency: 'CAD',
          isSalePrice: false,
          context: undefined
        });
      });

      test('should parse whole dollar amounts', () => {
        const result = parsePrice('$45');
        expect(result).toEqual({
          value: 45,
          originalText: '$45',
          currency: 'CAD',
          isSalePrice: false,
          context: undefined
        });
      });
    });

    describe('sale price detection', () => {
      test('should detect sale price with "Sale" keyword', () => {
        const result = parsePrice('Sale: $24.99');
        expect(result?.isSalePrice).toBe(true);
        expect(result?.value).toBe(24.99);
      });

      test('should detect sale price with "Save" keyword', () => {
        const result = parsePrice('Save $5 - Now $19.99');
        expect(result?.isSalePrice).toBe(true);
        expect(result?.value).toBe(19.99);
      });

      test('should detect sale price with percentage', () => {
        const result = parsePrice('20% off - $39.99');
        expect(result?.isSalePrice).toBe(true);
        expect(result?.value).toBe(39.99);
      });

      test('should detect sale price with "Special" keyword', () => {
        const result = parsePrice('Special Price $15.99');
        expect(result?.isSalePrice).toBe(true);
        expect(result?.value).toBe(15.99);
      });
    });

    describe('context extraction', () => {
      test('should extract "each" context', () => {
        const result = parsePrice('$12.99 each');
        expect(result?.context).toBe('each');
        expect(result?.value).toBe(12.99);
      });

      test('should extract "from" context', () => {
        const result = parsePrice('From $29.99');
        expect(result?.context).toBe('from');
        expect(result?.value).toBe(29.99);
      });

      test('should extract "per kg" context', () => {
        const result = parsePrice('$8.99 per kg');
        expect(result?.context).toBe('per kg');
        expect(result?.value).toBe(8.99);
      });
    });

    describe('edge cases and error handling', () => {
      test('should return null for empty string', () => {
        expect(parsePrice('')).toBeNull();
        expect(parsePrice('   ')).toBeNull();
      });

      test('should return null for null/undefined input', () => {
        expect(parsePrice(null as any)).toBeNull();
        expect(parsePrice(undefined as any)).toBeNull();
      });

      test('should return null for non-string input', () => {
        expect(parsePrice(123 as any)).toBeNull();
        expect(parsePrice({} as any)).toBeNull();
      });

      test('should return null for text without numbers', () => {
        expect(parsePrice('Free shipping')).toBeNull();
        expect(parsePrice('Call for price')).toBeNull();
        expect(parsePrice('Out of stock')).toBeNull();
      });

      test('should return null for zero or negative prices', () => {
        expect(parsePrice('$0.00')).toBeNull();
        expect(parsePrice('$-5.99')).toBeNull();
      });

      test('should handle malformed price text', () => {
        const result = parsePrice('$1..99');
        expect(result?.value).toBe(1); // Takes the first valid number found
      });

      test('should handle extra whitespace', () => {
        const result = parsePrice('  $  29.99  ');
        expect(result?.value).toBe(29.99);
      });

      test('should handle multiple currency symbols', () => {
        const result = parsePrice('$$29.99');
        expect(result?.value).toBe(29.99);
        expect(result?.currency).toBe('CAD');
      });
    });

    describe('complex price formats', () => {
      test('should parse price ranges (take first price)', () => {
        const result = parsePrice('$19.99 - $29.99');
        expect(result?.value).toBe(19.99);
      });

      test('should handle promotional text with multiple prices', () => {
        const result = parsePrice('Was $49.99, Now $34.99');
        expect(result?.value).toBe(49.99); // Takes the first price found
        expect(result?.isSalePrice).toBe(true);
      });

      test('should parse member prices', () => {
        const result = parsePrice('Member Price: $27.99');
        expect(result?.value).toBe(27.99);
        expect(result?.isSalePrice).toBe(true);
      });
    });
  });

  describe('parsePrices', () => {
    test('should parse both current and regular prices', () => {
      const result = parsePrices('$24.99', '$34.99');
      
      expect(result.currentPrice?.value).toBe(24.99);
      expect(result.regularPrice?.value).toBe(34.99);
      expect(result.discountPercent).toBe(29);
      expect(result.errors).toHaveLength(0);
    });

    test('should handle only current price', () => {
      const result = parsePrices('$29.99', null);
      
      expect(result.currentPrice?.value).toBe(29.99);
      expect(result.regularPrice).toBeUndefined();
      expect(result.discountPercent).toBeUndefined();
      expect(result.errors).toHaveLength(0);
    });

    test('should include promotional text', () => {
      const result = parsePrices('$19.99', '$29.99', 'Save 33%!');
      
      expect(result.promoText).toBe('Save 33%!');
      expect(result.discountPercent).toBe(33);
    });

    test('should handle parsing errors', () => {
      const result = parsePrices('invalid price', '$29.99');
      
      expect(result.currentPrice).toBeUndefined();
      expect(result.regularPrice?.value).toBe(29.99);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to parse current price');
    });

    test('should not calculate discount when current > regular', () => {
      const result = parsePrices('$39.99', '$29.99');
      
      expect(result.discountPercent).toBeUndefined();
    });

    test('should handle empty promo text', () => {
      const result = parsePrices('$24.99', '$34.99', '   ');
      
      expect(result.promoText).toBeUndefined();
    });
  });

  describe('calculateDiscountPercent', () => {
    test('should calculate correct discount percentage', () => {
      expect(calculateDiscountPercent(20, 25)).toBe(20);
      expect(calculateDiscountPercent(75, 100)).toBe(25);
      expect(calculateDiscountPercent(89.99, 109.99)).toBe(18);
    });

    test('should return 0 for invalid inputs', () => {
      expect(calculateDiscountPercent(30, 25)).toBe(0); // current > regular
      expect(calculateDiscountPercent(-5, 25)).toBe(0); // negative current
      expect(calculateDiscountPercent(25, 0)).toBe(0); // zero regular
      expect(calculateDiscountPercent(25, -10)).toBe(0); // negative regular
    });

    test('should handle same prices', () => {
      expect(calculateDiscountPercent(25, 25)).toBe(0);
    });

    test('should round to nearest integer', () => {
      expect(calculateDiscountPercent(33.33, 50)).toBe(33);
      expect(calculateDiscountPercent(66.67, 100)).toBe(33);
    });
  });

  describe('validatePriceResult', () => {
    test('should validate valid result with current price only', () => {
      const result: PriceParsingResult = {
        currentPrice: { value: 29.99, originalText: '$29.99' },
        errors: []
      };
      
      expect(validatePriceResult(result)).toBe(true);
    });

    test('should validate valid result with both prices', () => {
      const result: PriceParsingResult = {
        currentPrice: { value: 24.99, originalText: '$24.99' },
        regularPrice: { value: 34.99, originalText: '$34.99' },
        discountPercent: 29,
        errors: []
      };
      
      expect(validatePriceResult(result)).toBe(true);
    });

    test('should reject result without current price', () => {
      const result: PriceParsingResult = {
        regularPrice: { value: 34.99, originalText: '$34.99' },
        errors: []
      };
      
      expect(validatePriceResult(result)).toBe(false);
    });

    test('should reject result with zero/negative current price', () => {
      const result: PriceParsingResult = {
        currentPrice: { value: 0, originalText: '$0.00' },
        errors: []
      };
      
      expect(validatePriceResult(result)).toBe(false);
    });

    test('should reject result where regular < current', () => {
      const result: PriceParsingResult = {
        currentPrice: { value: 34.99, originalText: '$34.99' },
        regularPrice: { value: 24.99, originalText: '$24.99' },
        errors: []
      };
      
      expect(validatePriceResult(result)).toBe(false);
    });

    test('should reject result with invalid discount percent', () => {
      const result: PriceParsingResult = {
        currentPrice: { value: 24.99, originalText: '$24.99' },
        discountPercent: 150,
        errors: []
      };
      
      expect(validatePriceResult(result)).toBe(false);
    });
  });

  describe('formatPrice', () => {
    test('should format basic price', () => {
      const price: ParsedPrice = { value: 29.99, originalText: '$29.99', currency: 'CAD' };
      expect(formatPrice(price)).toBe('CAD29.99');
    });

    test('should format price with context', () => {
      const price: ParsedPrice = { value: 12.99, originalText: '$12.99 each', context: 'each' };
      expect(formatPrice(price)).toBe('$12.99 each');
    });

    test('should use default currency when none specified', () => {
      const price: ParsedPrice = { value: 15.50, originalText: '15.50' };
      expect(formatPrice(price)).toBe('$15.50');
    });
  });

  describe('extractPriceWithPattern', () => {
    test('should extract price using standard pattern', () => {
      const price = extractPriceWithPattern('Product costs $29.99', PRICE_PATTERNS.STANDARD);
      expect(price).toBe(29.99);
    });

    test('should extract sale price using sale pattern', () => {
      const price = extractPriceWithPattern('Sale: $19.99', PRICE_PATTERNS.SALE_NOW);
      expect(price).toBe(19.99);
    });

    test('should extract save amount using save pattern', () => {
      const price = extractPriceWithPattern('Save $5.00', PRICE_PATTERNS.SAVE_AMOUNT);
      expect(price).toBe(5.00);
    });

    test('should extract from price using from pattern', () => {
      const price = extractPriceWithPattern('From $15.99', PRICE_PATTERNS.FROM_PRICE);
      expect(price).toBe(15.99);
    });

    test('should return null for no match', () => {
      const price = extractPriceWithPattern('No price here', PRICE_PATTERNS.STANDARD);
      expect(price).toBeNull();
    });
  });

  describe('real-world price examples', () => {
    test('should handle PetSmart-style prices', () => {
      const examples = [
        'C$89.99',
        '$1,299.99',
        'Sale $45.99',
        'Save $15 - Now $34.99',
        'Member Price: $27.99'
      ];

      examples.forEach(example => {
        const result = parsePrice(example);
        expect(result).not.toBeNull();
        expect(result!.value).toBeGreaterThan(0);
      });
    });

    test('should handle Pet Valu-style prices', () => {
      const examples = [
        '$74.99',
        'Reg. $84.99',
        'Member $67.99',
        'Save 20% - $59.99'
      ];

      examples.forEach(example => {
        const result = parsePrice(example);
        expect(result).not.toBeNull();
        expect(result!.value).toBeGreaterThan(0);
      });
    });

    test('should handle Shoppers-style prices', () => {
      const examples = [
        '$31.99',
        'Was $39.99',
        'PC Optimum Price $28.99',
        'Special Offer $24.99',
        '10x Points - $35.99'
      ];

      examples.forEach(example => {
        const result = parsePrice(example);
        expect(result).not.toBeNull();
        expect(result!.value).toBeGreaterThan(0);
      });
    });

    test('should handle complex promotional text', () => {
      const result = parsePrices(
        'PC Optimum Member Price $89.99',
        'Reg. $109.99',
        'Save $20 + Earn 20x Points!'
      );

      expect(result.currentPrice?.value).toBe(89.99);
      expect(result.currentPrice?.isSalePrice).toBe(true);
      expect(result.regularPrice?.value).toBe(109.99);
      expect(result.discountPercent).toBe(18);
      expect(result.promoText).toBe('Save $20 + Earn 20x Points!');
      expect(validatePriceResult(result)).toBe(true);
    });
  });

  describe('error recovery and edge cases', () => {
    test('should handle prices with extra characters', () => {
      const examples = [
        '$29.99*', // asterisk footnote
        '$34.99+', // plus sign
        '$19.99†', // dagger footnote
        '$24.99 CAD' // explicit currency
      ];

      examples.forEach(example => {
        const result = parsePrice(example);
        expect(result).not.toBeNull();
        expect(result!.value).toBeGreaterThan(0);
      });
    });

    test('should handle prices in different languages/formats', () => {
      const examples = [
        'C$ 89.99', // with space
        '$1 299.99', // European comma style (space as thousands separator)
        '89,99 $' // European decimal style
      ];

      // These should either parse correctly or fail gracefully
      examples.forEach(example => {
        const result = parsePrice(example);
        // Should not throw errors
        expect(typeof result === 'object' || result === null).toBe(true);
      });
    });

    test('should handle very large prices', () => {
      const result = parsePrice('$999,999.99');
      expect(result?.value).toBe(999999.99);
    });

    test('should handle prices with many decimal places', () => {
      const result = parsePrice('$29.9999');
      expect(result?.value).toBe(29.9999);
    });
  });
});
