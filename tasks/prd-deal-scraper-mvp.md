# PRD — Deal Scraper MVP: Zero-Server Web Scraper for Pet Food & Diaper Deals

**Owner:** You  
**Date:** September 27, 2025  
**Version:** v1.0 MVP  
**Status:** Draft  

---

## 1. Introduction/Overview

Build a lightweight, scheduled web scraper that monitors specific pet food and diaper products across PetSmart, Pet Valu, and Shoppers Drug Mart. The system will extract product prices, detect discounts, and alert via Discord when deals meet your threshold. The entire solution runs on GitHub Actions with zero server management required.

**Problem:** Manually checking multiple retailer websites for pet food and diaper deals is time-consuming and you often miss limited-time promotions.

**Goal:** Automated deal monitoring that captures price changes and alerts you to significant discounts on products you care about, with minimal maintenance overhead.

---

## 2. Goals

1. **Automated Monitoring:** Track specific products across 3 major retailers without manual intervention
2. **Deal Detection:** Identify and alert on discounts ≥20% off regular price  
3. **Zero Infrastructure:** Run entirely on GitHub Actions with no servers to manage
4. **Flexible Configuration:** Easy to add/remove specific products via configuration files
5. **Historical Tracking:** Maintain CSV records of all price data for trend analysis
6. **Reliable Alerts:** Discord notifications for qualifying deals with low false-positive rate

---

## 3. User Stories

**As a cost-conscious pet owner and parent, I want to:**

- **Monitor specific products:** "I want to track the exact pet food brands and diaper products I regularly buy"
- **Get timely alerts:** "I want to know within hours when my tracked products go on sale ≥20% off"  
- **Review deal history:** "I want to see price trends over time in a simple CSV format"
- **Easy management:** "I want to add new products to track by simply updating a config file"
- **Manual triggers:** "I want to run the scraper on-demand when I suspect sales might be happening"

**As a developer maintaining this system, I want to:**

- **Simple deployment:** "I want to deploy via git push with no server setup"
- **Easy debugging:** "I want clear logs when scrapers fail or selectors break"
- **Reliable operations:** "I want the system to handle site changes gracefully"

---

## 4. Functional Requirements

### 4.1 Product Configuration
1. **Config-driven product list:** JSON/YAML file listing specific product URLs or search terms per retailer
2. **Easy product addition:** Adding new products requires only config file updates
3. **Product categorization:** Group products by type (pet food, diapers) for better organization
4. **Flexible matching:** Support both exact product URLs and category + brand filtering

### 4.2 Data Extraction  
5. **Core product data:** Extract retailer, product title, current price, regular price (if available)
6. **Price parsing:** Handle various price formats ($34.99, $1,299.99, Sale: $24.99)
7. **Discount calculation:** Compute percent_off when both current and regular prices available
8. **Product identification:** Capture product URLs for deduplication and tracking
9. **Timestamp tracking:** Record when each price was captured

### 4.3 Data Storage
10. **Daily CSV output:** Generate `data/deals_YYYYMMDD.csv` file per scraping run
11. **Consistent format:** Standardized columns across all retailers and runs
12. **Git integration:** Automatically commit CSV files to repository
13. **Append-only:** Never modify previous day's data

### 4.4 Alert System
14. **Discord integration:** Send formatted messages to Discord webhook
15. **Threshold filtering:** Only alert when discount ≥20% (configurable)
16. **Deduplication:** Prevent multiple alerts for same product within 24 hours
17. **Rich formatting:** Include product name, retailer, discount %, price comparison, and direct link

### 4.5 Scheduling & Execution
18. **Automated schedule:** Run 3 times daily (morning, afternoon, evening Toronto time)
19. **Manual execution:** Support on-demand runs via GitHub Actions web interface
20. **Error handling:** Continue processing other products/retailers if one fails
21. **Execution logging:** Clear logs showing success/failure counts per retailer

### 4.6 Reliability Features
22. **Polite scraping:** Respect rate limits with delays between requests
23. **Selector resilience:** Graceful handling when website layouts change
24. **Retry logic:** Attempt retries on transient network errors
25. **Timeout protection:** Prevent indefinite hangs on unresponsive pages

---

