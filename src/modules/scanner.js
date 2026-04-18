const gmgnService = require('../services/gmgn');
const dexscreenerService = require('../services/dexscreener');
const geckoTerminalService = require('../services/geckoterminal');
const okxService = require('../services/okx');
const { stochRSI } = require('../indicators/stochRSI');
const logger = require('../utils/logger');
const formatter = require('../bot/formatter');

class ScannerModule {
  constructor(botInstance) {
    this.bot = botInstance;
  }

  async run(chatId) {
    logger.info(`Starting scanner run`);
    try {
      // 1. Get filtered tokens
      let candidates = await gmgnService.scanTokens();
      
      // Fallback to DexScreener if GMGN fails or returns nothing
      if (!candidates || candidates.length === 0) {
        logger.info('GMGN scanner failed or empty. Falling back to DexScreener trending...');
        candidates = await dexscreenerService.getTrendingTokens();
      }

      if (!candidates || candidates.length === 0) {
        logger.info('No candidate tokens found in this scan cycle (both GMGN and DexScreener failed).');
        return;
      }

      logger.info(`Scanner found ${candidates.length} pre-filtered tokens. Checking StochRSI...`);

      const validPicks = [];

      // 2. Limit processing to top 20 candidates to avoid API rate limits
      const processingList = candidates.slice(0, 20);

      for (const token of processingList) {
        let candles = null;
        try {
          candles = await gmgnService.getCandles15m(token.address);
        } catch (e) {
          logger.warn(`GMGN candles failed for ${token.symbol}, trying OKX/Gecko...`);
        }
        
        if (!candles || candles.length < 30) {
           candles = await okxService.getCandles15m(token.symbol);
        }
        if (!candles || candles.length < 30) {
           candles = await geckoTerminalService.getCandles15m(token.address);
        }

        if (!candles || candles.length < 30) continue;

        const result = stochRSI(candles);
        if (result && result.k < 30) {
          // Token is valid and Oversold
          token.stoch = result;
          validPicks.push(token);
        }

        // Just need top 3
        if (validPicks.length >= 3) break;
      }

      if (validPicks.length > 0 && chatId) {
        const msg = formatter.formatScannerAlert(validPicks);
        this.bot.sendMessage(chatId, msg, { parse_mode: 'Markdown', disable_web_page_preview: true });
      }

    } catch (error) {
      logger.error('Error in Scanner module run:', error);
    }
  }
}

module.exports = ScannerModule;
