const gmgnService = require('../services/gmgn');
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
        const gmgnInfo = gmgnHoldings.find(h => h.token_address === holding.token_address);
        
        // Skip tiny dust
        if ((holding.balance * (holding.price || 0)) < 1) continue;

        // Enrich with GMGN PnL if available
        if (gmgnInfo) {
          holding.unrealized_pnl_pct = gmgnInfo.unrealized_pnl_pct;
        }

        const tokenAddress = holding.token_address;
        
        // Fetch OHLCV
        let candles = await gmgnService.getCandles15m(tokenAddress);
        
        // Fallbacks
        if (!candles || candles.length < 30) {
          logger.warn(`GMGN candles failed/insufficient for ${holding.symbol}, fallback to OKX...`);
          candles = await okxService.getCandles15m(holding.symbol);
        }
        
        if (!candles || candles.length < 30) {
          logger.warn(`OKX candles failed, fallback to GeckoTerminal pool for ${holding.symbol}...`);
          candles = await geckoTerminalService.getCandles15m(tokenAddress);
        }

        if (!candles || candles.length < 30) {
          logger.error(`Failed to get enough candles for ${holding.symbol}`);
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
