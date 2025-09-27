# Tasks — Deal Scraper MVP Implementation

Generated from: `prd-deal-scraper-mvp.md`  
Date: September 27, 2025

---

## Current State Assessment

**Existing Codebase:** Empty repository with only LICENSE file  
**Infrastructure:** None - starting from scratch  
**Dependencies:** Need to establish Node.js + TypeScript + Playwright stack  
**Deployment:** GitHub Actions will handle all execution and storage  

---

## Relevant Files

- `package.json` - Node.js project configuration with TypeScript and Playwright dependencies
- `tsconfig.json` - TypeScript configuration for the project
- `src/main.ts` - Entry point that orchestrates the entire scraping process
- `src/types/index.ts` - TypeScript interfaces for Product, ScrapedData, SiteConfig, etc.
- `src/utils/csv.ts` - CSV writing utilities with consistent formatting
- `src/utils/price-parser.ts` - Price parsing logic to handle various formats ($34.99, Sale: $24.99, etc.)
- `src/utils/price-parser.test.ts` - Unit tests for price parsing functions
- `src/utils/logger.ts` - Structured logging utilities for debugging and monitoring
- `src/scrapers/base-scraper.ts` - Abstract base class for site-specific scrapers
- `src/scrapers/petsmart-scraper.ts` - PetSmart-specific scraping implementation
- `src/scrapers/petvalu-scraper.ts` - Pet Valu scraping implementation
- `src/scrapers/shoppers-scraper.ts` - Shoppers Drug Mart scraping implementation
- `src/config/products.yaml` - Product configuration file for easy management
- `src/config/site-selectors.ts` - CSS selectors and site-specific configurations
- `src/alerts/discord.ts` - Discord webhook integration for deal notifications
- `src/alerts/discord.test.ts` - Unit tests for Discord alert functionality
- `data/` - Directory for storing generated CSV files (tracked in git)
- `.github/workflows/scrape.yml` - GitHub Actions workflow for automated scheduling
- `README.md` - Documentation for setup, configuration, and usage
- `jest.config.js` - Jest test configuration
- `.gitignore` - Git ignore file for node_modules, build artifacts, etc.

### Notes

- All tests should be placed alongside their corresponding source files
- Use `npm test` to run all tests, or `npm test -- --testPathPattern=price-parser` for specific tests
- CSV files in `data/` are committed to git for historical tracking
- Environment variables for Discord webhook should be set in GitHub Actions secrets

---

## Tasks

- [ ] **1.0 Project Foundation & Basic Infrastructure**
  - [x] 1.1 Initialize Node.js project with TypeScript configuration and essential dependencies
  - [x] 1.2 Set up Jest testing framework with TypeScript support
  - [x] 1.3 Create basic TypeScript interfaces and types for the project
  - [x] 1.4 Implement CSV utility functions with standardized output format
  - [x] 1.5 Create structured logging utility for debugging and monitoring
  - [x] 1.6 Validate foundation with a simple test CSV generation

- [ ] **2.0 Core Scraping Framework & Price Parsing**
  - [ ] 2.1 Install and configure Playwright with Chromium browser
  - [ ] 2.2 Create abstract base scraper class with common functionality
  - [ ] 2.3 Implement robust price parsing utility (handle $34.99, $1,299.99, Sale: formats)
  - [ ] 2.4 Write comprehensive unit tests for price parsing with edge cases
  - [ ] 2.5 Create discount calculation logic with validation
  - [ ] 2.6 Test price parsing with real-world price examples from target sites

- [ ] **3.0 Single Site Implementation (PetSmart)**
  - [ ] 3.1 Research PetSmart product page structure and identify CSS selectors
  - [ ] 3.2 Implement PetSmart scraper with product extraction logic
  - [ ] 3.3 Create basic product configuration system (YAML file)
  - [ ] 3.4 Test scraper with 3-5 sample product URLs and validate extracted data
  - [ ] 3.5 Implement error handling and graceful failures for missing elements
  - [ ] 3.6 Generate end-to-end test CSV with real PetSmart data

- [ ] **4.0 Multi-Site Expansion & Configuration System**
  - [ ] 4.1 Research Pet Valu and Shoppers site structures and CSS selectors
  - [ ] 4.2 Implement Pet Valu scraper following the base scraper pattern
  - [ ] 4.3 Implement Shoppers Drug Mart scraper with special handling for points/promotions
  - [ ] 4.4 Create unified configuration system to manage all products across sites
  - [ ] 4.5 Implement site isolation (failures on one site don't block others)
  - [ ] 4.6 Test all three sites together and validate combined CSV output

- [ ] **5.0 Automation, Alerts & Production Deployment**
  - [ ] 5.1 Implement Discord webhook integration with rich message formatting
  - [ ] 5.2 Create alert filtering logic (threshold-based, deduplication)
  - [ ] 5.3 Set up GitHub Actions workflow with cron scheduling (3x daily)
  - [ ] 5.4 Configure environment variables and secrets in GitHub Actions
  - [ ] 5.5 Test manual trigger functionality and validate CSV commit process
  - [ ] 5.6 Create comprehensive README with setup and configuration instructions
  - [ ] 5.7 Run end-to-end validation: scheduled run → CSV generation → Discord alerts → git commit
