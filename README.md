# 🤖 Degenplaybot

**Degenplaybot** is a Solana Token Alert Bot integrated with Telegram. It provides real-time monitoring of your SPL token portfolio and scans the market for new opportunities based on Stochastic RSI and specific GMGN/OKX metrics.

## 🚀 Features

- **Portfolio Monitoring**: Automatically tracks a specific Solana wallet every 15 minutes.
- **Smart Alerts**: Uses Stochastic RSI (14,3,3) on 15m timeframe to signal DCA (Oversold) or Take Profit (Overbought) zones.
- **Market Scanner**: Scans for new tokens every 30 minutes based on high-conviction filters (Market Cap, Holders, Age, Volume, Liquidity, etc.).
- **Multi-Source Data**: Hybrid ingestion layer using GMGN API, OKX API fallback, and internal OHLC calculation.
- **Interactive Setup**: Comes with a built-in CLI setup wizard for easy configuration.
- **Production Ready**: Optimized for PM2 with structured logging and error handling.

## 🛠 Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/bwirprj/degenplaybot.git
   cd degenplaybot
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run Setup Wizard**:
   Follow the prompts to configure your Telegram Bot Token, Chat ID, and Wallet Address.
   ```bash
   npm run setup
   ```

## 📈 Usage

### Development Mode
Runs the bot with file-watching enabled:
```bash
npm run dev
```

### Production Mode
Runs the bot using PM2 (recommended for servers):
```bash
npm run deploy
```

## ⚙️ Configuration
The bot uses a `.env` file for configuration. Key variables include:
- `TELEGRAM_BOT_TOKEN`: Your bot token from @BotFather.
- `TELEGRAM_CHAT_ID`: Your chat ID for receiving alerts.
- `GMGN_API_KEY`: API key for GMGN data services.
- `WALLET_ADDRESS`: The Solana wallet to monitor.
- `HELIUS_RPC_URL`: Solana RPC endpoint.

## 📊 Indicator Logic
- **Oversold (< 30)**: Indicates a 🟢 DCA / Buying Zone.
- **Overbought (> 70)**: Indicates a 🔴 Take Profit Zone.

## ⚠️ Disclaimer
This bot is for informational purposes only. It provides signals but does **not** execute trades automatically. Always DYOR (Do Your Own Research) before trading.

---
Built with ☕️ for the Solana Degen community.
