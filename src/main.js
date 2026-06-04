const data = {
  summary: [],
  monitors: [],
  signals: [],
  watchlist: [],
  news: [],
  chart: {},
};

let liveDataAvailable = false;
let loadingLiveData = true;

const chartSeries = {};

// API base (can be overridden by setting window.VINTRADE_API_URL)
const API_BASE = (window.VINTRADE_API_URL || '/api/v1').replace(/\/$/, '');
const LIVE_ENDPOINT = (window.VINTRADE_LIVE_ENDPOINT || `${API_BASE}/live`).replace(/\/$/, '');
const SOURCE_URLS = Array.isArray(window.VINTRADE_SOURCE_URLS)
  ? window.VINTRADE_SOURCE_URLS
  : String(window.VINTRADE_SOURCE_URLS || '')
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean);

const pairMentionRegex = /\b([A-Z]{3}\/([A-Z]{3}))\b/g;

const extractFeedItemsFromPayload = (payload, url) => {
  if (!payload || typeof payload !== 'object') return [];
  const items = [];
  const entries = Array.isArray(payload.items)
    ? payload.items
    : Array.isArray(payload.entries)
    ? payload.entries
    : Array.isArray(payload.data)
    ? payload.data
    : null;

  if (Array.isArray(payload) || entries) {
    const list = Array.isArray(payload) ? payload : entries;
    list.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const title = item.title || item.headline || item.name || item.label;
      const detail = item.description || item.summary || item.content || item.note || '';
      if (title) items.push({ title: String(title).trim(), detail: String(detail).trim() });
    });
    return items;
  }

  const title = payload.title || payload.headline || payload.name || url;
  const detail = payload.description || payload.summary || payload.content || '';
  return title ? [{ title: String(title).trim(), detail: String(detail).trim() }] : [];
};

const parseHtmlFeed = (text, url) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');
  const title = doc.querySelector('title')?.textContent?.trim() || url;
  const description =
    doc.querySelector('meta[name="description"]')?.content?.trim() ||
    doc.querySelector('meta[property="og:description"]')?.content?.trim() ||
    '';
  const headings = Array.from(doc.querySelectorAll('h1,h2')).slice(0, 2).map((el) => el.textContent.trim()).join(' ');
  const paragraphs = Array.from(doc.querySelectorAll('p')).slice(0, 3).map((el) => el.textContent.trim()).join(' ');
  const detail = [description, headings, paragraphs].filter(Boolean).join(' ');
  return [{ title: String(title), detail: detail || String(title) }];
};

const fetchSourceFeeds = async () => {
  if (!SOURCE_URLS.length) return [];
  const articles = [];
  await Promise.all(SOURCE_URLS.map(async (url) => {
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const contentType = String(res.headers.get('content-type') || '');
      if (contentType.includes('application/json')) {
        const payload = await res.json();
        articles.push(...extractFeedItemsFromPayload(payload, url));
      } else {
        const text = await res.text();
        articles.push(...parseHtmlFeed(text, url));
      }
    } catch (err) {
      console.warn('fetchSourceFeeds error', url, err);
    }
  }));
  return articles;
};

const buildTrendingSignalsFromArticles = (articles) => {
  const pairCounts = {};
  articles.forEach(({ title, detail }) => {
    const content = `${title} ${detail}`.toUpperCase();
    let match = null;
    while ((match = pairMentionRegex.exec(content))) {
      const pair = match[1];
      pairCounts[pair] = (pairCounts[pair] || 0) + 1;
    }
  });
  const sortedPairs = Object.keys(pairCounts).sort((a, b) => pairCounts[b] - pairCounts[a]);
  return sortedPairs.slice(0, 4).map((pair) => ({
    title: `${pair} Trend`,
    value: `${pairCounts[pair]} mentions`,
    note: `Trending headlines mention ${pair} frequently across configured sources.`,
    strengths: `High attention to ${pair} suggests directional pressure and market focus.`,
    risks: `News-driven moves may reverse quickly; validate with price action and risk controls.`,
    volatility: `Pairs with frequent headlines often show elevated intraday range.`,
    isNew: true,
  }));
};

