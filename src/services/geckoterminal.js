const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const logger = require('../utils/logger');

class GeckoTerminalService {
  constructor() {
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
      retryDelay: (retryCount) => retryCount * 2000, // 2s, 4s, 6s delay
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) || error.response?.status === 429;
      }
    });
  }

  /**
   * Lookup pool address given a token address
   */
  async getPoolAddressForToken(tokenAddress) {
    try {
      const response = await this.client.get(`/networks/solana/tokens/${tokenAddress}/pools`);
      const pools = response.data?.data;
      if (pools && pools.length > 0) {
        // get the most liquid pool
        return pools[0].attributes.address;
      }
      return null;
    } catch (error) {
      logger.error(`GeckoTerminal fail to get pool for ${tokenAddress}:`, error.message);
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

      // Rate limit artificial timeout for GT (30 req / min limit)
      await new Promise(resolve => setTimeout(resolve, 1000));

      const response = await this.client.get(`/networks/solana/pools/${poolAddress}/ohlcv/minute`, {
        params: {
          aggregate: 15,
          limit: 100
        }
      });

      const ohlcvList = response.data?.data?.attributes?.ohlcv_list;
      if (!ohlcvList) return null;

      // GeckoTerminal format: [timestamp, open, high, low, close, volume]
      // Result is usually new to old. We should reverse to match old to new.
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
      logger.error(`GeckoTerminal OHLCV fetch failed for ${tokenAddress}:`, error.message);
      return null;
    }
  }
}

module.exports = new GeckoTerminalService();