## 5. Non-Goals (Out of Scope)

- **Store-specific inventory:** Not checking individual store availability
- **Checkout automation:** No purchasing or cart functionality  
- **Points calculation:** Not converting PC Optimum points to cash values (just capture text)
- **Product detail crawling:** Staying on category/listing pages only
- **User interface:** No web dashboard in MVP (CSV files only)
- **Database integration:** No SQLite or external databases in MVP
- **Multiple regions:** Not handling different provinces/cities specifically
- **Price prediction:** No forecasting or trend analysis features
- **Coupon integration:** Not applying or tracking coupon codes

---

## 6. Design Considerations

### 6.1 Technical Architecture
- **Runtime:** Node.js with TypeScript for maintainability
- **Browser automation:** Playwright for JavaScript-heavy sites
- **Parsing:** Cheerio for static HTML when possible (performance)
- **Storage:** CSV files committed to git repository
- **Secrets management:** GitHub Actions secrets for Discord webhook

### 6.2 Site-Specific Considerations  
- **PetSmart:** Likely requires JavaScript rendering for product grids
- **Pet Valu:** May have simpler HTML structure
- **Shoppers:** Complex layout with PC Optimum points integration

### 6.3 Data Format
```csv
retailer,product_title,current_price,regular_price,percent_off,product_url,scraped_at
petsmart,"Hill's Science Diet Adult 7kg",89.99,109.99,18,https://...,2025-09-27T14:30:00Z
```

---

## 7. Technical Considerations

### 7.1 Scraping Strategy
- **Selector configuration:** Externalized CSS selectors in site-specific config files
- **Error isolation:** Failures on one site don't block others
- **Gentle scraping:** 500-1200ms delays between page loads
- **Headless browser:** Chromium via Playwright for consistent rendering

### 7.2 GitHub Actions Integration
- **Cron schedule:** `0 12,18,23 * * *` (3x daily in UTC, accounting for Toronto time)
- **Workflow dispatch:** Manual trigger capability
- **Artifact storage:** CSV files committed directly to repository
- **Environment variables:** `DISCORD_WEBHOOK`, `ALERT_MIN_PERCENT_OFF`

### 7.3 Monitoring & Observability
- **Structured logging:** JSON logs for easy parsing
- **Success metrics:** Products scraped per site, alerts sent, errors encountered
- **Health checks:** Validate expected number of products found per retailer

---

## 8. Success Metrics

### 8.1 Coverage Metrics
- **Product discovery:** ≥90% of configured products found and priced per run
- **Site reliability:** ≥95% success rate per site over 2-week period
- **Data completeness:** ≥95% of found products have valid price data

### 8.2 Alert Quality
- **Signal-to-noise:** ≥90% of alerts represent genuine deals (not pricing errors)
- **Timeliness:** Deals detected within 6 hours of becoming available
- **Deduplication:** <5% duplicate alerts for same product within 24 hours

### 8.3 Operational Metrics
- **Execution time:** Each full run completes in <10 minutes
- **Error recovery:** System recovers from individual site failures without manual intervention
- **Maintenance overhead:** <1 hour/week required for selector updates

---

## 9. Implementation Plan

### 9.1 Milestone 1: Core Infrastructure (2 days)
- Set up Node.js/TypeScript project structure
- Implement CSV writing utilities
- Create basic Playwright scraping framework
- Set up GitHub Actions workflow with manual trigger

**Acceptance Criteria:**
- [ ] Manual run produces valid CSV with sample data
- [ ] GitHub Actions can execute scraper successfully
- [ ] Basic error handling and logging in place

### 9.2 Milestone 2: Single Site Implementation (2 days)  
- Implement PetSmart scraper with configurable product list
- Price parsing and discount calculation
- Discord webhook integration
- Local testing and validation

**Acceptance Criteria:**
- [ ] PetSmart scraper extracts ≥10 products successfully  
- [ ] Price calculations are accurate (manual verification)
- [ ] Discord alerts work for test data

### 9.3 Milestone 3: Multi-Site Support (2 days)
- Add Pet Valu and Shoppers scrapers
- Unified configuration system
- Error isolation between sites
- Enhanced logging and monitoring