const fetchLiveData = async () => {
  loadingLiveData = true;
  updateTab();

  try {
    const res = await fetch(LIVE_ENDPOINT);
    if (!res.ok) return false;
    if (res.status === 204 || res.headers.get('content-length') === '0') return false;
    const text = await res.text();
    if (!text.trim()) return false;
    const payload = JSON.parse(text);
    if (!payload || typeof payload !== 'object') return false;

    data.summary = Array.isArray(payload.summary) ? payload.summary : [];
    data.monitors = Array.isArray(payload.monitors) ? payload.monitors : [];
    data.signals = Array.isArray(payload.signals) ? payload.signals : [];
    data.watchlist = Array.isArray(payload.watchlist) ? payload.watchlist : [];
    data.news = Array.isArray(payload.news) ? payload.news : [];

    if (payload.chart && typeof payload.chart === 'object') {
      data.chart = Object.assign({}, data.chart, payload.chart);
    }
    if (payload.chartSeries && typeof payload.chartSeries === 'object') {
      Object.keys(payload.chartSeries).forEach((pair) => {
        chartSeries[pair] = payload.chartSeries[pair];
      });
    }

    activePair = data.chart.pair || data.monitors[0]?.pair || null;
    activeSignal = data.signals[0]?.title || activeSignal;
    chartRangeStart = 0;
    liveDataAvailable = !!data.monitors.length;
    return liveDataAvailable;
  } catch (err) {
    console.warn('fetchLiveData error', err);
    return false;
  } finally {
    loadingLiveData = false;
    updateTab();
  }
};

const fetchAlertsFromBackend = async () => {
  try {
    const res = await fetch(`${API_BASE}/alerts`);
    if (!res.ok) return null;
    const payload = await res.json();
    // payload may be an array or an object with `signals` or `data`
    const remoteSignals = Array.isArray(payload) ? payload : (payload.signals || payload.data || []);
    if (!remoteSignals || !remoteSignals.length) return remoteSignals;

    remoteSignals.forEach((rs) => {
      const title = rs.title || rs.name;
      if (!title) return;
      const local = data.signals.find((s) => s.title === title);
      if (local) {
        local.isNew = Boolean(rs.isNew ?? rs.new ?? rs.is_new ?? true);
        if (rs.value) local.value = rs.value;
        if (rs.note) local.note = rs.note;
        if (rs.strengths) local.strengths = rs.strengths;
        if (rs.risks) local.risks = rs.risks;
        if (rs.volatility) local.volatility = rs.volatility;
      } else {
        data.signals.push(Object.assign({}, rs, { title, isNew: Boolean(rs.isNew ?? rs.new ?? rs.is_new ?? true) }));
      }
    });

    return remoteSignals;
  } catch (err) {
    // graceful fallback — log and continue using local data
    // eslint-disable-next-line no-console
    console.warn('fetchAlertsFromBackend error', err);
    return null;
  }
};

const tabs = ['Overview', 'Markets', 'Signals', 'Insights'];
let activeTab = 'Overview';
let activePair = data.chart.pair || null;
let activeSignal = data.signals[0]?.title || null;
const chartWindowSize = 10;
let chartRangeStart = 0;
const app = document.getElementById('app');
const CHAT_KEY = 'vintrade_chat';
const CHAT_BACKUP_KEY = 'vintrade_chat_backup';
const CHAT_COLLAPSE_KEY = 'vintrade_chat_collapsed';

let chatState = (function() {
  try {
    const stored = localStorage.getItem(CHAT_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) {}
  return [ { speaker: 'assistant', text: 'VinTrade AI ready. Ask me for a concise Forex signal, market pulse, or pair outlook.' } ];
})();

let chatCollapsed = (function() {
  try { return localStorage.getItem(CHAT_COLLAPSE_KEY) === 'true'; } catch (e) { return false; }
})();

const persistChat = () => {
  try { localStorage.setItem(CHAT_KEY, JSON.stringify(chatState)); } catch (e) {}
};

const persistCollapse = () => {
  try { localStorage.setItem(CHAT_COLLAPSE_KEY, chatCollapsed ? 'true' : 'false'); } catch (e) {}
};

const UNDO_TIMEOUT = 10000; // milliseconds
let undoTimer = null;
const showUndoTemporary = () => {
  const undoBtn = document.getElementById('chat-undo');
  if (!undoBtn) return;
  undoBtn.classList.remove('hidden');
  if (undoTimer) {
    clearTimeout(undoTimer);
  }
  undoTimer = setTimeout(() => {
    const b = document.getElementById('chat-undo');
    if (b) b.classList.add('hidden');
    undoTimer = null;
  }, UNDO_TIMEOUT);
};

const formatPriceValue = (value) => {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return '--';
  const number = Number(value);
  return number.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 });
};

