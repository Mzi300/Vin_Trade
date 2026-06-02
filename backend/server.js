require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const { parse } = require('node-html-parser');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.VINTRADE_PORT || 8080;

// Environment-configurable sources and keys
const SOURCE_URLS = (process.env.VINTRADE_SOURCE_URLS || '').split(',').map(s => s.trim()).filter(Boolean);
const ALPHA_KEY = process.env.ALPHA_VANTAGE_KEY;
const FIXER_KEY = process.env.FIXER_KEY;
const FRED_KEY = process.env.FRED_KEY;
const OANDA_TOKEN = process.env.OANDA_TOKEN; // optional

// Helpers
const safeJson = async (res) => {
  try { return await res.json(); } catch (e) { return null; }
};

const fetchWorldBank = async () => {
  // Example: fetch GDP (country-level) - here we return empty placeholder
  return { available: false, data: [] };
};

const fetchAlpha = async (symbol = 'EURUSD') => {
  if (!ALPHA_KEY) return null;
  try {
    // Alpha Vantage FX endpoint (example)
    const url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${symbol.slice(0,3)}&to_currency=${symbol.slice(4,7)}&apikey=${ALPHA_KEY}`;
    const res = await fetch(url);
    const json = await safeJson(res);
    return json;
  } catch (e) {
    console.warn('alpha fetch error', e.message);
    return null;
  }
};

const fetchFixer = async (base = 'USD') => {
  if (!FIXER_KEY) return null;
  try {
    const url = `http://data.fixer.io/api/latest?access_key=${FIXER_KEY}&base=${base}`;
    const res = await fetch(url);
    const json = await safeJson(res);
    return json;
  } catch (e) {
    console.warn('fixer error', e.message);
    return null;
  }
};

const fetchFRED = async (series = 'GDP') => {
  if (!FRED_KEY) return null;
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${series}&api_key=${FRED_KEY}&file_type=json`;
    const res = await fetch(url);
    const json = await safeJson(res);
    return json;
  } catch (e) {
    console.warn('fred error', e.message);
    return null;
  }
};

const fetchHtmlFeed = async (url) => {
  try {
    const res = await fetch(url, { timeout: 8000 });
    if (!res.ok) return [];
    const text = await res.text();
    const doc = parse(text);
    const title = doc.querySelector('title')?.text || url;
    const paragraphs = doc.querySelectorAll('p').slice(0,4).map(p => p.text.trim()).join(' ');
    return [{ title, detail: paragraphs }];
  } catch (e) {
    console.warn('html fetch error', url, e.message);
    return [];
  }
};

const extractPairMentions = (text) => {
  if (!text) return [];
  const re = /\b([A-Z]{3}\/[A-Z]{3})\b/g;
  const matches = [];
  let m;
  while ((m = re.exec(text))) matches.push(m[1]);
  return matches;
};

app.get('/api/v1/health', (req, res) => res.json({ status: 'ok' }));

app.get('/api/v1/live', async (req, res) => {
  // Basic normalized response structure
  const out = {
    summary: [],
    monitors: [],
    signals: [],
    watchlist: [],
    news: [],
    chart: {},
    chartSeries: {}
  };

  // 1) Try to fetch market prices from Alpha Vantage if key provided (demo single pair)
  if (ALPHA_KEY) {
    const alpha = await fetchAlpha('EUR/USD');
    if (alpha && alpha['Realtime Currency Exchange Rate']) {
      const rate = alpha['Realtime Currency Exchange Rate']['5. Exchange Rate'];
      out.monitors.push({ label: 'EUR/USD', price: rate, trend: 'live', change: '' });
    }
  }

  // 2) Try Fixer for rates if key
  if (FIXER_KEY) {
    const fx = await fetchFixer('USD');
    if (fx && fx.rates) {
      // include a couple example monitors
      if (fx.rates.EUR) out.monitors.push({ label: 'EUR/USD', price: fx.rates.EUR, trend: 'live', change: '' });
      if (fx.rates.GBP) out.monitors.push({ label: 'GBP/USD', price: fx.rates.GBP, trend: 'live', change: '' });
    }
  }

  // 3) Fetch configured source URLs and build trending signals
  const articles = [];
  for (const url of SOURCE_URLS) {
    const list = await fetchHtmlFeed(url);
    list.forEach(a => articles.push(a));
  }

  // include these headlines in news
  out.news = articles.slice(0, 20).map(a => ({ title: a.title, detail: a.detail }));

  // detect trending pairs
  const mentions = {};
  articles.forEach(({ title, detail }) => {
    const list = extractPairMentions(`${title} ${detail}`.toUpperCase());
    list.forEach(p => mentions[p] = (mentions[p] || 0) + 1);
  });
  const pairs = Object.keys(mentions).sort((a,b) => mentions[b]-mentions[a]).slice(0,6);
  out.signals = pairs.map(p => ({ title: `${p} Trend`, value: `${mentions[p]} mentions`, note: `Mentions of ${p}`, isNew: true }));

  // 4) If no live data populated, return 204
  if (!out.monitors.length && !out.signals.length && !out.news.length) {
    return res.status(204).json({ message: 'No live data available' });
  }

  // 5) Minimal chartSeries demo if any monitor exists
  if (out.monitors.length) {
    out.chart = { pair: out.monitors[0].label, label: 'Live sample' };
    out.chartSeries[out.monitors[0].label] = { label: 'Live sample', points: [1,1,1], labels: [] };
  }

  // 6) Summary demo
  out.summary = [
    { title: 'Total P&L', value: '+$0', change: '+0%' },
    { title: 'Active Trades', value: '0', change: '+0' },
    { title: 'Win Rate', value: '0%', change: '+0%' },
    { title: 'Market Pulse', value: 'Live', change: 'Connected' }
  ];

  res.json(out);
});

app.listen(PORT, () => {
  console.log(`VinTrade aggregator listening on port ${PORT}`);
});
