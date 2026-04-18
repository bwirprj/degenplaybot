const axios = require('axios');
const logger = require('../utils/logger');

class OKXService {
  constructor() {
    this.client = axios.create({
      baseURL: 'https://www.okx.com',
      timeout: 10000
    });
  }

  /**
   * Get 15m candles from OKX
   * @param {string} tokenSymbol e.g., 'MEME'
   */
  async getCandles15m(tokenSymbol) {
    try {
      // NOTE: OKX uses INSTID like 'SOL-USDT'. Many meme tokens are not on OKX.
      // This is a long-shot fallback for listed tokens.
      const instId = `${tokenSymbol.toUpperCase()}-USDT`;
      const response = await this.client.get(`/api/v5/market/history-candles`, {
        params: {
          instId: instId,
          bar: '15m',
          limit: 100
        }
      });

      if (response.data.code === '0' && response.data.data) {
        // OKX format: [ts, o, h, l, c, vol, volCcy, volCcyQuote, confirm]
        const sortedData = response.data.data.reverse(); // old to new
        return sortedData.map(candle => ({
          t: parseInt(candle[0]),
          o: parseFloat(candle[1]),
          h: parseFloat(candle[2]),
          l: parseFloat(candle[3]),
          c: parseFloat(candle[4]),
          v: parseFloat(candle[5])
        }));
      }
      return null;
    } catch (error) {
      logger.debug(`OKX fetch failed for ${tokenSymbol} (likely unlisted): ${error.message}`);
      return null; // expected for unlisted meme coins
    }
  }
}

module.exports = new OKXService();
