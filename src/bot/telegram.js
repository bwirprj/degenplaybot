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
      
      this.sendMessage(chatId, '🔄 Fetching portfolio...');
      try {
        const holdings = await gmgnService.getWalletHoldings(this.wallet);
        const text = formatter.formatPortfolioSummary(holdings);
        this.sendMessage(chatId, text, { parse_mode: 'Markdown' });
      } catch (e) {
        this.sendMessage(chatId, '❌ Failed to fetch portfolio.');
      }
    });

    this.bot.onText(/\/balance/, async (msg) => {
      const chatId = msg.chat.id;
      if (!this.wallet) return this.sendMessage(chatId, 'Wallet address not configured.');
      
      this.sendMessage(chatId, '🔄 Fetching balances from GMGN & On-Chain...');
      try {
        const holdings = await gmgnService.getWalletHoldings(this.wallet);
        let solBalance = 0;
        let splUsd = 0;
        
        holdings.forEach(h => {
          if (h.symbol === 'SOL') solBalance = h.balance;
          splUsd += (h.usd_value || 0);
        });

        // Use Solana RPC for raw SPL counts as fallback info
        const onChainTokens = await solanaService.getSPLTokenBalances(this.wallet);

        const text = `💰 *WALLET BALANCE*
Tokens count (on-chain): ${onChainTokens.length}
Est. Value (SPLs): $${splUsd.toFixed(2)}
SOL: ${solBalance}`;

        this.sendMessage(chatId, text, { parse_mode: 'Markdown' });
      } catch (e) {
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
