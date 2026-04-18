const { Connection, PublicKey } = require('@solana/web3.js');
const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

// Fallback to public if Helius not set
const RPC_URL = config.solana.heliusRpcUrl || 'https://api.mainnet-beta.solana.com';
const connection = new Connection(RPC_URL, 'confirmed');

class SolanaService {
  /**
   * Get all assets (Tokens & NFTs) using Helius DAS API.
   * Returns metadata (symbol, name) + balance.
   */
  async getAssetsByOwner(walletAddress) {
    try {
      // Helius DAS API is accessible via POST to the RPC URL
      const response = await axios.post(RPC_URL, {
        jsonrpc: '2.0',
        id: 'portfolio-fetch',
        method: 'getAssetsByOwner',
        params: {
          ownerAddress: walletAddress,
          page: 1,
          limit: 100,
          displayOptions: {
            showFungible: true,
            showNativeBalance: true
          }
        }
      });

      const items = response.data?.result?.items || [];
      const tokens = [];

      items.forEach(item => {
        // We focus on fungible tokens (SPL) and Token-2022
        const isFungible = item.interface === 'FungibleToken' || item.interface === 'FungibleAsset';
        const balanceInfo = item.token_info || {};
        const balance = balanceInfo.balance / Math.pow(10, balanceInfo.decimals || 0);

        if (isFungible && balance > 0) {
          tokens.push({
            token_address: item.id,
            symbol: item.content?.metadata?.symbol || item.token_info?.symbol || 'Unknown',
            name: item.content?.metadata?.name || 'Unknown Token',
            balance: balance,
            decimals: balanceInfo.decimals,
            price: item.token_info?.price_info?.price_per_token || 0
          });
        }
      });

      return tokens;
    } catch (error) {
      logger.error('Helius DAS getAssetsByOwner error:', error.message);
      return [];
    }
  }

  // Keep for legacy code compatibility if needed, but redirects to DAS
  async getSPLTokenBalances(walletAddress) {
    return this.getAssetsByOwner(walletAddress);
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
