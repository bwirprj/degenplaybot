const gmgnService = require('../services/gmgn');
const dexscreenerService = require('../services/dexscreener');
const geckoTerminalService = require('../services/geckoterminal');
const okxService = require('../services/okx');
const solanaService = require('../services/solana');
const { stochRSI } = require('../indicators/stochRSI');
const logger = require('../utils/logger');
const formatter = require('../bot/formatter');

class PortfolioModule {
  constructor(botInstance) {
    this.bot = botInstance;
  }

  async run(walletAddress, chatId) {
    logger.info(`Starting portfolio check for ${walletAddress}`);
    try {
      // 1. Fetch assets using Helius DAS (Lead source for balance/metadata)
      const assets = await solanaService.getAssetsByOwner(walletAddress);

      if (!assets || assets.length === 0) {
        logger.info('No holdings found via Helius DAS.');
        return;
      }

      // Optional: Still try GMGN for PnL data
      let gmgnHoldings = [];
      try {
        gmgnHoldings = await gmgnService.getWalletHoldings(walletAddress);
      } catch (e) {
        logger.warn('GMGN Holdings fetch failed during cron, using DAS metadata.');
      }

      // 2. Iterate each token
      for (const holding of assets) {
        // Priority 1: Use price from Helius DAS if present
        let price = holding.price || 0;

        // Priority 2: Try DexScreener if Helius price is 0
        if (price === 0) {
          const pair = await dexscreenerService.getTokenData(holding.token_address);
          if (pair) {
            price = parseFloat(pair.priceUsd || 0);
          }
        }

        const gmgnInfo = gmgnHoldings.find(h => h.token_address === holding.token_address);
        
        // Final update to price
        holding.price = price;

        // Skip tiny dust
        if ((holding.balance * price) < 1) continue;

        // Enrich with GMGN PnL if available
        if (gmgnInfo) {
          holding.unrealized_pnl_pct = gmgnInfo.unrealized_pnl_pct;
        }

        const tokenAddress = holding.token_address;
        
        // 3. Fetch OHLCV for indicators
        // Priority 1: GeckoTerminal (Most stable on VPS)
        let candles = await geckoTerminalService.getCandles15m(tokenAddress);
        
        // Priority 2: OKX
        if (!candles || candles.length < 30) {
          candles = await okxService.getCandles15m(holding.symbol);
        }
        
        // Priority 3: GMGN (Fallback)
        if (!candles || candles.length < 30) {
          try {
            candles = await gmgnService.getCandles15m(tokenAddress);
          } catch (e) {
            // GMGN logic failure
          }
        }

        if (!candles || candles.length < 30) {
          logger.error(`Failed to get enough candles for ${holding.symbol} across all sources.`);
          continue;
        }

        // Calculate StochRSI
        const result = stochRSI(candles);
        if (!result) continue;

        // Check if alert needed
        if (result.isAlert && chatId) {
          const msg = formatter.formatPortfolioAlert(holding, result);
          this.bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
        }
      }
      logger.info('Portfolio check completed.');
    } catch (error) {
      logger.error('Error in Portfolio module run:', error);
    }
  }
}

module.exports = PortfolioModule;
