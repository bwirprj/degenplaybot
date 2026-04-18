const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');

async function setup() {
  console.log('🤖 Degenplaybot Setup Wizard');
  console.log('------------------------------');

  const questions = [
    {
      type: 'input',
      name: 'TELEGRAM_BOT_TOKEN',
      message: 'Enter your Telegram Bot Token:',
      validate: input => input.length > 0 ? true : 'Token is required'
    },
    {
      type: 'input',
      name: 'TELEGRAM_CHAT_ID',
      message: 'Enter your Telegram Chat ID:',
      validate: input => input.length > 0 ? true : 'Chat ID is required'
    },
    {
      type: 'input',
      name: 'GMGN_API_KEY',
      message: 'Enter your GMGN API Key:',
      default: 'gmgn_1660ede5d275eae0903ed75834984154',
      validate: input => input.length > 0 ? true : 'GMGN API Key is required'
    },
    {
      type: 'input',
      name: 'WALLET_ADDRESS',
      message: 'Enter the Solana Wallet Address to monitor (SPL tokens):',
      validate: input => input.length >= 32 && input.length <= 44 ? true : 'Invalid Solana address length'
    },
    {
      type: 'input',
      name: 'HELIUS_RPC_URL',
      message: 'Enter your Helius RPC URL:',
      default: 'https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY',
    }
  ];

  const answers = await inquirer.prompt(questions);

  let envContent = `LOG_LEVEL=info\nNODE_ENV=development\n\n`;
  for (const [key, value] of Object.entries(answers)) {
    envContent += `${key}=${value}\n`;
  }

  fs.writeFileSync(envPath, envContent);
  console.log('\n✅ Setup complete! Configuration saved to .env');
  console.log('Run `npm install` and then `npm run dev` to start the bot locally.');
}

setup().catch(console.error);
