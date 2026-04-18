const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const logger = require('../utils/logger');

class GeckoTerminalService {
  constructor() {
    this.poolCache = new Map(); // tokenAddress -> poolAddress
    this.client = axios.create({
      baseURL: 'https://api.geckoterminal.com/api/v2',
      timeout: 15000,
      headers: {
        'Accept': 'application/json;version=20230203'
      }
    });

    // Handle GeckoTerminal 30 req/min limits
    axiosRetry(this.client, {
      retries: 3,
      retryDelay: (retryCount) => retryCount * 3000, // 3s, 6s, 9s delay
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) || error.response?.status === 429;
      }
    });
  }

  /**
   * Lookup pool address given a token address
   */
  async getPoolAddressForToken(tokenAddress) {
    if (this.poolCache.has(tokenAddress)) {
      return this.poolCache.get(tokenAddress);
    }

    try {
      const response = await this.client.get(`/networks/solana/tokens/${tokenAddress}/pools`);
      const pools = response.data?.data;
      if (pools && pools.length > 0) {
        const addr = pools[0].attributes.address;
        this.poolCache.set(tokenAddress, addr);
        return addr;
      }
      return null;
    } catch (error) {
      if (error.response?.status === 429) {
        logger.debug(`GeckoTerminal 429: Rate limit hit during pool lookup for ${tokenAddress}`);
      } else {
        logger.debug(`GeckoTerminal fail to get pool for ${tokenAddress}:`, error.message);
      }
      return null;
    }
  }

  /**
   * Fetch OHLCV 15m
   */
  async getCandles15m(tokenAddress) {
    try {
      const poolAddress = await this.getPoolAddressForToken(tokenAddress);
      if (!poolAddress) return null;

      // Adaptive throttle: Wait 1.5s between calls to respect 30 req/min
      await new Promise(resolve => setTimeout(resolve, 1500));

      const response = await this.client.get(`/networks/solana/pools/${poolAddress}/ohlcv/minute`, {
        params: {
          aggregate: 15,
          limit: 100
        }
      });

      const ohlcvList = response.data?.data?.attributes?.ohlcv_list;
      if (!ohlcvList) return null;

      const reversed = ohlcvList.reverse();
      return reversed.map(candle => ({
        t: candle[0] * 1000,
        o: candle[1],
        h: candle[2],
        l: candle[3],
        c: candle[4],
        v: candle[5]
      }));
    } catch (error) {
      if (error.response?.status === 429) {
        logger.debug(`GeckoTerminal 429: Rate limit hit during OHLCV fetch for ${tokenAddress}`);
      } else {
        logger.debug(`GeckoTerminal OHLCV fetch failed for ${tokenAddress}:`, error.message);
      }
      return null;
    }
  }
}

module.exports = new GeckoTerminalService();