const formatPercent = (value) => {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return '--';
  const number = Number(value);
  return `${number >= 0 ? '+' : ''}${number.toFixed(2)}%`;
};

const renderCards = (items) => items
  .map((item) => `
    <article class="metric-card">
      <div>
        <p class="metric-title">${item.title}</p>
        <h3>${item.value}</h3>
      </div>
      <span class="metric-change">${item.change}</span>
    </article>
  `)
  .join('');

const renderMonitors = (items) => items
  .map((item) => {
    const pair = item.pair || item.label || '--';
    const trend = item.trend || (typeof item.change_24h === 'number'
      ? (item.change_24h > 0.05 ? 'Up' : item.change_24h < -0.05 ? 'Down' : 'Neutral')
      : 'N/A');
    return `
      <tr class="market-row${pair === activePair ? ' active' : ''}" data-pair="${pair}">
        <td>${pair}</td>
        <td>${formatPriceValue(item.price)}</td>
        <td>${trend}</td>
        <td>${formatPercent(item.change_24h)}</td>
      </tr>
    `;
  })
  .join('');

const renderSignals = (items) => items
  .map((item) => `
    <article class="signal-card${item.title === activeSignal ? ' active' : ''}" data-signal="${item.title}">
      <div class="signal-card-head">
        <div>
          <p>${item.title}</p>
          <h4>${item.value}</h4>
        </div>
        <button class="signal-action" type="button" data-signal="${item.title}">View</button>
      </div>
      <p class="signal-preview">${item.note}</p>
    </article>
  `)
  .join('');

const renderSignalDetail = () => {
  if (!activeSignal) {
    return `
      <div class="panel signal-detail-panel">
        <div class="panel-title">
          <div>
            <h2>Select a signal</h2>
            <span>View details for any available signal</span>
          </div>
        </div>
        <p>Click the View button next to a signal to open its detail panel here.</p>
      </div>
    `;
  }

  const active = data.signals.find((item) => item.title === activeSignal);
  if (!active) return '';

  return `
    <div class="panel signal-detail-panel">
      <div class="panel-title">
        <div>
          <h2>${active.title}</h2>
          <span>Signal details</span>
        </div>
        <div class="chart-summary">
          <strong>${active.value}</strong>
        </div>
      </div>
      <div class="signal-detail-section">
        <h4>Strengths</h4>
        <p>${active.strengths}</p>
      </div>
      <div class="signal-detail-section">
        <h4>Risks</h4>
        <p>${active.risks}</p>
      </div>
      <div class="signal-detail-section">
        <h4>Volatility</h4>
        <p>${active.volatility}</p>
      </div>
      <div class="signal-detail-actions">
        <button type="button">Add to watchlist</button>
        <button type="button">Analyze further</button>
      </div>
    </div>
  `;
};

const renderWatchlist = (items) => items
  .map((item) => `
    <li>
      <strong>${item.pair}</strong>
      <span>${item.target}</span>
      <small>${item.status}</small>
    </li>
  `)
  .join('');

const renderNews = (items) => items
  .map((item) => `
    <article class="news-card">
      <h4>${item.title}</h4>
      <p>${item.detail}</p>
    </article>
  `)
  .join('');

const renderChat = () => chatState
  .map((message) => `
    <div class="chat-message ${message.speaker}">
      <p>${String(message.text).replace(/\n/g, '<br/>')}</p>
    </div>
  `)
  .join('');

const estimateConfidence = (pair) => {
  if (!pair) return 'low';
  if (chartSeries[pair] && chartSeries[pair].points.length > 8) return 'medium';
  if (data.monitors.find((m) => m.pair === pair || m.label === pair)) return 'low';
  return 'low';
};

