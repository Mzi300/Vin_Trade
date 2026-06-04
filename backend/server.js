require('dotenv').config();
const path = require('path');
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const { parse } = require('node-html-parser');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));
app.get('/favicon.svg', (req, res) => res.status(204).end());

const PORT = process.env.VINTRADE_PORT || 8080;

// Environment-configurable sources and keys
const SOURCE_URLS = (process.env.VINTRADE_SOURCE_URLS || '').split(',').map(s => s.trim()).filter(Boolean);
const TWELVE_KEY = process.env.TWELVE_DATA_KEY || '';
const ALPHA_KEY = process.env.ALPHA_VANTAGE_KEY || '';
const CURRENCY_PAIRS = (process.env.VINTRADE_PAIRS || '').split(',')
  .map((value) => value.trim())
  .filter(Boolean)
  .map((pair) => {
    const normalized = pair.toUpperCase().replace(/[^A-Z\/]/g, '');
    return normalized.includes('/') ? normalized : normalized.length === 6 ? `${normalized.slice(0, 3)}/${normalized.slice(3, 6)}` : normalized;
  })
  .filter((pair) => /^[A-Z]{3}\/[A-Z]{3}$/.test(pair));
const MARKET_SOURCE = process.env.VINTRADE_MARKET_SOURCE || 'twelve_data';

if (!TWELVE_KEY && !ALPHA_KEY) {
  console.warn('No Twelve Data or Alpha Vantage API key configured. Live forex data will be unavailable.');
}

// Helpers
const safeJson = async (res) => {
  try { return await res.json(); } catch (e) { return null; }
};

const normalizePair = (pair) => {
  if (!pair) return null;
  const normalized = String(pair).trim().toUpperCase().replace(/[^A-Z\/]/g, '');
  if (normalized.includes('/')) return normalized;
  if (normalized.length === 6) return `${normalized.slice(0, 3)}/${normalized.slice(3, 6)}`;
  return null;
};

const getPairSymbols = (pair) => {
  const normalized = normalizePair(pair);
  if (!normalized) return null;
  const [base, quote] = normalized.split('/');
  return { pair: normalized, base, quote };
};

const fetchTwelveQuote = async (pair) => {
  if (!TWELVE_KEY) return null;
  const symbols = getPairSymbols(pair);
  if (!symbols) return null;
  try {
    const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbols.pair)}&apikey=${TWELVE_KEY}`;
    const res = await fetch(url);
    const json = await safeJson(res);
    if (!json || json.status === 'error' || !json.close) return null;
    return json;
  } catch (e) {
    console.warn('twelve quote fetch error', e.message);
    return null;
  }
};

const fetchTwelveTimeSeries = async (pair, interval = '1day', outputsize = 30) => {
  if (!TWELVE_KEY) return null;
  const symbols = getPairSymbols(pair);
  if (!symbols) return null;
  try {
    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbols.pair)}&interval=${interval}&outputsize=${outputsize}&format=JSON&apikey=${TWELVE_KEY}`;
    const res = await fetch(url);
    const json = await safeJson(res);
    if (!json || json.status === 'error' || !Array.isArray(json.values)) return null;
    return json;
  } catch (e) {
    console.warn('twelve series fetch error', e.message);
    return null;
  }
};

