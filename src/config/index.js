require('dotenv').config();

module.exports = {
  env: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
  },
  gmgn: {
    apiKey: process.env.GMGN_API_KEY,
  },
  solana: {
    walletAddress: process.env.WALLET_ADDRESS,
    heliusRpcUrl: process.env.HELIUS_RPC_URL,
  }
};
