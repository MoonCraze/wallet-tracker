// Coordinated Trades API Client Example
// This file demonstrates how to integrate with the coordinated trades API

class CoordinatedTradesClient {
  constructor(baseUrl = 'https://helius.wonderswhisper.com/') {
    this.baseUrl = baseUrl;
    this.eventSource = null;
    
    // Default fetch options for CORS
    this.defaultFetchOptions = {
      mode: 'cors',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      }
    };
  }

  /**
   * Fetch paginated coordinated trades from the database
   * @param {number} page - Page number (default: 1)
   * @param {number} limit - Items per page (default: 50, max: 200)
   * @returns {Promise<Object>} Response with trades and pagination info
   */
  async fetchCoordinatedTrades(page = 1, limit = 50) {
    try {
      const response = await fetch(
        `${this.baseUrl}/dev/db/coordinated?page=${page}&limit=${limit}`,
        this.defaultFetchOptions
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Parse wallet addresses from JSON strings in REST responses
      data.coordinated = data.coordinated.map(trade => ({
        ...trade,
        walletAddressesParsed: JSON.parse(trade.walletAddresses || '[]')
      }));
      
      return data;
    } catch (error) {
      console.error('Error fetching coordinated trades:', error);
      throw error;
    }
  }

  /**
   * Setup real-time coordinated trades stream
   * @param {Function} onCoordinatedTrade - Callback for new coordinated trades
   * @param {Function} onError - Error callback
   * @returns {EventSource} The EventSource instance
   */
  setupRealtimeCoordinated(onCoordinatedTrade, onError = console.error) {
    if (this.eventSource) {
      this.eventSource.close();
    }

    // For EventSource, credentials are handled via withCredentials
    this.eventSource = new EventSource(`${this.baseUrl}/stream/coordinated`, {
      withCredentials: true
    });
    
    this.eventSource.onmessage = (event) => {
      try {
        const coordinatedTrade = JSON.parse(event.data);
        onCoordinatedTrade(coordinatedTrade);
      } catch (error) {
        console.error('Error parsing coordinated trade data:', error);
        onError(error);
      }
    };

    this.eventSource.onerror = (event) => {
      console.error('SSE connection error:', event);
      onError(event);
    };

    this.eventSource.onopen = () => {
      console.log('SSE connection established');
    };

    return this.eventSource;
  }

  /**
   * Setup combined real-time stream (transfers + coordinated)
   * @param {Function} onCoordinatedTrade - Callback for coordinated trades
   * @param {Function} onTransfers - Callback for transfer events
   * @param {Function} onError - Error callback
   * @returns {EventSource} The EventSource instance
   */
  setupRealtimeAll(onCoordinatedTrade, onTransfers, onError = console.error) {
    if (this.eventSource) {
      this.eventSource.close();
    }

    this.eventSource = new EventSource(`${this.baseUrl}/stream/all`, {
      withCredentials: true
    });
    
    this.eventSource.addEventListener('coordinated', (event) => {
      try {
        const coordinatedTrade = JSON.parse(event.data);
        onCoordinatedTrade(coordinatedTrade);
      } catch (error) {
        console.error('Error parsing coordinated trade data:', error);
        onError(error);
      }
    });

    this.eventSource.addEventListener('transfers', (event) => {
      try {
        const transfers = JSON.parse(event.data);
        onTransfers(transfers);
      } catch (error) {
        console.error('Error parsing transfer data:', error);
        onError(error);
      }
    });

    this.eventSource.onerror = (event) => {
      console.error('SSE connection error:', event);
      onError(event);
    };

    return this.eventSource;
  }

  /**
   * Get current system configuration
   * @returns {Promise<Object>} Current configuration
   */
  async getConfig() {
    try {
      const response = await fetch(`${this.baseUrl}/config`, this.defaultFetchOptions);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching config:', error);
      throw error;
    }
  }

  /**
   * Update system configuration
   * @param {Object} configUpdate - Configuration parameters to update
   * @returns {Promise<Object>} Updated configuration
   */
  async updateConfig(configUpdate) {
    try {
      const response = await fetch(`${this.baseUrl}/config`, {
        ...this.defaultFetchOptions,
        method: 'PATCH',
        body: JSON.stringify(configUpdate),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error updating config:', error);
      throw error;
    }
  }

  /**
   * Close the real-time connection
   */
  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}

// Example usage:

// Initialize client
const client = new CoordinatedTradesClient('http://localhost:8080');

// Example 1: Fetch historical coordinated trades
async function loadHistoricalTrades() {
  try {
    const data = await client.fetchCoordinatedTrades(1, 20);
    console.log('Historical trades:', data.coordinated);
    console.log('Pagination:', data.pagination);
    
    // Process each trade
    data.coordinated.forEach(trade => {
      console.log(`Token: ${trade.tokenAddress}`);
      console.log(`Wallets involved: ${trade.uniqueWalletCount}`);
      console.log('Wallet addresses:', trade.walletAddressesParsed);
      console.log('Detection time:', new Date(trade.triggeredAt));
      console.log('---');
    });
  } catch (error) {
    console.error('Failed to load historical trades:', error);
  }
}

// Example 2: Setup real-time monitoring
function startRealtimeMonitoring() {
  client.setupRealtimeCoordinated(
    (coordinatedTrade) => {
      console.log('🚨 New coordinated trade detected!');
      console.log(`Token: ${coordinatedTrade.tokenAddress}`);
      console.log(`Unique wallets: ${coordinatedTrade.uniqueWalletCount}`);
      console.log(`Wallet addresses:`, coordinatedTrade.walletAddresses);
      console.log(`Window: ${coordinatedTrade.windowStart} to ${coordinatedTrade.windowEnd}`);
      
      // Add to your UI here
      addTradeToUI(coordinatedTrade);
    },
    (error) => {
      console.error('Real-time connection error:', error);
      // Implement reconnection logic here
    }
  );
}

// Example 3: React Hook for coordinated trades
function useCoordinatedTrades() {
  const [trades, setTrades] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const clientRef = React.useRef(new CoordinatedTradesClient());

  React.useEffect(() => {
    const client = clientRef.current;

    // Load initial data
    async function loadInitialData() {
      try {
        const data = await client.fetchCoordinatedTrades(1, 50);
        setTrades(data.coordinated);
        setLoading(false);
      } catch (err) {
        setError(err);
        setLoading(false);
      }
    }

    // Setup real-time updates
    function setupRealtime() {
      client.setupRealtimeCoordinated(
        (newTrade) => {
          setTrades(prev => [newTrade, ...prev.slice(0, 99)]); // Keep only last 100
        },
        (err) => {
          console.error('Real-time error:', err);
          setError(err);
        }
      );
    }

    loadInitialData();
    setupRealtime();

    // Cleanup
    return () => {
      client.disconnect();
    };
  }, []);

  return { trades, loading, error };
}

// Example 4: Vue.js Composable
function useCoordinatedTradesVue() {
  const trades = Vue.ref([]);
  const loading = Vue.ref(true);
  const error = Vue.ref(null);
  const client = new CoordinatedTradesClient();

  Vue.onMounted(async () => {
    try {
      // Load initial data
      const data = await client.fetchCoordinatedTrades();
      trades.value = data.coordinated;
      
      // Setup real-time
      client.setupRealtimeCoordinated(
        (newTrade) => {
          trades.value.unshift(newTrade);
        }
      );
      
      loading.value = false;
    } catch (err) {
      error.value = err;
      loading.value = false;
    }
  });

  Vue.onUnmounted(() => {
    client.disconnect();
  });

  return { trades, loading, error };
}

// Example UI update function
function addTradeToUI(coordinatedTrade) {
  // Create a new trade element
  const tradeElement = document.createElement('div');
  tradeElement.className = 'coordinated-trade';
  tradeElement.innerHTML = `
    <div class="trade-header">
      <span class="token">Token: ${coordinatedTrade.tokenAddress}</span>
      <span class="time">${new Date(coordinatedTrade.triggeredAt).toLocaleString()}</span>
    </div>
    <div class="trade-details">
      <p>Unique Wallets: ${coordinatedTrade.uniqueWalletCount}</p>
      <p>Window: ${new Date(coordinatedTrade.windowStart).toLocaleString()} - ${new Date(coordinatedTrade.windowEnd).toLocaleString()}</p>
    </div>
    <div class="wallet-list">
      <details>
        <summary>View Wallet Addresses (${coordinatedTrade.walletAddresses.length})</summary>
        <ul>
          ${coordinatedTrade.walletAddresses.map(addr => `<li><code>${addr}</code></li>`).join('')}
        </ul>
      </details>
    </div>
  `;
  
  // Add to the top of the trades container
  const container = document.getElementById('trades-container');
  if (container) {
    container.prepend(tradeElement);
    
    // Keep only the latest 50 trades in the UI
    const trades = container.children;
    if (trades.length > 50) {
      container.removeChild(trades[trades.length - 1]);
    }
  }
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CoordinatedTradesClient };
}

// Export for ES6 modules
export { CoordinatedTradesClient };
