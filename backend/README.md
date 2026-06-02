# VinTrade Aggregator (demo)

This small Node/Express service demonstrates how to aggregate external data sources and expose a normalized `/api/v1/live` endpoint that the VinTrade frontend can consume.

Features
- Fetches configured headline pages (via `VINTRADE_SOURCE_URLS`) and extracts sample headlines
- Attempts Alpha Vantage / Fixer / FRED fetches when API keys are provided
- Normalizes and returns `summary`, `monitors`, `signals`, `news`, `chart`, and `chartSeries`

Quick start
1. Copy `.env.example` to `.env` and edit values (API keys and source URLs).
2. Install dependencies and start server:

```bash
cd backend
npm install
npm start
```

3. In the frontend, set the live endpoint (for example in `index.html`):

```html
<script>
  window.VINTRADE_LIVE_ENDPOINT = 'http://localhost:8080/api/v1/live';
  window.VINTRADE_SOURCE_URLS = 'https://www.reuters.com/finance,https://www.ft.com';
</script>
```

Notes
- This is a demo scaffold. Real integration should handle authentication, rate limits, caching, and data normalization per-provider.
- Use server-side keys for premium feeds (Bloomberg, Refinitiv) and ensure you comply with licensing.
- The aggregator returns `204` when no live data is available.

If you want, I can extend this scaffold to add scheduled polling, caching, or WebSocket push updates.
