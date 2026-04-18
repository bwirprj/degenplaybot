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
      
      this.sendMessage(chatId, '🔄 Fetching portfolio (Verified via Helius DAS)...');
      try {
        // Helius DAS returns everything (Balance + Metadata)
        const assets = await solanaService.getAssetsByOwner(this.wallet);
        
        if (assets.length === 0) {
          return this.sendMessage(chatId, '💼 *Your wallet appears to be empty or Helius DAS is syncing.*', { parse_mode: 'Markdown' });
        }

        // Optional: Still try GMGN for PnL data, but don't fail if it 403s
        let gmgnHoldings = [];
        try {
          gmgnHoldings = await gmgnService.getWalletHoldings(this.wallet);
        } catch (e) {
          logger.warn('GMGN Holdings fetch failed (403), using Helius DAS metadata.');
        }

        const displayHoldings = assets.map(a => {
          const gmgnInfo = gmgnHoldings.find(h => h.token_address === a.token_address);
          return {
            ...a,
            unrealized_pnl_pct: gmgnInfo ? gmgnInfo.unrealized_pnl_pct : 0,
            // Use Helius as lead for symbol/balance
            symbol: a.symbol || (gmgnInfo ? gmgnInfo.symbol : 'Unknown')
          };
        });

        const text = formatter.formatPortfolioSummary(displayHoldings);
        this.sendMessage(chatId, text, { parse_mode: 'Markdown' });
      } catch (e) {
        logger.error('Portfolio command error:', e);
        this.sendMessage(chatId, '❌ Failed to fetch portfolio.');
      }
    });

    this.bot.onText(/\/balance/, async (msg) => {
      const chatId = msg.chat.id;
      if (!this.wallet) return this.sendMessage(chatId, 'Wallet address not configured.');
      
      this.sendMessage(chatId, '🔄 Fetching live balances via Helius DAS...');
      try {
        const [solBalance, assets] = await Promise.all([
          solanaService.getSOLBalance(this.wallet),
          solanaService.getAssetsByOwner(this.wallet)
        ]);

        let totalValue = 0;
        assets.forEach(a => {
          totalValue += (a.balance * (a.price || 0));
        });

        const text = `💰 *WALLET BALANCE (Verified Helius)*
SOL Balance: ${solBalance.toFixed(4)}
Token Accounts: ${assets.length}
Est. Token Value: $${totalValue.toFixed(2)}

_Metadata and quantities verified by Helius DAS._`;

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
