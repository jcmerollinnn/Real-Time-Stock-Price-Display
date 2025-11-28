import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Plus, X, RefreshCw, AlertCircle, Moon, Sun } from 'lucide-react';

// ===== TYPESCRIPT INTERFACES =====

interface StockPrice {
  symbol: string;
  price: number;
  timestamp: number;
  volume: number;
  change: number;
  high?: number;
  low?: number;
  open?: number;
}

interface ChartDataPoint {
  timestamp: number;
  time: string;
  price?: number;
  actual?: number;
  predicted?: number;
  isPrediction?: boolean;
}

interface MLPrediction {
  predictions: ChartDataPoint[];
  trend: 'up' | 'down' | 'neutral';
  confidence: number;
}

interface Stock {
  symbol: string;
  currentPrice: number;
  change: number;
  trend: 'up' | 'down' | 'neutral';
  mlData: MLPrediction | null;
  lastUpdate: number;
  error: boolean;
}

interface StockCardProps {
  stock: Stock;
  onRemove: () => void;
  showPredictions: boolean;
  isDark: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: ChartDataPoint;
    value: number;
  }>;
  isDark: boolean;
}

// ===== API CONFIGURATION =====

const API_CONFIG = {
  alphaVantage: {
    key: process.env.REACT_APP_ALPHA_VANTAGE_KEY,
    url: process.env.REACT_APP_ALPHA_VANTAGE_URL,
  },
  finnhub: {
    key: process.env.REACT_APP_FINNHUB_KEY,
    url: process.env.REACT_APP_FINNHUB_URL,
  },
  useMock: process.env.REACT_APP_USE_MOCK === 'true',
};

// ===== REAL API SERVICE =====

class StockAPIService {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 60000; // 1 minute cache
  
  async fetchStockPrice(symbol: string): Promise<StockPrice> {
    if (API_CONFIG.USE_MOCK) {
      return this.mockFetchStockPrice(symbol);
    }
    
    try {
      // Using Alpha Vantage GLOBAL_QUOTE endpoint
      const url = `${API_CONFIG.ALPHA_VANTAGE_URL}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_CONFIG.ALPHA_VANTAGE_KEY}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      const quote = data['Global Quote'];
      
      if (!quote || Object.keys(quote).length === 0) {
        throw new Error('No data available for symbol');
      }
      
      return {
        symbol,
        price: parseFloat(quote['05. price']),
        timestamp: Date.now(),
        volume: parseInt(quote['06. volume']),
        change: parseFloat(quote['10. change percent'].replace('%', '')),
        high: parseFloat(quote['03. high']),
        low: parseFloat(quote['04. low']),
        open: parseFloat(quote['02. open'])
      };
    } catch (error) {
      console.error('API fetch error:', error);
      return this.mockFetchStockPrice(symbol);
    }
  }
  
  async fetchHistoricalData(symbol: string, points: number = 20): Promise<ChartDataPoint[]> {
    if (API_CONFIG.USE_MOCK) {
      return this.mockFetchHistoricalData(symbol, points);
    }
    
    try {
      // Using Alpha Vantage INTRADAY endpoint
      const url = `${API_CONFIG.ALPHA_VANTAGE_URL}?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=5min&apikey=${API_CONFIG.ALPHA_VANTAGE_KEY}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      const timeSeries = data['Time Series (5min)'];
      
      if (!timeSeries) {
        throw new Error('No historical data available');
      }
      
      const entries = Object.entries(timeSeries).slice(0, points);
      
      return entries.map(([timestamp, values]: [string, any]) => {
        const date = new Date(timestamp);
        return {
          timestamp: date.getTime(),
          time: date.toLocaleTimeString(),
          price: parseFloat(values['4. close']),
          actual: parseFloat(values['4. close'])
        };
      }).reverse();
    } catch (error) {
      console.error('Historical data fetch error:', error);
      return this.mockFetchHistoricalData(symbol, points);
    }
  }
  
  // Mock implementations for demo/fallback
  private async mockFetchStockPrice(symbol: string): Promise<StockPrice> {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const basePrice: { [key: string]: number } = {
      'AAPL': 175,
      'GOOGL': 140,
      'MSFT': 380,
      'TSLA': 245,
      'AMZN': 155,
      'NVDA': 495,
      'META': 485,
      'NFLX': 625
    };
    
    const base = basePrice[symbol] || 100;
    const variance = base * 0.02;
    const price = base + (Math.random() - 0.5) * variance;
    
    return {
      symbol,
      price: parseFloat(price.toFixed(2)),
      timestamp: Date.now(),
      volume: Math.floor(Math.random() * 1000000) + 500000,
      change: parseFloat(((Math.random() - 0.5) * 5).toFixed(2))
    };
  }
  
