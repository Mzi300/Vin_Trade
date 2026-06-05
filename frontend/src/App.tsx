import ReactMarkdown from 'react-markdown';
import React, { useState, useEffect } from 'react';
import { AdvancedRealTimeChart } from "react-ts-tradingview-widgets";

function App() {
  const [adminKey, setAdminKey] = useState(localStorage.getItem('admin_key') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('admin_key'));

  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Admin-Key': adminKey,
      ...(options.headers || {}),
    };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      localStorage.removeItem('admin_key');
      setIsAuthenticated(false);
      setAdminKey('');
      throw new Error('Unauthorized');
    }
    return res;
  };

  const [activeTab, setActiveTab] = useState<'workspace' | 'portfolio' | 'review'>('workspace');

  // Tab click handlers
  const handleTabClick = (tab: 'workspace' | 'portfolio' | 'review') => () => setActiveTab(tab);

  const TABS: ('workspace' | 'portfolio' | 'review')[] = ['workspace', 'portfolio', 'review'];

  const handleBack = () => {
    const currentIndex = TABS.indexOf(activeTab);
    const newIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    setActiveTab(TABS[newIndex]);
  };

  const handleForward = () => {
    const currentIndex = TABS.indexOf(activeTab);
    const newIndex = (currentIndex + 1) % TABS.length;
    setActiveTab(TABS[newIndex]);
  };

  const [messages, setMessages] = useState<{role: string, content: string}[]>([]);
  const [input, setInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [timeframe, setTimeframe] = useState('daily'); // hourly, daily, weekly
  
  const [forexData, setForexData] = useState<any[]>([]);
  const [selectedPair, setSelectedPair] = useState<string>('EUR/USD');
  const [isLoadingForex, setIsLoadingForex] = useState(true);

  const [trades, setTrades] = useState<any[]>([]);
  const [isLoadingTrades, setIsLoadingTrades] = useState(false);

  // Trade Review Form State
  const [reviewForm, setReviewForm] = useState({ pair: 'EUR/USD', bias: 'BUY', entry: '', sl: '', tp: '', risk: '1.5' });
  const [reviewResult, setReviewResult] = useState<any>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isSavingTrade, setIsSavingTrade] = useState(false);

  const handleReviewTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsReviewing(true);
    try {
      const res = await fetchWithAuth('http://localhost:8000/api/trade-review', {
        method: 'POST',
        body: JSON.stringify({
          pair: reviewForm.pair,
          bias: reviewForm.bias,
          entry_price: Number(reviewForm.entry),
          stop_loss: Number(reviewForm.sl),
          take_profit: Number(reviewForm.tp),
          risk_percentage: Number(reviewForm.risk)
        })
      });
      const data = await res.json();
      setReviewResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsReviewing(false);
    }
  };

  const handleSaveTrade = async () => {
    setIsSavingTrade(true);
    try {
      await fetchWithAuth('http://localhost:8000/api/trades', {
        method: 'POST',
        body: JSON.stringify({
          currency_pair: reviewForm.pair,
          bias: reviewForm.bias,
          entry_price: Number(reviewForm.entry),
          stop_loss: Number(reviewForm.sl),
          take_profit: Number(reviewForm.tp),
          risk_percentage: Number(reviewForm.risk)
        })
      });
      setTrades([]); // clear cache to refetch
      setActiveTab('portfolio');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingTrade(false);
      setReviewResult(null);
    }
  };

  useEffect(() => {
    if (activeTab === 'portfolio' && trades.length === 0) {
      const fetchTrades = async () => {
        try {
          setIsLoadingTrades(true);
          const res = await fetchWithAuth('http://localhost:8000/api/portfolio');
          const data = await res.json();
          setTrades(data);
        } catch (err) {
          console.error("Failed to fetch trades", err);
        } finally {
          setIsLoadingTrades(false);
        }
      };
      fetchTrades();
    }
  }, [activeTab]);

  useEffect(() => {
    const fetchForexData = async () => {
      try {
        setIsLoadingForex(true);
        const res = await fetchWithAuth('http://localhost:8000/api/forex');
        const data = await res.json();
        setForexData(data);
      } catch (err) {
        console.error("Failed to fetch forex data", err);
      } finally {
        setIsLoadingForex(false);
      }
    };
    fetchForexData();
  }, []);


  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    setMessages(prev => [...prev, { role: 'user', content: input }]);
    const currentInput = input.trim();
    setInput('');
    
    // Check if it's an analysis request
    const analyzeMatch = currentInput.match(/^analyze\s+([A-Z]{3}\/[A-Z]{3})$/i);
    
    if (analyzeMatch) {
      const pair = analyzeMatch[1].toUpperCase();
      try {
        const response = await fetchWithAuth('http://localhost:8000/api/analysis', {
          method: 'POST',
          body: JSON.stringify({ pair })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          setMessages(prev => [...prev, { role: 'system', content: `⚠️ Error: ${data.error || 'Failed to analyze pair.'}` }]);
        } else {
          setMessages(prev => [...prev, { role: 'system', content: data.markdown }]);
        }
      } catch (error) {
        setMessages(prev => [...prev, { role: 'system', content: '⚠️ Connection Error: Could not reach Laravel API. Ensure backend is running.' }]);
      }
    } else if (/review\s+my\s+trade[:]?/i.test(currentInput)) {
       // Mock for trade review until backend is implemented
       const numbers = currentInput.match(/([0-9]*\.?[0-9]+)/g);
       if (numbers && numbers.length >= 3) {
         const [entry, sl, tp] = numbers.map(n => parseFloat(n));
         const riskPct = Math.min(((Math.abs(entry - sl) / entry) * 100), 2).toFixed(2);
         const riskLevel = parseFloat(riskPct) > 1.5 ? 'High' : 'Low';
         setMessages(prev => [...prev, { role: 'system', content: `⚠️ TRADE RISK ANALYSIS\n\n* Risk Level: ${riskLevel}\n* Issue: Position size risk ${riskPct}% of account (placeholder)\n* Recommendation: Adjust risk to 1–2% and ensure alignment with macro bias.` }]);
       } else {
         setMessages(prev => [...prev, { role: 'system', content: '⚠️ Please provide Entry, SL, and TP to review a trade.' }]);
       }
    } else if (/^trending$/i.test(currentInput) || /trend/i.test(currentInput)) {
      // Fetch trade recommendations for all supported pairs
      try {
        const response = await fetchWithAuth('http://localhost:8000/api/trending');
        const data = await response.json();
        if (!response.ok) {
          setMessages(prev => [...prev, { role: 'system', content: `⚠️ Error: ${data.error || 'Failed to retrieve trending data.'}` }]);
        } else {
          setMessages(prev => [...prev, { role: 'system', content: data.markdown }]);
        }
      } catch (error) {
        setMessages(prev => [...prev, { role: 'system', content: '⚠️ Connection Error: Could not reach Laravel API for trending data.' }]);
      }
    } else {
      setMessages(prev => [...prev, { role: 'system', content: `## Pair:\n${currentInput.toUpperCase()}\n\n## Market Bias:\nNEUTRAL\n\n(Note: Input not recognized. Try "Analyze EUR/USD" or "Trending" for market overview.)` }]);
    }
  };

  const handleRefresh = async () => {
    if (activeTab === 'workspace') {
      try {
        setIsLoadingForex(true);
        const res = await fetchWithAuth('http://localhost:8000/api/forex');
        const data = await res.json();
        setForexData(data);
      } catch (err) { console.error(err); } finally { setIsLoadingForex(false); }
    } else if (activeTab === 'portfolio') {
      try {
        setIsLoadingTrades(true);
        const res = await fetchWithAuth('http://localhost:8000/api/portfolio');
        const data = await res.json();
        setTrades(data);
      } catch (err) { console.error(err); } finally { setIsLoadingTrades(false); }
    }
  };


  if (!isAuthenticated) {
    const handleLogin = (e: React.FormEvent) => {
      e.preventDefault();
      localStorage.setItem('admin_key', adminKey);
      setIsAuthenticated(true);
    };

    return (
      <div className="h-screen w-screen flex flex-col bg-[#121215] text-gray-200 font-sans justify-center items-center">
        <div className="bg-[#1e1e24] p-8 rounded-lg border border-gray-800 shadow-2xl w-96 max-w-full">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-black text-xl">FX</div>
          </div>
          <h2 className="text-2xl font-bold text-center text-white mb-6">Vin Trade Secure</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 uppercase font-semibold mb-1">Admin Key</label>
              <input 
                type="password" 
                required 
                value={adminKey} 
                onChange={e => setAdminKey(e.target.value)} 
                className="w-full bg-gray-900 border border-gray-700 rounded px-4 py-3 focus:outline-none focus:border-indigo-500 text-gray-200 placeholder-gray-600" 
                placeholder="Enter master password..."
              />
            </div>
            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded transition-colors flex justify-center items-center">
              Unlock Terminal
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#1e1e24] text-gray-200 font-sans overflow-hidden">
      {/* Browser-style Top Tabs & Navbar */}
      <header className="bg-gray-900 border-b border-gray-800 shrink-0">
        {/* Fake Browser Tabs */}
        <div className="flex bg-[#121215] px-2 pt-2 gap-1 overflow-x-auto">
          <div onClick={handleTabClick('workspace')} className={`${activeTab === 'workspace' ? 'bg-gray-800 text-gray-200 border-t border-x border-gray-700' : 'bg-[#1e1e24] text-gray-500 hover:text-gray-300 border-transparent hover:bg-gray-800 border-t border-x'} px-4 py-2 rounded-t-md flex items-center gap-2 text-sm min-w-[150px] cursor-pointer transition-colors`}>
            <div className={`w-2 h-2 rounded-full ${activeTab === 'workspace' ? 'bg-indigo-500' : 'bg-gray-600'}`}></div>
            Main Workspace
          </div>
          <div onClick={handleTabClick('portfolio')} className={`${activeTab === 'portfolio' ? 'bg-gray-800 text-gray-200 border-t border-x border-gray-700' : 'bg-[#1e1e24] text-gray-500 hover:text-gray-300 border-transparent hover:bg-gray-800 border-t border-x'} px-4 py-2 rounded-t-md flex items-center gap-2 text-sm min-w-[150px] cursor-pointer transition-colors`}>
            Portfolio Analysis
          </div>
          <div onClick={handleTabClick('review')} className={`${activeTab === 'review' ? 'bg-gray-800 text-gray-200 border-t border-x border-gray-700' : 'bg-[#1e1e24] text-gray-500 hover:text-gray-300 border-transparent hover:bg-gray-800 border-t border-x'} px-4 py-2 rounded-t-md flex items-center gap-2 text-sm min-w-[150px] cursor-pointer transition-colors`}>
            AI Trade Review
          </div>
        </div>
        {/* Navigation Bar */}
        <div className="h-12 bg-gray-800 flex items-center px-4 justify-between">
          <div className="flex items-center gap-4">
            <div className="flex gap-2 text-gray-400">
              <button 
                onClick={handleBack} 
                className="hover:text-white transition-colors cursor-pointer"
                title="Previous Tab"
              >◀</button>
              <button 
                onClick={handleForward} 
                className="hover:text-white transition-colors cursor-pointer"
                title="Next Tab"
              >▶</button>
              <button onClick={handleRefresh} className="hover:text-white transition-colors cursor-pointer" title="Refresh Data">↻</button>
            </div>
            <div className="bg-gray-900 border border-gray-700 rounded px-4 py-1.5 text-sm text-gray-400 min-w-[300px] flex items-center gap-2">
              <span className="text-indigo-500">🔒</span> secure://vin-trade.ai/{activeTab}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-gray-400 font-mono">
              v1.0.0 | <span className="text-green-500">Connected</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-black text-xs">FX</div>
          </div>
        </div>
      </header>
{/* Main Content Area */}
<div className="flex-1 flex overflow-hidden">
  {activeTab === 'workspace' && (
    <div className="flex w-full">
      {/* Left Sidebar */}
      <aside className="w-64 bg-gray-800 border-r border-gray-800 flex flex-col">
        {/* Sidebar content */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoadingForex ? (
            <div className="text-gray-400 text-sm p-4 text-center">Waiting for market data...</div>
          ) : forexData.length === 0 ? (
            <div className="text-gray-400 text-sm p-4 text-center">No data available</div>
          ) : (
            forexData.map(data => (
              <div 
                key={data.pair} 
                onClick={() => setSelectedPair(data.pair)}
                className={`flex justify-between items-center p-3 hover:bg-gray-700 rounded cursor-pointer transition-colors border ${selectedPair === data.pair ? 'bg-gray-700 border-gray-600' : 'border-transparent hover:border-gray-600'} mb-1`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${selectedPair === data.pair ? 'bg-indigo-500' : 'bg-gray-500'}`}></div>
                  <span className="font-semibold text-sm">{data.pair}</span>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-300">{Number(data.price).toFixed(4)}</div>
                  {data.change_24h !== null && (
                    <span className={`text-xs font-mono ${Number(data.change_24h) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {Number(data.change_24h) >= 0 ? '+' : ''}{Number(data.change_24h).toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Chart Area */}
      <main className="flex-1 flex flex-col relative bg-[#1e1e24]">
        <div className="h-10 bg-[#17171d] border-b border-gray-800 flex items-center px-4 justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-200">{selectedPair}</span>
            <span className="text-xs text-gray-500 px-2 py-0.5 bg-gray-800 rounded">1D</span>
            <span className="text-xs text-gray-500 px-2 py-0.5 bg-gray-800 rounded">1W</span>
          </div>
        </div>
        <div className="absolute inset-0 top-10">
          <AdvancedRealTimeChart
            symbol={`FX:${selectedPair.replace('/', '')}`}
            theme="dark"
            autosize
            allow_symbol_change={true}
            hide_side_toolbar={false}
            enable_publishing={false}
            toolbar_bg="#1e1e24"
            interval="D"
            timezone="Etc/UTC"
          />
        </div>
      </main>
    </div>
  )}
  {activeTab === 'portfolio' && (
    <div className="flex-1 p-6 bg-[#1e1e24] overflow-y-auto">
      <h2 className="text-2xl font-semibold mb-6 text-white">Portfolio Dashboard</h2>
      
      {isLoadingTrades ? (
        <div className="text-gray-400">Loading portfolio data...</div>
      ) : (
        <>
          {/* Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-lg">
              <div className="text-gray-400 text-sm mb-1">Total Trades</div>
              <div className="text-3xl font-bold text-white">{trades.length}</div>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-lg">
              <div className="text-gray-400 text-sm mb-1">Active Positions</div>
              <div className="text-3xl font-bold text-indigo-400">
                {trades.filter(t => t.status === 'OPEN').length}
              </div>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-lg">
              <div className="text-gray-400 text-sm mb-1">Avg Risk Per Trade</div>
              <div className="text-3xl font-bold text-yellow-400">
                {trades.length > 0 
                  ? (trades.reduce((sum, t) => sum + Number(t.risk_percentage), 0) / trades.length).toFixed(1) 
                  : 0}%
              </div>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-lg">
              <div className="text-gray-400 text-sm mb-1">Win Rate (Est)</div>
              <div className="text-3xl font-bold text-green-400">
                {trades.filter(t => t.status === 'CLOSED').length > 0 
                  ? "60.0%" // Mock calculation or complex logic could go here
                  : "0.0%"}
              </div>
            </div>
          </div>

          {/* Trades Table */}
          <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden shadow-2xl">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-gray-800 text-gray-400 uppercase text-xs">
                <tr>
                  <th className="px-6 py-4 font-medium">Pair</th>
                  <th className="px-6 py-4 font-medium">Bias</th>
                  <th className="px-6 py-4 font-medium">Entry</th>
                  <th className="px-6 py-4 font-medium">SL</th>
                  <th className="px-6 py-4 font-medium">TP</th>
                  <th className="px-6 py-4 font-medium">Risk</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {trades.map((trade: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-800 transition-colors">
                    <td className="px-6 py-4 font-semibold text-white">{trade.currency_pair}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${trade.bias === 'BUY' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                        {trade.bias}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono">{Number(trade.entry_price).toFixed(4)}</td>
                    <td className="px-6 py-4 font-mono text-red-400">{Number(trade.stop_loss).toFixed(4)}</td>
                    <td className="px-6 py-4 font-mono text-green-400">{Number(trade.take_profit).toFixed(4)}</td>
                    <td className="px-6 py-4">{Number(trade.risk_percentage).toFixed(1)}%</td>
                    <td className="px-6 py-4">
                      <span className={`flex items-center gap-2 ${trade.status === 'OPEN' ? 'text-indigo-400' : 'text-gray-500'}`}>
                        {trade.status === 'OPEN' && <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>}
                        {trade.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {trades.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      No trades found in your portfolio.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )}
  {activeTab === 'review' && (
    <div className="flex-1 p-6 bg-[#1e1e24] overflow-y-auto">
      <h2 className="text-2xl font-semibold mb-6 text-white">AI Trade Review</h2>
      
      <div className="flex gap-6">
        {/* Left Col: Entry Form */}
        <div className="w-1/3 bg-gray-900 rounded-lg border border-gray-800 p-6 shadow-2xl">
          <h3 className="text-lg font-medium text-gray-300 mb-4">Trade Parameters</h3>
          <form onSubmit={handleReviewTrade} className="space-y-4">
            
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 uppercase font-semibold mb-1">Pair</label>
                <select 
                  value={reviewForm.pair}
                  onChange={e => setReviewForm({...reviewForm, pair: e.target.value})}
                  className="w-full bg-[#1e1e24] border border-gray-700 rounded px-3 py-2 text-gray-200 focus:outline-none focus:border-indigo-500"
                >
                  <option>EUR/USD</option>
                  <option>GBP/USD</option>
                  <option>USD/JPY</option>
                  <option>AUD/USD</option>
                  <option>USD/CAD</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 uppercase font-semibold mb-1">Bias</label>
                <div className="flex bg-[#1e1e24] rounded border border-gray-700 overflow-hidden">
                  <button type="button" onClick={() => setReviewForm({...reviewForm, bias: 'BUY'})} className={`flex-1 py-2 text-sm font-bold ${reviewForm.bias === 'BUY' ? 'bg-green-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}>BUY</button>
                  <button type="button" onClick={() => setReviewForm({...reviewForm, bias: 'SELL'})} className={`flex-1 py-2 text-sm font-bold ${reviewForm.bias === 'SELL' ? 'bg-red-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}>SELL</button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 uppercase font-semibold mb-1">Entry Price</label>
              <input type="number" step="0.00001" required value={reviewForm.entry} onChange={e => setReviewForm({...reviewForm, entry: e.target.value})} className="w-full bg-[#1e1e24] border border-gray-700 rounded px-3 py-2 text-gray-200 focus:outline-none focus:border-indigo-500" />
            </div>
            
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 uppercase font-semibold mb-1">Stop Loss</label>
                <input type="number" step="0.00001" required value={reviewForm.sl} onChange={e => setReviewForm({...reviewForm, sl: e.target.value})} className="w-full bg-[#1e1e24] border border-gray-700 rounded px-3 py-2 text-gray-200 focus:outline-none focus:border-red-500" />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 uppercase font-semibold mb-1">Take Profit</label>
                <input type="number" step="0.00001" required value={reviewForm.tp} onChange={e => setReviewForm({...reviewForm, tp: e.target.value})} className="w-full bg-[#1e1e24] border border-gray-700 rounded px-3 py-2 text-gray-200 focus:outline-none focus:border-green-500" />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 uppercase font-semibold mb-1">Capital Risk %</label>
              <input type="number" step="0.1" required value={reviewForm.risk} onChange={e => setReviewForm({...reviewForm, risk: e.target.value})} className="w-full bg-[#1e1e24] border border-gray-700 rounded px-3 py-2 text-gray-200 focus:outline-none focus:border-indigo-500" />
            </div>

            <button disabled={isReviewing} type="submit" className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded transition-colors flex justify-center items-center">
              {isReviewing ? 'Analyzing...' : 'Run AI Analysis'}
            </button>
          </form>
        </div>

        {/* Right Col: AI Review Result */}
        <div className="flex-1">
          {!reviewResult ? (
            <div className="h-full flex items-center justify-center border-2 border-dashed border-gray-800 rounded-lg text-gray-500">
              Fill out your trade parameters to generate a mathematical AI review.
            </div>
          ) : reviewResult.error ? (
            <div className="bg-red-900/30 border border-red-800 text-red-200 p-6 rounded-lg">
              <h3 className="font-bold text-lg mb-2">Analysis Failed</h3>
              <p>{reviewResult.error}</p>
            </div>
          ) : (
            <div className="space-y-6">
              
              <div className="flex items-center justify-between p-6 rounded-lg border border-gray-800 bg-gray-900 shadow-xl">
                <div>
                  <h3 className="text-gray-400 text-sm uppercase tracking-wider font-semibold">AI Safety Score</h3>
                  <div className="text-5xl font-black mt-2" style={{ color: reviewResult.safety_score > 70 ? '#4ade80' : reviewResult.safety_score > 40 ? '#facc15' : '#f87171' }}>
                    {reviewResult.safety_score} / 100
                  </div>
                </div>
                <div className="text-right space-y-2">
                  <div className="bg-gray-800 px-4 py-2 rounded">
                    <span className="text-gray-400 text-sm">Risk/Reward</span>
                    <div className="font-mono text-xl font-bold text-white">{reviewResult.rr_ratio} : 1</div>
                  </div>
                  <div className={`px-4 py-2 rounded border ${reviewResult.trend_alignment === 'Aligned' ? 'border-green-800 bg-green-900/20 text-green-400' : 'border-red-800 bg-red-900/20 text-red-400'}`}>
                    <span className="text-sm font-bold uppercase">{reviewResult.trend_alignment}</span>
                  </div>
                </div>
              </div>

              {reviewResult.warnings && reviewResult.warnings.length > 0 && (
                <div className="bg-[#1e1e24] border border-red-800 rounded-lg p-6">
                  <h3 className="text-red-400 font-bold mb-3 flex items-center gap-2">⚠️ Critical AI Warnings</h3>
                  <ul className="space-y-2 text-sm text-gray-300">
                    {reviewResult.warnings.map((w: string, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-red-500 mt-0.5">•</span> {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {reviewResult.warnings && reviewResult.warnings.length === 0 && (
                <div className="bg-[#1e1e24] border border-green-800 rounded-lg p-6 text-green-400 font-medium">
                  ✅ Excellent setup! This trade aligns with macro trends and maintains a healthy risk profile.
                </div>
              )}

              <button 
                onClick={handleSaveTrade} 
                disabled={isSavingTrade}
                className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white font-bold py-4 rounded-lg shadow-lg transition-colors flex justify-center items-center"
              >
                {isSavingTrade ? 'Saving...' : 'Approve & Execute Trade ->'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )}
</div>



      {/* Bottom Panel - Chatbot AI Engine (Collapsible) */}
      <footer className={`bg-gray-800 border-t border-gray-800 flex flex-col shrink-0 transition-all duration-300 ${isChatOpen ? 'h-96' : 'h-10'}`}>
        {/* Toggle Header */}
        <div 
          className="p-2 px-4 border-b border-gray-800 flex items-center justify-between bg-gray-900 cursor-pointer hover:bg-gray-800 transition-colors"
          onClick={() => setIsChatOpen(!isChatOpen)}
        >
          <span className="font-medium text-indigo-500 flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
            AI Intelligence Core {isChatOpen ? '▼' : '▲'}
          </span>
          <div className="flex items-center gap-4">
            {!isChatOpen && <span className="text-xs text-gray-500">Click to open</span>}
            {isChatOpen && (
              <button 
                onClick={(e) => { e.stopPropagation(); setMessages([]); }}
                className="text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded border border-gray-700 transition-colors"
                title="Clear Chat History"
              >
                Clear Chat
              </button>
            )}
          </div>
        </div>
        
        {/* Chat Content - Only visible when open */}
        {isChatOpen && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-gray-500 text-sm mt-10">
                  Forex Intelligence Core online. Type "Analyze EUR/USD" to begin.
                </div>
              )}
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded p-3 whitespace-pre-wrap ${
                    msg.role === 'user' 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-gray-800 text-gray-200 border border-gray-700'
                  }`}
                  >
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={handleSend} className="p-4 border-t border-gray-800 bg-gray-900">
              <div className="flex gap-4">
                <input 
                  type="text" 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="e.g., Analyze EUR/USD or Review my trade..." 
                  className="flex-1 bg-[#1e1e24] border border-gray-700 rounded px-4 py-2 focus:outline-none focus:border-indigo-500 text-gray-200 placeholder-gray-500"
                />
                <button 
                  type="submit"
                  className="bg-indigo-500 text-black font-semibold px-6 py-2 rounded hover:bg-opacity-90 transition-all"
                >
                  Analyze
                </button>
              </div>
            </form>
          </>
        )}
      </footer>
    </div>
  );
}

export default App;
