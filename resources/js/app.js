const data = {
  overview: [
    { label: 'EUR/USD', value: '1.0832', change: '+0.24%', signal: 'Bullish' },
    { label: 'GBP/USD', value: '1.2631', change: '+0.18%', signal: 'Bullish' },
    { label: 'USD/JPY', value: '151.21', change: '-0.08%', signal: 'Neutral' },
    { label: 'USD/ZAR', value: '18.79', change: '+0.62%', signal: 'Strong USD' },
  ],
  strength: [
    { currency: 'USD', score: 88, trend: 'Strong' },
    { currency: 'EUR', score: 74, trend: 'Firm' },
    { currency: 'GBP', score: 71, trend: 'Firm' },
    { currency: 'JPY', score: 60, trend: 'Softening' },
    { currency: 'CAD', score: 64, trend: 'Stable' },
    { currency: 'AUD', score: 63, trend: 'Mild' },
    { currency: 'NZD', score: 58, trend: 'Neutral' },
    { currency: 'ZAR', score: 40, trend: 'Weak' },
  ],
  calendar: [
    { time: '08:30', event: 'US NFP', impact: 'High', symbol: 'USD', forecast: '+190K', prior: '+152K' },
    { time: '10:00', event: 'ECB Rate Decision', impact: 'High', symbol: 'EUR', forecast: '5.25%', prior: '5.25%' },
    { time: '12:00', event: 'BoE CPI', impact: 'Medium', symbol: 'GBP', forecast: '2.1%', prior: '2.3%' },
    { time: '14:00', event: 'BoJ Statement', impact: 'Medium', symbol: 'JPY', forecast: '—', prior: '—' },
  ],
  insights: [
    {
      title: 'USD Strengthens on Solid Jobs Data',
      text: 'USD is strengthening against ZAR due to stronger-than-expected U.S. employment data, stable inflation, and expectations of tighter Fed policy. South African GDP remains weak. Probability of bullish USD/ZAR continuation: 72%.',
    },
    {
      title: 'EUR Holds Near Range Against USD',
      text: 'Euro strength is supported by resilient GDP forecasts and lowered recession risk in the Eurozone. Watch EUR/USD for a break above 1.0850.',
    },
  ],
  watchlist: [
    { pair: 'USD/JPY', target: '151.60', status: 'Neutral' },
    { pair: 'USD/CAD', target: '1.3640', status: 'Bullish' },
    { pair: 'AUD/USD', target: '0.6505', status: 'Watch' },
  ],
  performance: [
    { label: 'Weekly P&L', value: '+4.1%' },
    { label: 'High Confidence Calls', value: '8/10' },
    { label: 'Trade Accuracy', value: '63%' },
  ],
};

const app = document.getElementById('app');

function buildSection(title, subtitle) {
  return `
    <section class="card panel">
      <div class="panel__heading">
        <div>
          <h2>${title}</h2>
          ${subtitle ? `<p>${subtitle}</p>` : ''}
        </div>
      </div>
    </section>
  `;
}

function createOverviewCards(items) {
  return items
    .map(
      (item) => `
      <div class="card">
        <div class="card__title">${item.label}</div>
        <p class="card__value">${item.value}</p>
        <p class="tag ${item.change.startsWith('+') ? 'tag--strong' : 'tag--weak'}">${item.change} • ${item.signal}</p>
      </div>
    `,
    )
    .join('');
}

function createStrengthRows(items) {
  return items
    .map(
      (item) => `
      <tr>
        <td>${item.currency}</td>
        <td>${item.score}</td>
        <td>${item.trend}</td>
      </tr>
    `,
    )
    .join('');
}

function createCalendarRows(items) {
  return items
    .map(
      (event) => `
      <tr>
        <td>${event.time}</td>
        <td>${event.event}</td>
        <td>${event.impact}</td>
        <td>${event.symbol}</td>
        <td>${event.forecast}</td>
        <td>${event.prior}</td>
      </tr>
    `,
    )
    .join('');
}

function createInsightCards(items) {
  return items
    .map(
      (insight) => `
      <article class="insight__item">
        <h3 class="insight__title">${insight.title}</h3>
        <p class="insight__text">${insight.text}</p>
      </article>
    `,
    )
    .join('');
}

function createWatchlistRows(items) {
  return items
    .map(
      (item) => `
      <tr>
        <td>${item.pair}</td>
        <td>${item.target}</td>
        <td>${item.status}</td>
      </tr>
    `,
    )
    .join('');
}

function createPerformanceCards(items) {
  return items
    .map(
      (item) => `
      <div class="card">
        <div class="card__title">${item.label}</div>
        <p class="card__value">${item.value}</p>
      </div>
    `,
    )
    .join('');
}

app.innerHTML = `
  <div class="dashboard">
    <header class="header">
      <div class="brand">
        <div class="brand__title">VinTrade</div>
        <p class="brand__subtitle">AI-powered Forex intelligence for institutional-quality currency analysis, economic monitoring, and trade insight.</p>
      </div>
      <div class="ribbon">Forex-only · Currency strength · AI economic intelligence</div>
    </header>

    <div class="stats">
      ${createPerformanceCards(data.performance)}
    </div>

    <section class="grid">
      <div class="card panel">
        <div class="panel__heading">
          <div>
            <h2>Live Market Overview</h2>
            <p>Major Forex pairs and short-term sentiment.</p>
          </div>
        </div>
        <div class="stats">${createOverviewCards(data.overview)}</div>
      </div>

      <div class="card panel">
        <div class="panel__heading">
          <div>
            <h2>Currency Strength Rankings</h2>
            <p>Dynamic scores based on economics, central-bank data, and market momentum.</p>
          </div>
        </div>
        <div class="chart-placeholder">Currency Strength Wheel / Heatmap placeholder</div>
        <table class="table">
          <thead>
            <tr>
              <th>Currency</th>
              <th>Score</th>
              <th>Trend</th>
            </tr>
          </thead>
          <tbody>${createStrengthRows(data.strength)}</tbody>
        </table>
      </div>
    </section>

    <section class="grid">
      <div class="card panel">
        <div class="panel__heading">
          <div>
            <h2>Economic Calendar</h2>
            <p>Key macro events that drive Forex markets.</p>
          </div>
          <span class="ribbon">Live updates</span>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Event</th>
              <th>Impact</th>
              <th>Symbol</th>
              <th>Forecast</th>
              <th>Prior</th>
            </tr>
          </thead>
          <tbody>${createCalendarRows(data.calendar)}</tbody>
        </table>
      </div>

      <div class="card panel">
        <div class="panel__heading">
          <div>
            <h2>AI Trade Insights</h2>
            <p>Institutional-grade reasoning on currency direction and risk.</p>
          </div>
        </div>
        <div class="insight">${createInsightCards(data.insights)}</div>
      </div>
    </section>

    <section class="grid">
      <div class="card panel">
        <div class="panel__heading">
          <div>
            <h2>Watchlist</h2>
            <p>Pairs to monitor for high-probability setups.</p>
          </div>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th>Pair</th>
              <th>Target</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${createWatchlistRows(data.watchlist)}</tbody>
        </table>
      </div>

      <div class="card panel">
        <div class="panel__heading">
          <div>
            <h2>Technical Analysis</h2>
            <p>Trend, support / resistance, and momentum are analyzed here.</p>
          </div>
        </div>
        <div class="chart-placeholder">Technical analysis dashboard placeholder</div>
      </div>
    </section>
  </div>
`;

if (import.meta.hot) {
  import.meta.hot.accept();
}
