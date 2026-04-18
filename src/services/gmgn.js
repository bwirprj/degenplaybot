const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const config = require('../config');
const logger = require('../utils/logger');

const gmgnClient = axios.create({
  baseURL: 'https://gmgn.ai',
  headers: {
    'x-api-key': config.gmgn.apiKey,
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://gmgn.ai/',
    'Origin': 'https://gmgn.ai',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  },
  timeout: 15000
});

// Configure retry
axiosRetry(gmgnClient, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || error.response?.status === 429;
  }
});

class GMGNService {
  /**
   * Fetch token holding from a wallet
   */
  async getWalletHoldings(walletAddress) {
    try {
      const response = await gmgnClient.get(`/api/v1/wallet/${walletAddress}/holdings`, {
        params: { chain: 'sol' }
      });
      return response.data?.data?.holdings || [];
    } catch (error) {
      logger.error('Error fetching GMGN wallet holdings:', error.message);
      return [];
    }
  }

  /**
   * Fetch 15m candle data for a token
   */
  async getCandles15m(tokenAddress) {
    try {
      const response = await gmgnClient.get(`/api/v1/token/${tokenAddress}/candles`, {
        params: {
          chain: 'sol',
          resolution: 15
        }
      });
      // Assuming response.data.data.candles is an array of { o, h, l, c, v, t }
      return response.data?.data?.candles || null;
    } catch (error) {
      logger.error(`Error fetching GMGN candles for ${tokenAddress}:`, error.message);
      return null;
    }
  }

  /**
   * Scan tokens based on criteria
   */
  async scanTokens() {
    try {
      // Using rank endpoint as mentioned in research
      // If the official docs updated, adjust endpoints here
      const response = await gmgnClient.get(`/defi/quotation/v1/rank/sol/swaps/1h`, {
        params: {
          orderby: 'marketcap',
          direction: 'desc'
        }
      });

      // Filter natively returned data
      const tokens = response.data?.data?.rank || [];
      return tokens.filter(this._applyFilters);
    } catch (error) {
      logger.error('Error fetching GMGN scanner tokens:', error.message);
      return [];
    }
  }

  /**
   * Fetch wallet trade activity
   */
  async getWalletActivity(walletAddress) {
    try {
      const response = await gmgnClient.get(`/api/v1/wallet/${walletAddress}/activity`, {
        params: { chain: 'sol' }
      });
      return response.data?.data?.activities || [];
    } catch (error) {
      logger.error('Error fetching GMGN wallet activity:', error.message);
      return [];
    }
  }

  /**
   * Internal filter for Scanner
   */
  _applyFilters(token) {
    try {
      const mcap = parseFloat(token.marketcap || 0);
      const holders = parseInt(token.holder_count || 0);
      const volume1h = parseFloat(token.volume_1h || 0);
      const liquidity = parseFloat(token.liquidity || 0);
      
      // Age computation (approximate if token.created_at exists)
      const now = Date.now() / 1000;
      const createdAt = token.created_timestamp || now;
      const ageHours = (now - createdAt) / 3600;

      if (mcap < 10000 || mcap > 1000000) return false;
      if (holders < 1000) return false;
      if (ageHours < 4) return false;
      if (volume1h < 1000) return false;
      if (liquidity < 1000) return false;

      // Optional/best-effort checks based on BRD (bundler/wash trading/social)
      if (token.is_wash_trading) return false;
      if (token.bundler_percentage > 30) return false;

      return true;
    } catch (e) {
      return false;
    }
  }
}

module.exports = new GMGNService();
