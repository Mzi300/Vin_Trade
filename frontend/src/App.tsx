import ReactMarkdown from 'react-markdown';
import React, { useState, useEffect } from 'react';
import { AdvancedRealTimeChart } from "react-ts-tradingview-widgets";

function App() {
  const [activeTab, setActiveTab] = useState<'workspace' | 'portfolio' | 'review'>('workspace');

  // Tab click handlers
  const handleTabClick = (tab: 'workspace' | 'portfolio' | 'review') => () => setActiveTab(tab);

  const [messages, setMessages] = useState<{role: string, content: string}[]>([]);
  const [input, setInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [timeframe, setTimeframe] = useState('daily'); // hourly, daily, weekly
  
  const [forexData, setForexData] = useState<any[]>([]);
  const [selectedPair, setSelectedPair] = useState<string>('EUR/USD');
  const [isLoadingForex, setIsLoadingForex] = useState(true);

  const [trades, setTrades] = useState<any[]>([]);
  const [isLoadingTrades, setIsLoadingTrades] = useState(false);

  useEffect(() => {
    if (activeTab === 'portfolio' && trades.length === 0) {
      const fetchTrades = async () => {
        try {
          setIsLoadingTrades(true);
          const res = await fetch('http://localhost:8000/api/portfolio');
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
        const res = await fetch('http://localhost:8000/api/forex');
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
        const response = await fetch('http://localhost:8000/api/analysis', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
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
        const response = await fetch('http://localhost:8000/api/trending');
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
              <button className="hover:text-white transition-colors">◀</button>
              <button className="hover:text-white transition-colors">▶</button>
              <button className="hover:text-white transition-colors">↻</button>
            </div>
            <div className="bg-gray-900 border border-gray-700 rounded px-4 py-1.5 text-sm text-gray-400 min-w-[300px] flex items-center gap-2">
              <span className="text-indigo-500">🔒</span> secure://vin-trade.ai/workspace
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
    <div className="p-8 text-center text-gray-200">
      <h2 className="text-2xl font-semibold mb-4">AI Trade Review</h2>
      <div className="flex items-start bg-gray-800 border border-gray-600 rounded p-4 text-gray-200">
        <span className="text-indigo-400 mr-2">ℹ️</span>
        <div>
          <p className="font-semibold">Trade review functionality is under development.</p>
          <p className="text-sm">Use the chat to input trade details; upcoming AI will provide risk analysis and recommendations.</p>
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
          {!isChatOpen && <span className="text-xs text-gray-500">Click to open</span>}
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