**Acceptance Criteria:**
- [ ] All 3 sites working independently
- [ ] Failures on one site don't block others
- [ ] Combined CSV output with all retailers

### 9.4 Milestone 4: Production Readiness (1 day)
- Automated scheduling (3x daily)
- Production Discord webhook setup
- Documentation and README
- Final testing and validation

**Acceptance Criteria:**
- [ ] Automated runs working on schedule
- [ ] Production alerts configured
- [ ] Documentation complete for adding new products

---

## 10. Risk Mitigation

### 10.1 Technical Risks
**Risk:** Website layout changes break scrapers  
**Mitigation:** Centralized selector configuration, monitoring alerts for zero results

**Risk:** Bot detection prevents scraping  
**Mitigation:** Respectful delays, user-agent rotation, graceful degradation

**Risk:** GitHub Actions limits (minutes, storage)  
**Mitigation:** Efficient scraping, CSV compression, monitor usage limits

### 10.2 Data Quality Risks  
**Risk:** False discount calculations  
**Mitigation:** Price validation logic, manual spot-checking of alerts

**Risk:** Duplicate product detection  
**Mitigation:** URL-based deduplication, product title normalization

### 10.3 Operational Risks
**Risk:** Too many false-positive alerts  
**Mitigation:** Configurable thresholds, manual alert review process

**Risk:** Missing deals due to timing  
**Mitigation:** 3x daily schedule, manual trigger capability

---

## 11. Configuration Specification

### 11.1 Product Configuration Format
```yaml
retailers:
  petsmart:
    products:
      - url: "https://www.petsmart.ca/dog/food/dry-food/..."
        name: "Hill's Science Diet Adult 7kg"
        alert_threshold: 20
      - category_url: "https://www.petsmart.ca/dog/food/dry-food/"
        brand_filter: "Hill's"
        size_filter: "7kg"
  
  petvalu:
    products:
      - url: "https://www.petvalu.ca/..."
        name: "Royal Canin Medium Adult"
```

### 11.2 Environment Variables
- `DISCORD_WEBHOOK`: Discord webhook URL for alerts
- `ALERT_MIN_PERCENT_OFF`: Default threshold (default: 20)
- `DRY_RUN`: Skip alerts and commits for testing (default: false)

---

## 12. Success Criteria & Testing

### 12.1 Acceptance Tests
- [ ] System runs automatically 3x daily without intervention
- [ ] CSV files generated contain accurate price data (spot-check 10 products/retailer)
- [ ] Discord alerts fire for discounts ≥20% with correct calculations
- [ ] System handles individual site failures gracefully
- [ ] Adding new products requires only config file changes
- [ ] Manual execution works via GitHub Actions interface

### 12.2 Performance Tests
- [ ] Full scraping run completes in <10 minutes
- [ ] Memory usage stays <512MB during execution
- [ ] CSV files remain <5MB for reasonable product counts

### 12.3 Reliability Tests
- [ ] System recovers from network timeouts
- [ ] Invalid selectors don't crash entire run
- [ ] Malformed prices are handled gracefully

---

## 13. Open Questions

1. **Product identification:** Should we store product IDs/SKUs when available for better tracking?

2. **Geographic targeting:** Do you want to specify particular store locations, or is province-wide pricing sufficient?

3. **Price history:** Should we include "last seen price" comparisons in alerts (e.g., "lowest in 30 days")?

4. **Alert frequency:** Should we limit alerts to once per product per week to reduce noise?

5. **Seasonal adjustments:** Should scraping frequency increase during known sale periods (Black Friday, etc.)?

---

## 14. Future Enhancements (Phase 2+)

### 14.1 Enhanced Tracking
- SQLite database for price history analysis
- "Lowest price in X days" calculations
- Price trend analysis and predictions

### 14.2 User Interface
- Simple web dashboard for viewing current deals
- Product watchlist management interface
- Price history charts and analytics

### 14.3 Advanced Features  
- Multi-threshold alerts (10%, 20%, 30% off)
- Brand-specific monitoring
- Stock level tracking when available
- Integration with shopping list apps

This PRD provides a clear roadmap for building a robust, maintainable deal scraper that meets your immediate needs while allowing for future enhancements.
