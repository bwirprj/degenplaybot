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
      // 1. Fetch holdings (RPC + GMGN)
      const [gmgnHoldings, rpcTokens] = await Promise.all([
        gmgnService.getWalletHoldings(walletAddress),
        solanaService.getSPLTokenBalances(walletAddress)
      ]);

      if (!gmgnHoldings || gmgnHoldings.length === 0) {
        logger.info('No holdings found on GMGN.');
        return;
      }

      // 2. Iterate each token
      for (const holding of gmgnHoldings) {
        // Find accurate balance from RPC
        const onChain = rpcTokens.find(r => r.token_address === holding.token_address);
        const accurateBalance = onChain ? parseFloat(onChain.balance) : holding.balance;
        const accurateUsdValue = onChain ? (accurateBalance * (holding.price || 0)) : (holding.usd_value || 0);

        // Skip tiny dust
        if (accurateUsdValue < 1) continue;

        // Update holding object for formatter
        holding.balance = accurateBalance;
        holding.usd_value = accurateUsdValue;

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
