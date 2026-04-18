const axios = require('axios');
const logger = require('../utils/logger');

class DexScreenerService {
  constructor() {
    this.baseURL = 'https://api.dexscreener.com/latest/dex';
  }

  /**
   * Fetch trending tokens on Solana
   */
  async getTrendingTokens() {
    try {
      // DexScreener doesn't have a direct "trending" endpoint that's easy to use without search,
      // but we can search for hot pairs on Solana.
      const response = await axios.get(`${this.baseURL}/search?q=solana`);
      
      const pairs = response.data?.pairs || [];
      
      // Filter for Solana pairs and ensure they have metadata
      const tokens = pairs
        .filter(p => p.chainId === 'solana')
        .map(p => ({
          symbol: p.baseToken?.symbol || 'Unknown',
          address: p.baseToken?.address,
          name: p.baseToken?.name || 'Unknown',
          marketcap: p.fdv || 0,
          liquidity: p.liquidity?.usd || 0,
          volume_1h: p.volume?.h1 || 0,
          price: parseFloat(p.priceUsd || 0),
          url: p.url
        }));

      return tokens;
    } catch (error) {
      logger.error('DexScreener API error:', error.message);
      return [];
    }
  }

  /**
   * Fetch specific token data
   */
  async getTokenData(tokenAddress) {
    try {
      const response = await axios.get(`${this.baseURL}/tokens/${tokenAddress}`);
      return response.data?.pairs?.[0] || null;
    } catch (error) {
      logger.error(`DexScreener getTokenData error for ${tokenAddress}:`, error.message);
      return null;
    }
  }
}

module.exports = new DexScreenerService();
