const readline = require('readline');
const logger = require('../src/utils/logger');
const config = require('../src/config');

// --- MOCKS ---

// 1. Mock Telegram Bot
class MockTelegramBot {
  constructor() {
    this.handlers = [];
  }
  onText(regex, handler) {
    this.handlers.push({ regex, handler });
  }
  sendMessage(chatId, text, options) {
    console.log(`\n[BOT SEND] To Chat ${chatId}:`);
    console.log(text);
    if (options && options.reply_markup) {
      console.log(`[BUTTONS]:`, JSON.stringify(options.reply_markup));
    }
    console.log('-------------------------------------------\n');
    return Promise.resolve();
  }
  // Simulate receiving a message
  async simulateMessage(chatId, text) {
    for (const h of this.handlers) {
      const match = text.match(h.regex);
      if (match) {
        await h.handler({ chat: { id: chatId }, text }, match);
      }
    }
  }
}

// 2. Mock Services
const gmgnService = require('../src/services/gmgn');
const solanaService = require('../src/services/solana');
const okxService = require('../src/services/okx');

// Override GMGN methods
gmgnService.getWalletHoldings = async () => [
  { symbol: 'SOL', balance: 1.5, price: 150, usd_value: 225, token_address: 'So11111111111111111111111111111111111111112' },
  { symbol: 'MEME', balance: 1000000, price: 0.0001, usd_value: 100, token_address: 'MEME123...', unrealized_pnl_pct: 0.25 }
];
gmgnService.getWalletActivity = async () => [
  { type: 'buy', token_symbol: 'MEME', token_amount: 500000, block_timestamp: Date.now() / 1000 }
];
gmgnService.scanTokens = async () => [
  { symbol: 'NEW', address: 'NEW123', marketcap: 50000, liquidity: 5000, volume_1h: 2000, holder_count: 1200 }
];

// Override Solana methods
solanaService.getSOLBalance = async () => 1.5432;
solanaService.getSPLTokenBalances = async () => [
  { token_address: 'So11111111111111111111111111111111111111112', balance: '1.5432' },
  { token_address: 'MEME123...', balance: '1000000.00' }
];

// --- INIT BOT ---
const TeleBot = require('../src/bot/telegram');
const ScannerModule = require('../src/modules/scanner');

// Inject dummy config for Simulation
config.solana.walletAddress = '675kPX9MHTjS2zt1qfr1NYHuHdiZAnf5ekbCS8L6681i'; // Dummy Raydium Authority
config.telegram.token = 'MOCK_TOKEN';

const teleBot = new TeleBot();
// Override inner bot before it does anything
teleBot.bot = new MockTelegramBot();
teleBot.wallet = config.solana.walletAddress;
teleBot._setupHandlers(); // Re-bind handlers to mock

const scanner = new ScannerModule(teleBot);
teleBot.attachScanner(scanner);
teleBot.attachStatusData({});

// --- REPL ---
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'TELEGRAM CMD > '
});

console.log('\n🤖 Degenplaybot Simulation Environment');
console.log('Type a command (e.g., /portfolio, /balance, /scan, /status) or "exit" to quit.\n');

rl.prompt();

rl.on('line', async (line) => {
  const cmd = line.trim();
  if (cmd.toLowerCase() === 'exit') {
    console.log('Exiting simulation in 1s...');
    setTimeout(() => rl.close(), 1000);
    return;
  }

  if (cmd.startsWith('/')) {
    logger.info(`Simulation: User sent ${cmd}`);
    try {
      await teleBot.bot.simulateMessage(12345, cmd);
    } catch (err) {
      console.error('Simulation error:', err);
    }
  } else {
    console.log('Error: Command must start with /');
  }
  // No prompt inside the async handler to avoid overlap
}).on('close', () => {
  console.log('Simulation terminated.');
  process.exit(0);
});
