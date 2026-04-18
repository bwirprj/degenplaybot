const TelegramBot = require('node-telegram-bot-api');
const config = require('../config');
const logger = require('../utils/logger');
const gmgnService = require('../services/gmgn');
const solanaService = require('../services/solana');
const formatter = require('./formatter');

class TeleBot {
  constructor() {
    this.bot = new TelegramBot(config.telegram.token, { polling: true });
    this.chatId = config.telegram.chatId; // Default target
    this.wallet = config.solana.walletAddress;

    this._setupHandlers();
    logger.info('Telegram bot initialized.');
  }

  getBotInstance() {
    return this.bot;
  }

  sendMessage(chatId, text, options) {
    if (!chatId) return;
    this.bot.sendMessage(chatId, text, options)
      .catch(err => logger.error('Telegram Send Error:', err.message));
  }

  _setupHandlers() {
    this.bot.onText(/\/(start|help)/, (msg) => {
      const chatId = msg.chat.id;
      const helpText = `*DEGENPLAYBOT*
/portfolio - View current holdings
/balance - View total wallet balance
/history - View recent 10 trades
/scan - Run manual market scanner
/status - View bot status`;
      this.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
    });

    this.bot.onText(/\/portfolio/, async (msg) => {
      const chatId = msg.chat.id;
      if (!this.wallet) return this.sendMessage(chatId, 'Wallet address not configured.');
      
      this.sendMessage(chatId, '🔄 Fetching portfolio (Verifying on-chain)...');
      try {
        const [gmgnHoldings, rpcTokens] = await Promise.all([
          gmgnService.getWalletHoldings(this.wallet),
          solanaService.getSPLTokenBalances(this.wallet)
        ]);

        // Merge price data from GMGN with accurate quantity from RPC
        const refinedHoldings = gmgnHoldings.map(h => {
          const onChain = rpcTokens.find(r => r.token_address === h.token_address);
          return {
            ...h,
            balance: onChain ? parseFloat(onChain.balance) : h.balance,
            usd_value: onChain ? (parseFloat(onChain.balance) * (h.price || 0)) : (h.usd_value || 0)
          };
        });

        const text = formatter.formatPortfolioSummary(refinedHoldings);
        this.sendMessage(chatId, text, { parse_mode: 'Markdown' });
      } catch (e) {
        logger.error('Portfolio command error:', e);
        this.sendMessage(chatId, '❌ Failed to fetch portfolio.');
      }
    });

    this.bot.onText(/\/balance/, async (msg) => {
      const chatId = msg.chat.id;
      if (!this.wallet) return this.sendMessage(chatId, 'Wallet address not configured.');
      
      this.sendMessage(chatId, '🔄 Fetching real-time balance via Helius RPC...');
      try {
        const [solBalance, rpcTokens, gmgnHoldings] = await Promise.all([
          solanaService.getSOLBalance(this.wallet),
          solanaService.getSPLTokenBalances(this.wallet),
          gmgnService.getWalletHoldings(this.wallet)
        ]);

        let splUsd = 0;
        rpcTokens.forEach(r => {
          const gmgnInfo = gmgnHoldings.find(h => h.token_address === r.token_address);
          if (gmgnInfo && gmgnInfo.price) {
            splUsd += (parseFloat(r.balance) * gmgnInfo.price);
          }
        });

        const text = `💰 *WALLET BALANCE (Live RPC)*
SOL Balance: ${solBalance.toFixed(4)}
Token Accounts: ${rpcTokens.length}
Est. Token Value: $${splUsd.toFixed(2)}

_Price data handled by GMGN. Quantities verified by Helius._`;

        this.sendMessage(chatId, text, { parse_mode: 'Markdown' });
      } catch (e) {
        logger.error('Balance command error:', e);
        this.sendMessage(chatId, '❌ Failed to fetch balance.');
      }
    });

    this.bot.onText(/\/history/, async (msg) => {
      const chatId = msg.chat.id;
      if (!this.wallet) return this.sendMessage(chatId, 'Wallet address not configured.');
      
      this.sendMessage(chatId, '🔄 Fetching recent history...');
      try {
        const acts = await gmgnService.getWalletActivity(this.wallet);
        const text = formatter.formatHistorySummary(acts);
        this.sendMessage(chatId, text, { parse_mode: 'Markdown' });
      } catch (e) {
        this.sendMessage(chatId, '❌ Failed to fetch history.');
      }
    });
  }

  // Hook for modules to run manually
  attachScanner(scannerInstance) {
    this.bot.onText(/\/scan/, async (msg) => {
      const chatId = msg.chat.id;
      this.sendMessage(chatId, '🔭 Starting manual market scan. This may take a minute...');
      await scannerInstance.run(chatId);
    });
  }

  attachStatusData(data) {
    this.bot.onText(/\/status/, (msg) => {
      const text = `🤖 *BOT STATUS*
Version: 1.0.0
Environment: ${config.env}
Wallet: \`${this.wallet}\`
Scheduler:
- Portfolio: Every 15 mins
- Scanner: Every 30 mins`;
      this.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
    });
  }
}

module.exports = TeleBot;
