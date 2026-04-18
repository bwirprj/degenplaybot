const cron = require('node-cron');
const config = require('./config');
const logger = require('./utils/logger');

const TeleBot = require('./bot/telegram');
const PortfolioModule = require('./modules/portfolio');
const ScannerModule = require('./modules/scanner');

logger.info('Starting Degenplaybot execution environment...');

// Ensure core config is available
if (!config.telegram.token || !config.solana.walletAddress || !config.gmgn.apiKey) {
  logger.error('Missing critical configuration in .env. Please run `npm run setup`.');
  process.exit(1);
}

// 1. Init Bot Instance
const teleBot = new TeleBot();
teleBot.attachStatusData({});

// 2. Init Modules
const portfolioModule = new PortfolioModule(teleBot);
const scannerModule = new ScannerModule(teleBot);

// 3. Attach Scanner to manual command
teleBot.attachScanner(scannerModule);

const defaultChatId = config.telegram.chatId;

// 4. Setup Schedulers
const PORTFOLIO_INTERVAL = 15; // minutes
const SCANNER_INTERVAL = 30; // minutes

// Helper to format countdown
function getCountdown() {
  const now = new Date();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  const nextPortfolio = PORTFOLIO_INTERVAL - (minutes % PORTFOLIO_INTERVAL);
  const nextScanner = SCANNER_INTERVAL - (minutes % SCANNER_INTERVAL);

  const format = (m, s) => {
    let remM = m - 1;
    let remS = 60 - s;
    if (remS === 60) {
      remM += 1;
      remS = 0;
    }
    return `${remM}m ${remS}s`;
  };

  return `manage ${format(nextPortfolio, seconds)} | screening ${format(nextScanner, seconds)}`;
}

// Ticker to show countdown in logs
setInterval(() => {
  console.log(`⏳ ${getCountdown()}`);
}, 30000); // every 30 seconds

// Portfolio: every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  try {
    logger.info('Cron triggered: Portfolio 15m');
    await portfolioModule.run(config.solana.walletAddress, defaultChatId);
  } catch (error) {
    logger.error('Cron Portfolio Error:', error);
  }
});

// Scanner: every 30 minutes
cron.schedule('*/30 * * * *', async () => {
  try {
    logger.info('Cron triggered: Scanner 30m');
    await scannerModule.run(defaultChatId);
  } catch (error) {
    logger.error('Cron Scanner Error:', error);
  }
});

// Initial notification
if (defaultChatId) {
  teleBot.sendMessage(defaultChatId, '🟢 *Degenplaybot started and schedulers active!*', { parse_mode: 'Markdown' });
}
logger.info('Degenplaybot running and waiting for cron triggers...');
console.log(`⏳ ${getCountdown()}`);

// Process exit handlers
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
