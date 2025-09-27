/**
 * Core TypeScript interfaces and types for the PriceWatch scraper
 */

export interface Product {
  /** Retailer identifier */
  retailer: 'petsmart' | 'petvalu' | 'shoppers';
  /** Product title/name */
  title: string;
  /** Brand name if available */
  brand?: string;
  /** Size description (e.g., "7kg", "84-count") */
  size_text?: string;
  /** Current price in CAD */
  current_price?: number;
  /** Regular/original price in CAD */
  regular_price?: number;
  /** Calculated discount percentage (0-100) */
  percent_off?: number;
  /** Promotional text or badges */
  promo_text?: string;
  /** Direct link to the product */
  product_url: string;
  /** Product image URL */
  image_url?: string;
  /** Timestamp when data was scraped */
  scraped_at: string;
}

export interface SiteConfig {
  /** Base URL for the retailer */
  baseUrl: string;
  /** CSS selectors for scraping */
  selectors: {
    /** Product card container */
    productCard: string;
    /** Product title */
    title: string;
    /** Current/sale price */
    currentPrice: string;
    /** Regular/original price */
    regularPrice?: string;
    /** Product link */
    productLink: string;
    /** Product image */
    image?: string;
    /** Promotional badges/text */
    promo?: string;
    /** Brand name */
    brand?: string;
    /** Size information */
    size?: string;
  };
  /** Wait time between requests (ms) */
  delay: number;
  /** Maximum retries for failed requests */
  maxRetries: number;
}

export interface ProductConfig {
  /** Direct product URL */
  url?: string;
  /** Category page URL for filtering */
  category_url?: string;
  /** Product name for identification */
  name: string;
  /** Brand filter for category scraping */
  brand_filter?: string;
  /** Size filter for category scraping */
  size_filter?: string;
  /** Custom alert threshold for this product */
  alert_threshold?: number;
}

export interface RetailerConfig {
  /** Site-specific configuration */
  config: SiteConfig;
  /** List of products to track */
  products: ProductConfig[];
  /** Whether this retailer is enabled */
  enabled: boolean;
}

export interface ScrapingConfig {
  /** Configuration for each retailer */
  retailers: {
    petsmart: RetailerConfig;
    petvalu: RetailerConfig;
    shoppers: RetailerConfig;
  };
  /** Global alert settings */
  alerts: {
    /** Default discount threshold percentage */
    min_discount_percent: number;
    /** Discord webhook URL */
    discord_webhook?: string;
    /** Whether to enable Discord alerts */
    discord_enabled: boolean;
    /** Hours to wait before sending duplicate alerts */
    deduplication_hours: number;
  };
  /** CSV output settings */
  output: {
    /** Directory for CSV files */
    data_directory: string;
    /** Whether to commit CSV files to git */
    git_commit: boolean;
  };
}

export interface ScrapingResult {
  /** Successfully scraped products */
  products: Product[];
  /** Any errors encountered */
  errors: ScrapingError[];
  /** Summary statistics */
  summary: {
    total_products: number;
    successful_scrapes: number;
    failed_scrapes: number;
    alerts_sent: number;
    execution_time_ms: number;
  };
}

export interface ScrapingError {
  /** Retailer where error occurred */
  retailer: string;
  /** Product URL that failed */
  product_url?: string;
  /** Error message */
  message: string;
  /** Error severity */
  severity: 'warning' | 'error' | 'critical';
  /** Timestamp of error */
  timestamp: string;
}

export interface AlertData {
  /** Product information */
  product: Product;
  /** Whether this is a new deal */
  is_new_deal: boolean;
  /** Previous price if available */
  previous_price?: number;
  /** Deal quality score */
  deal_score: number;
}

export interface CSVRow {
  retailer: string;
  product_title: string;
  brand: string;
  size_text: string;
  current_price: string;
  regular_price: string;
  percent_off: string;
  promo_text: string;
  product_url: string;
  image_url: string;
  scraped_at: string;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  metadata?: Record<string, any>;
}
