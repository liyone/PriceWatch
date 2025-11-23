# PriceWatch Scraper

A robust, configurable web scraper designed to track product prices and stock trading activity. It supports multiple retailers and alert strategies.

## Features

- **Multi-Retailer Support**: Extensible architecture to support various sites (currently PetSmart and QuiverQuant).
- **Dual Alert System**:
  - **Price Drops**: Alerts when a product's price drops below a specified threshold (e.g., 20% off).
  - **New Items**: Alerts when a new item appears in a list (e.g., new stock trades).
- **History Tracking**: Persists seen items to prevent duplicate alerts for "new item" tracking.
- **Discord Integration**: Sends rich notifications to a Discord webhook.
- **CSV Export**: Saves all scraped data to daily CSV files.
- **GitHub Actions**: Automated scraping on a schedule.

## Architecture

### Core Components

- **`src/main.ts`**: The entry point. Orchestrates loading config, initializing scrapers, processing results, and sending alerts.
- **`src/scrapers/base-scraper.ts`**: Abstract base class handling browser initialization (Playwright), navigation, and common utilities.
- **`src/scrapers/*-scraper.ts`**: Retailer-specific implementations (e.g., `PetSmartScraper`, `QuiverQuantScraper`).
- **`src/utils/history-manager.ts`**: Manages a JSON-based history file (`data/history.json`) to track seen IDs for deduplication.
- **`src/alerts/discord.ts`**: Handles formatting and sending Discord messages.

### Configuration

Configuration is managed via `src/config/products.yaml`.

```yaml
retailers:
  petsmart:
    enabled: true
    products:
      - name: "Product Name"
        url: "https://..."
        alert_threshold: 20 # Optional override

  quiverquant:
    enabled: true
    alert_on_new: true # Enables "new item" alert mode
    products:
      - name: "Politician Name"
        url: "https://..."
```

### Schedule and Costs

The scraper is configured to run **every 6 hours** (4 times/day) via GitHub Actions.

- **Frequency**: 00:00, 06:00, 12:00, 18:00 UTC.
- **Resource Usage**:
  - Approx. 1-2 minutes per run.
  - ~4 runs/day * 30 days = **~120-240 minutes/month**.
  - **GitHub Free Tier**: Includes 2,000 minutes/month.
  - **Conclusion**: This setup uses ~10% of the free tier, leaving plenty of room for other projects.

### Alert Logic

The system distinguishes between two types of alerts based on `alert_on_new`:

1.  **Price Drop Alerts** (`alert_on_new: false` or undefined):
    - **Trigger**: `percent_off` >= `min_discount_percent`.
    - **State**: Stateless. Alerts every time the condition is met during a run (deduplication handles short-term repeats).
    - **Use Case**: E-commerce discounts.

2.  **New Item Alerts** (`alert_on_new: true`):
    - **Trigger**: The item's unique `id` is NOT in `data/history.json`.
    - **State**: Stateful. Persists seen IDs to disk.
    - **Use Case**: Stock trading activity, news feeds.

## Usage

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
npm install
npx playwright install
```

### Running Locally

```bash
# Build the project
npm run build

# Run the scraper
npm start
```

### Environment Variables

- `DISCORD_WEBHOOK`: URL for Discord alerts.
- `LOG_LEVEL`: `debug`, `info`, `warn`, `error`.
- `TEST_MODE`: `true` to disable external alerts.

## Adding a New Retailer

1.  **Config**: Add the retailer to `src/config/products.yaml` and `src/config/site-selectors.ts`.
2.  **Scraper**: Create `src/scrapers/new-retailer-scraper.ts` extending `BaseScraper`.
3.  **Integration**: Register the new scraper in `src/main.ts` and `src/config/config-loader.ts`.
