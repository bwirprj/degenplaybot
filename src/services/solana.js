const { Connection, PublicKey } = require('@solana/web3.js');
const config = require('../config');
const logger = require('../utils/logger');

// Fallback to public if Helius not set
const RPC_URL = config.solana.heliusRpcUrl || 'https://api.mainnet-beta.solana.com';
const connection = new Connection(RPC_URL, 'confirmed');

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

class SolanaService {
  /**
   * Get all SPL token balances for a wallet.
   * This is used as a fallback if GMGN portfolio fetch fails.
   */
  async getSPLTokenBalances(walletAddress) {
    try {
      const pubkey = new PublicKey(walletAddress);
      const data = await connection.getParsedTokenAccountsByOwner(pubkey, {
        programId: TOKEN_PROGRAM_ID,
      });

      const tokens = [];
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
      return tokens;
    } catch (error) {
      logger.error('Solana RPC getSPLTokenBalances error:', error.message);
      return [];
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
