const axios = require('axios');
const logger = require('../utils/logger');

class DexScreenerService {
  constructor() {
    this.baseURL = 'https://api.dexscreener.com/latest/dex';
  }

  /**
   * Fetch trending tokens on Solana via basic search
   */
  async getTrendingTokens() {
    try {
      const response = await axios.get(`${this.baseURL}/search?q=solana`);
      return this._mapPairs(response.data?.pairs || []);
    } catch (error) {
      logger.error('DexScreener API error:', error.message);
      return [];
    }
  }

  /**
   * Fetch latest boosted tokens (High momentum)
   */
  async getLatestBoosts() {
    try {
      const response = await axios.get('https://api.dexscreener.com/token-boosts/latest/v1');
      const data = response.data || [];
      const solanaTokens = data.filter(t => t.chainId === 'solana');
      
      // Since boosts only give address, we need to fetch metadata for them
      // To be efficient, we'll fetch them in batches or as encountered
      return solanaTokens.map(t => ({
        address: t.tokenAddress,
        chainId: 'solana',
        boosted: true
      }));
    } catch (error) {
      logger.error('DexScreener Boosts API error:', error.message);
      return [];
    }
  }

  /**
   * Fetch latest token profiles (Fresh metadata)
   */
  async getLatestProfiles() {
    try {
      const response = await axios.get('https://api.dexscreener.com/token-profiles/latest/v1');
      const data = response.data || [];
      return data
        .filter(t => t.chainId === 'solana')
        .map(t => ({
          address: t.tokenAddress,
          symbol: t.symbol || 'Unknown',
          name: t.name || 'Unknown',
          chainId: 'solana',
          url: t.url,
          icon: t.icon
        }));
    } catch (error) {
      logger.error('DexScreener Profiles API error:', error.message);
      return [];
    }
  }

  /**
   * Helper to map pairs to our internal token format
   */
  _mapPairs(pairs) {
    return pairs
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