const showConfirmClear = () => {
  const modal = document.getElementById('confirm-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
};

const closeConfirmClear = () => {
  const modal = document.getElementById('confirm-modal');
  if (!modal) return;
  modal.classList.add('hidden');
};

const doClearConversation = () => {
  try {
    localStorage.setItem(CHAT_BACKUP_KEY, JSON.stringify(chatState));
  } catch (e) {}
  chatState.splice(0, chatState.length);
  chatState.push({ speaker: 'assistant', text: 'VinTrade AI ready. Ask me for a concise Forex signal, market pulse, or pair outlook.' });
  persistChat();
  updateTab();
  // show undo control if present
  // show undo button temporarily (backup persists across sessions)
  showUndoTemporary();
};

const undoConversation = () => {
  try {
    const backup = localStorage.getItem(CHAT_BACKUP_KEY);
    if (!backup) return;
    chatState = JSON.parse(backup);
    localStorage.removeItem(CHAT_BACKUP_KEY);
    persistChat();
    updateTab();
    const undoBtn = document.getElementById('chat-undo'); if (undoBtn) undoBtn.classList.add('hidden');
    if (undoTimer) { clearTimeout(undoTimer); undoTimer = null; }
  } catch (e) {}
};

const clearConversation = () => {
  showConfirmClear();
};

const toggleChatCollapse = () => {
  chatCollapsed = !chatCollapsed;
  persistCollapse();
  const history = document.getElementById('chat-history');
  if (!history) return;
  history.classList.toggle('collapsed', chatCollapsed);
};

const LIVE_DATA_NOTICE = 'If you want real trend signals, the app needs a live data source integrated (API feed or broker price stream).';

const summarizeTrend = (series) => {
  if (!series || !series.points || series.points.length < 2) return 'No clear trend';
  const first = series.points[0];
  const last = series.points[series.points.length - 1];
  const pct = ((last - first) / Math.abs(first || last)) * 100;
  const direction = pct > 0.15 ? 'bullish' : pct < -0.15 ? 'bearish' : 'sideways';
  return { direction, pct: pct.toFixed(2), first, last };
};

const generateDetailedReply = (text) => {
  const lower = String(text || '').toLowerCase();
  const pairMatch = text.match(/([A-Za-z]{3}\/([A-Za-z]{3}))/);
  const pairCode = pairMatch ? pairMatch[1].toUpperCase() : null;

  if (pairCode) {
    const result = [];
    const monitor = data.monitors.find((m) => m.pair === pairCode || m.label === pairCode);
    const series = chartSeries[pairCode];

    // Market Overview
    result.push('📈 Market Overview');
    if (monitor) {
      result.push(`${pairCode} — ${monitor.price} (${monitor.trend}, ${monitor.change})`);
    } else if (series) {
      const last = series.points[series.points.length - 1];
      result.push(`${pairCode} — latest available value: ${last} (historical series present)`);
    } else {
      return 'I do not have access to that data.';
    }

    // Key Drivers (inferred from local news/signals)
    result.push('\n🔍 Key Drivers');
    const relatedNews = data.news.map((n) => `- ${n.title}`).slice(0, 3);
    if (relatedNews.length) {
      result.push('Based on VinTrade feeds and local context, possible drivers include:');
      result.push(relatedNews.join('\n'));
    } else {
      result.push('No explicit news in local data; common drivers are macro data, central bank policy, and liquidity.')
    }

    // Risk Factors
    result.push('\n⚠️ Risk Factors');
    result.push('Market volatility, policy announcements, and data surprises can change the short-term view. Always consider position sizing and stop-loss rules.');

    // Scenarios
    result.push('\n💡 Possible Scenarios');
    if (series) {
      const trend = summarizeTrend(series);
      if (trend.direction === 'bullish') {
        result.push('- Bullish scenario: continuation with momentum; watch for higher highs and supportive macro releases.');
        result.push(`- Recent change over period: ${trend.pct}%`);
      } else if (trend.direction === 'bearish') {
        result.push('- Bearish scenario: further downside with potential support at prior lows.');
        result.push(`- Recent change over period: ${trend.pct}%`);
      } else {
        result.push('- Neutral: range-bound action; consider smaller time-frame signals for entries.');
      }
    } else {
      result.push('- Not enough historical series to form scenario analysis.');
    }

    // Insight / Education
    result.push('\n🧠 Insight / Education');
    result.push('Look at trend consistency, volume (if available), and economic calendar events to validate a directional view. Use risk controls and avoid over-leveraging.');

    // Confidence
    result.push('\n❓ Confidence Level');
    result.push(`My confidence is ${estimateConfidence(pairCode)} based on the amount of local VinTrade data available.`);

    // Final reminder
    result.push('\n🚫 Disclaimer');
    result.push('This information is for educational/interpretation purposes only. I do not execute trades and cannot guarantee outcomes.');
    result.push(LIVE_DATA_NOTICE);

    return result.join('\n');
  }

  // Generic educational fallback when pair not specified
  if (lower.includes('price') || lower.includes('rate')) {
    return 'Please specify the currency pair, for example: "What is EUR/USD price right now?"';
  }

  return 'I do not have access to external real-time data in this environment. I can provide educational explanations, scenario analysis, and help interpret the local dashboard data. ' + LIVE_DATA_NOTICE;
};

const sendMessage = (raw) => {
  const text = String(raw || '').trim();
  if (!text) return;
  chatState.push({ speaker: 'user', text });
  updateTab();

  // generate a detailed assistant reply (uses only local VinTrade data)
  const reply = generateDetailedReply(text);
  chatState.push({ speaker: 'assistant', text: reply });
  updateTab();

  const input = document.getElementById('chat-input');
  if (input) input.value = '';
};

const getCurrentChart = () => chartSeries[activePair] || { points: [], labels: [] };

const getChartSummary = () => data.monitors.find((item) => item.pair === activePair || item.label === activePair) || { price: '--', change_24h: null };

const getVisibleChartData = () => {
  const current = getCurrentChart();
  const start = Math.max(0, Math.min(chartRangeStart, current.points.length - chartWindowSize));
  const end = start + chartWindowSize;
  return {
    points: current.points.slice(start, end),
    labels: current.labels.slice(start, end),
  };
};

const getChartRangeLimit = () => Math.max(0, getCurrentChart().points.length - chartWindowSize);

const getChartRangeLabel = () => {
  const current = getCurrentChart();
  if (!current.labels || !current.labels.length) return 'No chart range';
  const startLabel = current.labels[chartRangeStart] || current.labels[0];
  const endLabel = current.labels[Math.min(chartRangeStart + chartWindowSize - 1, current.labels.length - 1)] || current.labels[current.labels.length - 1];
  return `${startLabel} — ${endLabel}`;
};

const moveChartRange = (delta) => {
  chartRangeStart = Math.max(0, Math.min(getChartRangeLimit(), chartRangeStart + delta));
  updateTab();
};

const setChartRange = (index) => {
  chartRangeStart = Math.max(0, Math.min(getChartRangeLimit(), index));
  updateTab();
};

const updateChartControls = () => {
  const rangeLabel = document.getElementById('range-label');
  if (rangeLabel) {
    rangeLabel.textContent = getChartRangeLabel();
  }
  const dots = document.querySelectorAll('.range-dot');
  dots.forEach((dot) => {
    const index = Number(dot.dataset.index);
    dot.classList.toggle('active', index >= chartRangeStart && index < chartRangeStart + chartWindowSize);
  });
};

const getChartSvg = () => {
  const width = 560;
  const height = 260;
  const current = getCurrentChart();
  const visible = getVisibleChartData();
  const points = visible.points;

  if (!points.length) {
    return `<div class="chart-empty">No chart data available for ${activePair || 'the selected pair'}.</div>`;
  }

  const min = Math.min(...current.points);
  const max = Math.max(...current.points);
  const span = max === min ? min + 1 : max - min;
  const step = width / (points.length - 1);
  const svgPoints = points
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / span) * height;
      return `${x},${y}`;
    })
    .join(' ');
  const bars = points
    .map((value, index) => {
      const x = index * step - step * 0.24;
      const barHeight = ((value - min) / span) * height;
      const y = height - barHeight;
      return `<rect x="${x}" y="${y}" width="${step * 0.48}" height="${barHeight}" rx="8" ry="8" />`;
    })
    .join('');

  return `
    <svg class="market-chart" viewBox="0 0 ${width} ${height}" aria-label="${activePair || 'forex'} chart">
      <defs>
        <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.55" />
          <stop offset="100%" stop-color="#38bdf8" stop-opacity="0" />
        </linearGradient>
      </defs>
      <g class="chart-grid">
        ${[1, 2, 3, 4].map((i) => `<line x1="0" y1="${(height / 5) * i}" x2="${width}" y2="${(height / 5) * i}" />`).join('')}
      </g>
      <g class="chart-bars">
        ${bars}
      </g>
      <path d="M ${svgPoints}" fill="none" stroke="#38bdf8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      <polygon points="${svgPoints} ${width},${height} 0,${height}" fill="url(#chartGradient)" opacity="0.45" />
      ${points.map((value, index) => `
        <circle cx="${index * step}" cy="${height - ((value - min) / span) * height}" r="4" fill="#ffffff" stroke="#2563eb" stroke-width="2" />
      `).join('')}
    </svg>
  `;
};