const fetchAlphaQuote = async (pair) => {
  if (!ALPHA_KEY) return null;
  const symbols = getPairSymbols(pair);
  if (!symbols) return null;
  try {
    const url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${symbols.base}&to_currency=${symbols.quote}&apikey=${ALPHA_KEY}`;
    const res = await fetch(url);
    const json = await safeJson(res);
    if (!json || !json['Realtime Currency Exchange Rate']) return null;
    return json['Realtime Currency Exchange Rate'];
  } catch (e) {
    console.warn('alpha quote fetch error', e.message);
    return null;
  }
};

const fetchAlphaTimeSeries = async (pair) => {
  if (!ALPHA_KEY) return null;
  const symbols = getPairSymbols(pair);
  if (!symbols) return null;
  try {
    const url = `https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=${symbols.base}&to_symbol=${symbols.quote}&apikey=${ALPHA_KEY}&outputsize=compact`;
    const res = await fetch(url);
    const json = await safeJson(res);
    if (!json || !json['Time Series FX (Daily)']) return null;
    return json;
  } catch (e) {
    console.warn('alpha series fetch error', e.message);
    return null;
  }
};

const parseTimeSeries = (raw, source) => {
  if (!raw) return [];
  if (source === 'twelve_data' && Array.isArray(raw.values)) {
    return raw.values
      .map((entry) => ({
        timestamp: entry.datetime ? Date.parse(entry.datetime) : null,
        close: entry.close ? Number(entry.close) : null,
      }))
      .filter((entry) => entry.timestamp && !Number.isNaN(entry.close))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  if (source === 'alpha_vantage' && raw['Time Series FX (Daily)']) {
    return Object.entries(raw['Time Series FX (Daily)'])
      .map(([date, values]) => ({
        timestamp: Date.parse(date),
        close: values['4. close'] ? Number(values['4. close']) : null,
      }))
      .filter((entry) => entry.timestamp && !Number.isNaN(entry.close))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  return [];
};

const makeMonitorItem = (pair, source, quote, series) => {
  if (!pair || !quote || !series || series.length < 2) return null;
  const latest = series[series.length - 1];
  const previous = series[series.length - 2];
  const price = Number(quote.close || quote['5. Exchange Rate'] || quote['price']);
  if (!latest || !previous || Number.isNaN(price) || Number.isNaN(latest.close) || Number.isNaN(previous.close) || previous.close === 0) return null;
  const change_24h = Number((((price - previous.close) / Math.abs(previous.close)) * 100).toFixed(4));
  return {
    pair,
    price,
    change_24h,
    timestamp: Math.floor(latest.timestamp / 1000),
    source,
    trend: change_24h > 0.05 ? 'Up' : change_24h < -0.05 ? 'Down' : 'Neutral',
  };
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
  const out = {
    summary: [],
    monitors: [],
    signals: [],
    watchlist: [],
    news: [],
    chart: {},
    chartSeries: {}
  };

  if (!CURRENCY_PAIRS.length) {
    return res.status(204).json({ message: 'No currency pairs configured for live pricing' });
  }

  const fetchPairData = async (pair) => {
    const normalizedPair = normalizePair(pair);
    if (!normalizedPair) return null;

    const twelveQuote = await fetchTwelveQuote(normalizedPair);
    const twelveSeries = await fetchTwelveTimeSeries(normalizedPair);
    const twelveSeriesData = parseTimeSeries(twelveSeries, 'twelve_data');

    const alphaQuote = await fetchAlphaQuote(normalizedPair);
    const alphaSeries = await fetchAlphaTimeSeries(normalizedPair);
    const alphaSeriesData = parseTimeSeries(alphaSeries, 'alpha_vantage');

    const twelveAvailable = twelveQuote && twelveSeriesData.length >= 2;
    const alphaAvailable = alphaQuote && alphaSeriesData.length >= 2;

    if (!twelveAvailable && !alphaAvailable) return null;

    let source = 'alpha_vantage';
    let quote = alphaQuote;
    let seriesData = alphaSeriesData;

    if (twelveAvailable) {
      source = 'twelve_data';
      quote = twelveQuote;
      seriesData = twelveSeriesData;
    }

    const monitor = makeMonitorItem(normalizedPair, source, quote, seriesData);
    if (!monitor) return null;

    return {
      monitor,
      chart: {
        label: 'Daily History',
        points: seriesData.map((entry) => entry.close),
        labels: seriesData.map((entry) => new Date(entry.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
      }
    };
  };

  const results = await Promise.all(CURRENCY_PAIRS.map(fetchPairData));
  const pairResults = results.filter(Boolean);

  if (!pairResults.length) {
    return res.status(204).json({ message: 'No valid live forex data available' });
  }

  out.monitors = pairResults.map((item) => item.monitor);
  pairResults.forEach((item) => {
    out.chartSeries[item.monitor.pair] = item.chart;
  });

  out.chart = {
    pair: out.monitors[0].pair,
    label: out.chartSeries[out.monitors[0].pair]?.label || 'Daily History'
  };

  const sortedMonitors = [...out.monitors]
    .filter((item) => typeof item.change_24h === 'number')
    .sort((a, b) => Math.abs(b.change_24h) - Math.abs(a.change_24h));
  const topMover = sortedMonitors[0];
  const primarySource = out.monitors.some((item) => item.source === 'twelve_data') ? 'Twelve Data' : 'Alpha Vantage';

  out.summary = [
    { title: 'Active Pairs', value: `${out.monitors.length}`, change: '' },
    { title: 'Top Mover', value: topMover ? topMover.pair : 'N/A', change: topMover ? `${topMover.change_24h.toFixed(2)}%` : '' },
    { title: 'Primary Source', value: primarySource, change: '' },
    { title: 'Updated', value: new Date(out.monitors[0].timestamp * 1000).toISOString(), change: '' }
  ];

  out.signals = sortedMonitors.slice(0, 4).map((item) => ({
    title: `${item.pair} 24H`,
    value: `${item.change_24h.toFixed(2)}%`,
    note: `Actual 24-hour change calculated from ${item.source} time-series data.`,
    isNew: true
  }));

  if (SOURCE_URLS.length) {
    const articles = [];
    for (const url of SOURCE_URLS) {
      const list = await fetchHtmlFeed(url);
      list.forEach((a) => articles.push(a));
    }
    out.news = articles.slice(0, 20).map((a) => ({ title: a.title, detail: a.detail }));
  }

  res.json(out);
});

app.listen(PORT, () => {
  console.log(`VinTrade aggregator listening on port ${PORT}`);
});
