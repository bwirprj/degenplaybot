const { Connection, PublicKey } = require('@solana/web3.js');
const config = require('../config');
const logger = require('../utils/logger');

// Fallback to public if Helius not set
const RPC_URL = config.solana.heliusRpcUrl || 'https://api.mainnet-beta.solana.com';
const connection = new Connection(RPC_URL, 'confirmed');

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');

class SolanaService {
  /**
   * Get all SPL token balances (Legacy & Token-2022) for a wallet.
   */
  async getSPLTokenBalances(walletAddress) {
    try {
      const pubkey = new PublicKey(walletAddress);
      
      // Fetch both standard and 2022 tokens
      const [legacyData, data2022] = await Promise.all([
        connection.getParsedTokenAccountsByOwner(pubkey, { programId: TOKEN_PROGRAM_ID }),
        connection.getParsedTokenAccountsByOwner(pubkey, { programId: TOKEN_2022_PROGRAM_ID })
      ]);

      const tokens = [];
      const processAccounts = (data) => {
        data.value.forEach((accountInfo) => {
          const parsedInfo = accountInfo.account.data.parsed.info;
          const mintAddress = parsedInfo.mint;
          const amount = parsedInfo.tokenAmount.uiAmountString;
          const decimals = parsedInfo.tokenAmount.decimals;

          if (parseFloat(amount) > 0) {
            tokens.push({
              token_address: mintAddress,
              balance: amount,
              decimals: decimals
            });
          }
        });
      };

      processAccounts(legacyData);
      processAccounts(data2022);
      
      return tokens;
    } catch (error) {
      logger.error('Solana RPC getSPLTokenBalances error:', error.message);
      return [];
    }
  }

  /**
   * Get native SOL balance
   */
  async getSOLBalance(walletAddress) {
    try {
      const pubkey = new PublicKey(walletAddress);
      const balance = await connection.getBalance(pubkey);
      return balance / 1e9; // lamports to SOL
    } catch (error) {
      logger.error('Solana RPC getSOLBalance error:', error.message);
      return 0;
    }
  }

  /**
   * Get recent signatures for the wallet (trade history approximation fallback)
   */
  async getRecentTransactions(walletAddress, limit = 10) {
    try {
      const pubkey = new PublicKey(walletAddress);
      const sigs = await connection.getSignaturesForAddress(pubkey, { limit });
      return sigs.map(s => ({
        signature: s.signature,
        blockTime: s.blockTime,
        status: s.confirmationStatus,
        err: s.err
      }));
    } catch (error) {
      logger.error('Solana RPC getRecentTransactions error:', error.message);
      return [];
    }
  }
}

module.exports = new SolanaService();
