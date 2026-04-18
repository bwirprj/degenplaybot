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
    logger.info(`Starting high-efficiency scanner run`);
    try {
      // 1. Get filtered tokens from high-efficiency sources
      const [boosts, profiles] = await Promise.all([
        dexscreenerService.getLatestBoosts(),
        dexscreenerService.getLatestProfiles()
      ]);

      // Combine and unique by address
      const candidatesMap = new Map();
      [...boosts, ...profiles].forEach(t => {
        if (!candidatesMap.has(t.address)) {
          candidatesMap.set(t.address, t);
        }
      });

      let candidates = Array.from(candidatesMap.values());
      
      // Fallback to searching Trending Solana if boosts/profiles are empty
      if (candidates.length === 0) {
        logger.info('DexScreener Boosts/Profiles empty. Falling back to trending search...');
        candidates = await dexscreenerService.getTrendingTokens();
      }

      // Final fallback to GMGN
      if (candidates.length === 0) {
        logger.info('DexScreener sources empty. Falling back to GMGN...');
        candidates = await gmgnService.scanTokens();
      }

      if (candidates.length === 0) {
        logger.info('No candidate tokens found in this scan cycle.');
        return;
      }

      logger.info(`Scanner found ${candidates.length} candidates. Verifying technicals for TOP 5...`);

      const validPicks = [];
      const processingList = candidates.slice(0, 5); // Focus only on top 5

      for (const token of processingList) {
        // Priority 1: GeckoTerminal (Most stable on VPS)
        let candles = await geckoTerminalService.getCandles15m(token.address);
        
        // Priority 2: OKX
        if (!candles || candles.length < 30) {
           candles = await okxService.getCandles15m(token.symbol);
        }

        // Priority 3: GMGN (Fallback)
        if (!candles || candles.length < 30) {
          try {
            candles = await gmgnService.getCandles15m(token.address);
          } catch (e) {
            // GMGN logic failure
          }
        }

        if (!candles || candles.length < 30) continue;

        const result = stochRSI(candles);
        
        // Oversold signal (K < 30)
        if (result && result.k < 30) {
          // If we don't have metadata yet (from boosts), fetch it
          if (!token.symbol || token.symbol === 'Unknown') {
            const pairData = await dexscreenerService.getTokenData(token.address);
            if (pairData) {
              token.symbol = pairData.baseToken?.symbol || 'Unknown';
              token.name = pairData.baseToken?.name || 'Unknown';
              token.marketcap = pairData.fdv || 0;
              token.liquidity = pairData.liquidity?.usd || 0;
              token.volume_1h = pairData.volume?.h1 || 0;
            }
          }

          token.stoch = result;
          validPicks.push(token);
        }

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