const renderChartPanel = () => {
  const chartWrapper = document.getElementById('chart-wrapper');
  if (!chartWrapper) return;
  const visible = getVisibleChartData();
  chartWrapper.innerHTML = `
    ${getChartSvg()}
    <div class="chart-labels">
      ${visible.labels.map((label) => `<span>${label}</span>`).join('')}
    </div>
    <div class="chart-tip">Drag the chart to view older data from the last month or use the range controls below.</div>
  `;
  updateChartControls();
};

const renderTabContent = () => {
  if (loadingLiveData) {
    return `
      <section class="panel empty-state">
        <div class="panel-title">
          <h2>Waiting for market data...</h2>
          <span>Loading real-time forex data from Twelve Data or Alpha Vantage.</span>
        </div>
        <p>Please wait while VinTrade connects to the configured live data sources.</p>
      </section>
    `;
  }

  if (!liveDataAvailable || !data.monitors.length) {
    return `
      <section class="panel empty-state">
        <div class="panel-title">
          <h2>Waiting for market data...</h2>
          <span>No valid forex data is available.</span>
        </div>
        <p>The dashboard will populate once the configured currency pairs are served by the live APIs.</p>
      </section>
    `;
  }

  if (activeTab === 'Markets') {
    return `
      <section class="grid-two">
        <div class="panel card-panel chart-panel">
          <div class="panel-title">
            <div>
              <h2>${activePair} Price Chart</h2>
              <span>${getCurrentChart().label}</span>
            </div>
            <div class="chart-summary">
              <strong>${formatPriceValue(getChartSummary().price)}</strong>
              <small>${formatPercent(getChartSummary().change_24h)} Today</small>
            </div>
          </div>
          <div class="chart-controls-row">
            <div class="range-actions">
              <button id="range-prev" class="range-btn" type="button">←</button>
              <span id="range-label">${getChartRangeLabel()}</span>
              <button id="range-next" class="range-btn" type="button">→</button>
            </div>
            <div class="range-slider">
              ${getCurrentChart().labels.map((label, index) => `
                <button class="range-dot${index >= chartRangeStart && index < chartRangeStart + chartWindowSize ? ' active' : ''}" data-index="${index}" type="button" aria-label="View ${label}"></button>
              `).join('')}
            </div>
          </div>
          <div class="chart-wrapper" id="chart-wrapper">
            ${getChartSvg()}
            <div class="chart-labels">
              ${getVisibleChartData().labels.map((label) => `<span>${label}</span>`).join('')}
            </div>
            <div class="chart-tip">Drag the chart to view older data from the last month or use the range controls below.</div>
          </div>
        </div>
        <div class="panel card-panel">
          <div class="panel-title">
            <h2>Market Monitor</h2>
            <span>Major pairs</span>
          </div>
          <table class="market-table">
            <thead>
              <tr><th>Pair</th><th>Price</th><th>Trend</th><th>Change</th></tr>
            </thead>
            <tbody>${renderMonitors(data.monitors)}</tbody>
          </table>
        </div>
      </section>
    `;
  }

  if (activeTab === 'Signals') {
    return `
      <section class="grid-two">
        <div class="panel card-panel">
          <div class="panel-title">
            <h2>Signal Strength</h2>
            <span>Macro and technical analysis</span>
          </div>
          <div class="signal-list">${renderSignals(data.signals)}</div>
          ${renderSignalDetail()}
        </div>
        <div class="panel card-panel">
          <div class="panel-title">
            <h2>Watchlist</h2>
            <span>Pairs to monitor</span>
          </div>
          <ul class="watchlist">${renderWatchlist(data.watchlist)}</ul>
        </div>
      </section>
    `;
  }

  if (activeTab === 'Insights') {
    return `
      <section class="grid-three">
        <div class="panel card-panel news-panel">
          <div class="panel-title">
            <h2>Market News</h2>
            <span>Latest headlines</span>
          </div>
          ${renderNews(data.news)}
        </div>
        <div class="panel card-panel">
          <div class="panel-title">
            <h2>AI Chat</h2>
            <span>Ask VinTrade</span>
          </div>
          <div id="chat-history" class="chat-history">${renderChat()}</div>
          <div class="chat-input-row">
            <textarea id="chat-input" rows="2" placeholder="Ask a Forex question..."></textarea>
            <div class="chat-controls">
              <button id="chat-toggle" class="small-btn" type="button" title="Collapse chat">▾</button>
              <button id="chat-clear" class="small-btn" type="button" title="Clear conversation">Clear</button>
              <button id="chat-undo" class="small-btn hidden" type="button" title="Undo clear">Undo</button>
              <button id="chat-send">Send</button>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  if (!liveDataAvailable) {
    return '';
  }

  return `
    <section class="metrics-grid">${renderCards(data.summary)}</section>
    <section class="panel card-panel">
      <div class="panel-title">
        <h2>Top FX Monitor</h2>
        <span>Major currency pair snapshot</span>
      </div>
      <table class="market-table">
        <thead>
          <tr><th>Pair</th><th>Price</th><th>Trend</th><th>Change</th></tr>
        </thead>
        <tbody>${renderMonitors(data.monitors)}</tbody>
      </table>
    </section>
  `;
};

const renderApp = () => {
  app.innerHTML = `
    <div class="dashboard-shell">
      <aside class="sidebar">
        <div class="brand-block">
          <span>VinTrade</span>
          <p>Forex admin dashboard</p>
        </div>
        <nav>
          ${tabs.map((tab) => `
            <a class="nav-link${tab === activeTab ? ' active' : ''}" data-tab="${tab}">${tab}</a>
          `).join('')}
        </nav>
      </aside>
      <main class="main-panel">
        <header class="topbar">
          <div>
            <h1>${activeTab}</h1>
            <p>Realtime Forex pulse and AI trading dashboard.</p>
          </div>
          <button class="action-btn">New Alert</button>
        </header>
        <div class="tab-content" id="tab-content">${renderTabContent()}</div>
        <div id="alerts-area"></div>
        <div id="confirm-modal" class="confirm-modal hidden" role="dialog" aria-modal="true">
          <div class="modal-backdrop"></div>
          <div class="modal-box">
            <h3>Clear conversation?</h3>
            <p>Are you sure you want to clear the chat? You can undo immediately using the Undo button.</p>
            <div class="modal-actions">
              <button id="confirm-cancel" class="small-btn" type="button">Cancel</button>
              <button id="confirm-yes" class="small-btn" type="button">Clear</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  `;
};

const renderAlerts = () => {
  const newTrends = data.signals.filter((s) => s.isNew);
  if (!newTrends.length) return `<div class="panel alerts-panel"><div class="panel-title"><h2>New Alerts</h2><span>No new trends</span></div><div class="alerts-empty">No new trends available</div></div>`;

  return `
    <div class="panel alerts-panel">
      <div class="panel-title">
        <div>
          <h2>New Alerts</h2>
          <span>Latest trends</span>
        </div>
      </div>
      <div class="alerts-list">
        ${newTrends.map((t) => `
          <article class="alert-item" data-signal="${t.title}">
            <h4>${t.title}</h4>
            <p>${t.note}</p>
            <small>${t.value}</small>
          </article>
        `).join('')}
      </div>
    </div>
  `;
};

const toggleAlerts = async () => {
  const area = document.getElementById('alerts-area');
  if (!area) return;
  // if already filled, clear it
  if (area.innerHTML.trim()) {
    area.innerHTML = '';
    return;
  }
  // attempt to refresh signals from backend before rendering
  await fetchAlertsFromBackend();
  area.innerHTML = renderAlerts();

  // attach click handlers so clicking an alert opens the signal detail
  const items = Array.from(document.querySelectorAll('.alert-item'));
  items.forEach((it) => {
    it.addEventListener('click', () => {
      const sig = it.dataset.signal;
      if (sig) {
        activeSignal = sig;
        updateTab();
        // keep alerts visible
        document.getElementById('alerts-area').innerHTML = renderAlerts();
      }
    });
  });
};

const updateTab = () => {
  renderApp();
  const navLinks = Array.from(document.querySelectorAll('.nav-link'));
  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      activeTab = link.dataset.tab;
      updateTab();
    });
  });
  const input = document.getElementById('chat-input');
  const sendButton = document.getElementById('chat-send');
  if (sendButton && input) {
    sendButton.addEventListener('click', () => sendMessage(input.value));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        sendMessage(input.value);
      }
    });
  }
  const clearButton = document.getElementById('chat-clear');
  if (clearButton) {
    clearButton.addEventListener('click', () => clearConversation());
  }
  const toggleButton = document.getElementById('chat-toggle');
  if (toggleButton) {
    toggleButton.addEventListener('click', () => toggleChatCollapse());
  }
  const undoButton = document.getElementById('chat-undo');
  if (undoButton) {
    undoButton.addEventListener('click', () => undoConversation());
    // show undo if backup exists (temporary auto-hide)
    try { if (localStorage.getItem(CHAT_BACKUP_KEY)) showUndoTemporary(); } catch (e) {}
  }

  // apply persisted collapse state
  const history = document.getElementById('chat-history');
  if (history) history.classList.toggle('collapsed', chatCollapsed);

  // modal buttons
  const modalCancel = document.getElementById('confirm-cancel');
  const modalYes = document.getElementById('confirm-yes');
  if (modalCancel) modalCancel.addEventListener('click', () => closeConfirmClear());
  if (modalYes) modalYes.addEventListener('click', () => { closeConfirmClear(); doClearConversation(); });

  const chartWrapper = document.getElementById('chart-wrapper');
  if (chartWrapper) {
    let dragging = false;
    let startX = 0;
    let startIndex = chartRangeStart;

    chartWrapper.style.cursor = 'grab';

    const onPointerDown = (event) => {
      dragging = true;
      startX = event.clientX;
      startIndex = chartRangeStart;
      chartWrapper.setPointerCapture(event.pointerId);
      chartWrapper.classList.add('dragging');
    };

    const onPointerMove = (event) => {
      if (!dragging) return;
      const dx = event.clientX - startX;
      const step = 36;
      const delta = Math.round(-dx / step);
      const updated = Math.max(0, Math.min(getChartRangeLimit(), startIndex + delta));
      if (updated !== chartRangeStart) {
        chartRangeStart = updated;
        renderChartPanel();
      }
    };

    const onPointerUp = (event) => {
      dragging = false;
      chartWrapper.releasePointerCapture(event.pointerId);
      chartWrapper.classList.remove('dragging');
    };

    chartWrapper.addEventListener('pointerdown', onPointerDown);
    chartWrapper.addEventListener('pointermove', onPointerMove);
    chartWrapper.addEventListener('pointerup', onPointerUp);
    chartWrapper.addEventListener('pointerleave', () => {
      dragging = false;
      chartWrapper.classList.remove('dragging');
    });
  }

  const prevButton = document.getElementById('range-prev');
  const nextButton = document.getElementById('range-next');
  if (prevButton) {
    prevButton.addEventListener('click', () => moveChartRange(-1));
  }
  if (nextButton) {
    nextButton.addEventListener('click', () => moveChartRange(1));
  }

  const dotButtons = Array.from(document.querySelectorAll('.range-dot'));
  dotButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.index);
      setChartRange(index);
    });
  });

  const monitorRows = document.querySelectorAll('[data-pair]');
  monitorRows.forEach((row) => {
    row.addEventListener('click', () => {
      const selectedPair = row.dataset.pair;
      if (selectedPair && selectedPair !== activePair) {
        activePair = selectedPair;
        chartRangeStart = Math.max(0, getChartRangeLimit());
        updateTab();
      }
    });
  });

  const signalButtons = Array.from(document.querySelectorAll('.signal-action'));
  signalButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const selectedSignal = button.dataset.signal;
      if (selectedSignal && selectedSignal !== activeSignal) {
        activeSignal = selectedSignal;
        updateTab();
      }
    });
  });

  const signalCards = Array.from(document.querySelectorAll('article[data-signal]'));
  signalCards.forEach((card) => {
    card.addEventListener('click', (event) => {
      if (event.target.closest('.signal-action')) return;
      const selectedSignal = card.dataset.signal;
      if (selectedSignal && selectedSignal !== activeSignal) {
        activeSignal = selectedSignal;
        updateTab();
      }
    });
  });
  
  // New Alert button toggles alerts panel
  const newAlertBtn = document.querySelector('.action-btn');
  if (newAlertBtn) {
    newAlertBtn.addEventListener('click', () => {
      toggleAlerts();
    });
  }
};

const initApp = async () => {
  await fetchLiveData();
  updateTab();
};

initApp();

if (import.meta.hot) {
  import.meta.hot.accept();
}