  private async mockFetchHistoricalData(symbol: string, points: number = 20): Promise<ChartDataPoint[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const basePrice: { [key: string]: number } = {
      'AAPL': 175,
      'GOOGL': 140,
      'MSFT': 380,
      'TSLA': 245,
      'AMZN': 155,
      'NVDA': 495,
      'META': 485,
      'NFLX': 625
    };
    
    const base = basePrice[symbol] || 100;
    const data: ChartDataPoint[] = [];
    let currentPrice = base * 0.95;
    const now = Date.now();
    
    for (let i = points; i >= 0; i--) {
      const variance = base * 0.01;
      currentPrice += (Math.random() - 0.45) * variance;
      
      data.push({
        timestamp: now - (i * 60000),
        time: new Date(now - (i * 60000)).toLocaleTimeString(),
        price: parseFloat(currentPrice.toFixed(2)),
        actual: parseFloat(currentPrice.toFixed(2))
      });
    }
    
    return data;
  }
}

// ===== ML PREDICTION SERVICE =====

class MLPredictionService {
  async predictPrices(symbol: string, historicalData: ChartDataPoint[]): Promise<MLPrediction> {
    await new Promise(resolve => setTimeout(resolve, 400));
    
    if (historicalData.length === 0) {
      return {
        predictions: [],
        trend: 'neutral',
        confidence: 0
      };
    }
    
    // Simple linear regression for trend prediction
    const prices = historicalData.map(d => d.price || d.actual || 0);
    const lastPrice = prices[prices.length - 1];
    
    // Calculate trend using last 5 data points
    const recentPrices = prices.slice(-5);
    const avgChange = recentPrices.reduce((acc, price, idx) => {
      if (idx === 0) return acc;
      return acc + (price - recentPrices[idx - 1]);
    }, 0) / (recentPrices.length - 1);
    
    const trend = avgChange > 0 ? 'up' : avgChange < 0 ? 'down' : 'neutral';
    const momentum = Math.abs(avgChange) / lastPrice;
    const predictions: ChartDataPoint[] = [];
    
    // Generate 5 prediction points
    for (let i = 1; i <= 5; i++) {
      const predicted = lastPrice + (avgChange * i * (0.8 + Math.random() * 0.4));
      const timestamp = historicalData[historicalData.length - 1].timestamp + (i * 60000);
      
      predictions.push({
        timestamp,
        time: new Date(timestamp).toLocaleTimeString(),
        predicted: parseFloat(predicted.toFixed(2)),
        isPrediction: true
      });
    }
    
    return {
      predictions,
      trend: trend as 'up' | 'down' | 'neutral',
      confidence: Math.min(0.95, 0.5 + momentum * 10)
    };
  }
}

// Initialize services
const stockAPI = new StockAPIService();
const mlService = new MLPredictionService();

// ===== COMPONENTS =====

const StockCard: React.FC<StockCardProps> = ({ stock, onRemove, showPredictions, isDark }) => {
  const isPositive = stock.change >= 0;
  const trendColor = stock.trend === 'up' ? 'text-green-500' : 'text-red-500';
  
  return (
    <div 
      className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md p-4 border-l-4`}
      style={{ borderLeftColor: isPositive ? '#22c55e' : '#ef4444' }}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>
            {stock.symbol}
          </h3>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Live Price</p>
        </div>
        <button
          onClick={onRemove}
          className={`${isDark ? 'text-gray-500 hover:text-red-400' : 'text-gray-400 hover:text-red-500'} transition-colors`}
          aria-label="Remove stock"
        >
          <X size={20} />
        </button>
      </div>
      
      <div className="mb-3">
        <div className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          ${stock.currentPrice?.toFixed(2) || '0.00'}
        </div>
        <div className={`flex items-center gap-1 text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          {isPositive ? '+' : ''}{stock.change}%
        </div>
      </div>
      
      {showPredictions && stock.mlData && (
        <div className={`${isDark ? 'bg-gray-700' : 'bg-gray-50'} rounded p-2 text-sm`}>
          <div className="flex items-center justify-between">
            <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>Prediction:</span>
            <span className={`font-semibold ${trendColor}`}>
              {stock.trend === 'up' ? '↑' : '↓'} {(stock.mlData.confidence * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      )}
      
      {stock.error && (
        <div className="flex items-center gap-2 text-sm text-red-600 mt-2">
          <AlertCircle size={14} />
          <span>Update failed</span>
        </div>
      )}
    </div>
  );
};

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, isDark }) => {
  if (!active || !payload || !payload.length) return null;
  
  const data = payload[0].payload;
  
  return (
    <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg shadow-lg p-3`}>
      <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'} mb-1`}>{data.time}</p>
      {data.actual !== undefined && (
        <p className="text-sm font-semibold text-blue-600">
          Actual: ${data.actual.toFixed(2)}
        </p>
      )}
      {data.predicted !== undefined && (
        <p className="text-sm font-semibold text-purple-600">
          Predicted: ${data.predicted.toFixed(2)}
        </p>
      )}
    </div>
  );
};

// ===== MAIN APP =====

export default function StockTrackerApp() {
  const [isDark, setIsDark] = useState(false);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [showPredictions, setShowPredictions] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [chartData, setChartData] = useState<{ [key: string]: ChartDataPoint[] }>({});
  const [error, setError] = useState('');
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const availableStocks = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'NVDA', 'META', 'NFLX'];
  
  const fetchStockData = useCallback(async (symbol: string): Promise<boolean> => {
    try {
      const [priceData, historicalData] = await Promise.all([
        stockAPI.fetchStockPrice(symbol),
        stockAPI.fetchHistoricalData(symbol)
      ]);
      
      let mlData: MLPrediction | null = null;
      if (showPredictions) {
        mlData = await mlService.predictPrices(symbol, historicalData);
      }
      
      let combinedData = [...historicalData];
      if (mlData && mlData.predictions.length > 0) {
        combinedData = [...historicalData, ...mlData.predictions];
      }
      
      setChartData(prev => ({
        ...prev,
        [symbol]: combinedData
      }));
      
      setStocks(prev => prev.map(stock => 
        stock.symbol === symbol
          ? {
              ...stock,
              currentPrice: priceData.price,
              change: priceData.change,
              trend: mlData?.trend || 'neutral',
              mlData: mlData,
              lastUpdate: priceData.timestamp,
              error: false
            }
          : stock
      ));
      
      return true;
    } catch (err) {
      console.error(`Error fetching data for ${symbol}:`, err);
      setStocks(prev => prev.map(stock => 
        stock.symbol === symbol ? { ...stock, error: true } : stock
      ));
      return false;
    }
  }, [showPredictions]);
  
  const updateAllStocks = useCallback(async () => {
    if (stocks.length === 0) return;
    await Promise.all(stocks.map(stock => fetchStockData(stock.symbol)));
  }, [stocks, fetchStockData]);
  
  const addStock = async () => {
    if (!selectedSymbol || stocks.some(s => s.symbol === selectedSymbol)) {
      setError('Stock already tracked or invalid symbol');
      setTimeout(() => setError(''), 3000);
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    const newStock: Stock = {
      symbol: selectedSymbol,
      currentPrice: 0,
      change: 0,
      trend: 'neutral',
      mlData: null,
      lastUpdate: Date.now(),
      error: false
    };
    
    setStocks(prev => [...prev, newStock]);
    await fetchStockData(selectedSymbol);
    setSelectedSymbol('');
    setIsLoading(false);
  };
  
  const removeStock = (symbol: string) => {
    setStocks(prev => prev.filter(s => s.symbol !== symbol));
    setChartData(prev => {
      const updated = { ...prev };
      delete updated[symbol];
      return updated;
    });
  };
  
  useEffect(() => {
    if (stocks.length > 0) {
      updateIntervalRef.current = setInterval(updateAllStocks, 5000);
      return () => {
        if (updateIntervalRef.current) {
          clearInterval(updateIntervalRef.current);
        }
      };
    }
  }, [stocks.length, updateAllStocks]);
  
  useEffect(() => {
    if (stocks.length > 0) {
      updateAllStocks();
    }
  }, [showPredictions]);
  
  const selectedStock = stocks[0];
  const selectedChartData = selectedStock ? chartData[selectedStock.symbol] || [] : [];
  
  const bgClass = isDark ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 to-indigo-100';
  const cardBg = isDark ? 'bg-gray-800' : 'bg-white';
  const textPrimary = isDark ? 'text-white' : 'text-gray-800';
  const textSecondary = isDark ? 'text-gray-400' : 'text-gray-600';
  
  return (
    <div className={`min-h-screen ${bgClass} p-4 md:p-8 transition-colors duration-300`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className={`${cardBg} rounded-xl shadow-lg p-6 mb-6`}>
          <div className="flex justify-between items-start">
            <div>
              <h1 className={`text-3xl font-bold ${textPrimary} mb-2`}>
                Real-Time Stock Tracker
              </h1>
              <p className={textSecondary}>Monitor stocks with ML-powered predictions</p>
            </div>
            <button
              onClick={() => setIsDark(!isDark)}
              className={`p-2 rounded-lg ${isDark ? 'bg-gray-700 text-yellow-400' : 'bg-gray-100 text-gray-700'} hover:opacity-80 transition-opacity`}
              aria-label="Toggle dark mode"
            >
              {isDark ? <Sun size={24} /> : <Moon size={24} />}
            </button>
          </div>
        </div>
        
        {/* Controls */}
        <div className={`${cardBg} rounded-xl shadow-lg p-6 mb-6`}>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className={`block text-sm font-medium ${textPrimary} mb-2`}>
                Add Stock Symbol
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedSymbol}
                  onChange={(e) => setSelectedSymbol(e.target.value)}
                  className={`flex-1 px-4 py-2 border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                  disabled={isLoading}
                >
                  <option value="">Select a stock...</option>
                  {availableStocks
                    .filter(symbol => !stocks.some(s => s.symbol === symbol))
                    .map(symbol => (
                      <option key={symbol} value={symbol}>{symbol}</option>
                    ))
                  }
                </select>
                <button
                  onClick={addStock}
                  disabled={!selectedSymbol || isLoading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {isLoading ? <RefreshCw size={18} className="animate-spin" /> : <Plus size={18} />}
                  Add
                </button>
              </div>
              {error && (
                <p className="text-sm text-red-600 mt-2 flex items-center gap-1">
                  <AlertCircle size={14} />
                  {error}
                </p>
              )}
            </div>
            
            <div className="flex items-end">
              <button
                onClick={() => setShowPredictions(!showPredictions)}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  showPredictions
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : `${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'} hover:opacity-80`
                }`}
              >
                {showPredictions ? '✓ Predictions ON' : 'Predictions OFF'}
              </button>
            </div>
          </div>
        </div>
        
        {/* Stock Cards */}
        {stocks.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {stocks.map(stock => (
              <StockCard
                key={stock.symbol}
                stock={stock}
                onRemove={() => removeStock(stock.symbol)}
                showPredictions={showPredictions}
                isDark={isDark}
              />
            ))}
          </div>
        )}
        
        {/* Chart */}
        {selectedStock && selectedChartData.length > 0 && (
          <div className={`${cardBg} rounded-xl shadow-lg p-6`}>
            <h2 className={`text-2xl font-bold ${textPrimary} mb-4`}>
              {selectedStock.symbol} Price Chart
            </h2>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={selectedChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
                <XAxis 
                  dataKey="time" 
                  stroke={isDark ? '#9ca3af' : '#6b7280'}
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  stroke={isDark ? '#9ca3af' : '#6b7280'}
                  style={{ fontSize: '12px' }}
                  domain={['auto', 'auto']}
                />
                <Tooltip content={<CustomTooltip isDark={isDark} />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Actual Price"
                  connectNulls
                />
                {showPredictions && (
                  <Line
                    type="monotone"
                    dataKey="predicted"
                    stroke="#a855f7"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 3 }}
                    name="Predicted Price"
                    connectNulls
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        
        {/* Empty State */}
        {stocks.length === 0 && (
          <div className={`${cardBg} rounded-xl shadow-lg p-12 text-center`}>
            <div className={isDark ? 'text-gray-600' : 'text-gray-400'}>
              <TrendingUp size={64} className="mx-auto mb-4" />
            </div>
            <h3 className={`text-xl font-semibold ${textPrimary} mb-2`}>
              No Stocks Tracked
            </h3>
            <p className={textSecondary}>
              Add a stock symbol above to start tracking real-time prices
            </p>
          </div>
        )}
      </div>
    </div>
  );
}