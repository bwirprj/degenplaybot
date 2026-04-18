class BotFormatter {
  
  formatPortfolioAlert(holding, stochResult) {
    const symbol = holding.symbol || 'Unknown';
    const price = holding.price ? `$${holding.price.toFixed(6)}` : 'N/A';
    const pnl = holding.unrealized_pnl_pct ? `${(holding.unrealized_pnl_pct * 100).toFixed(2)}%` : 'N/A';
    
    // Trend icon
    const trend = stochResult.k > stochResult.d ? '↑' : '↓';

    return `🚨 *PORTFOLIO ALERT*
Token: $${symbol}
Price: ${price}
Stoch RSI: ${stochResult.k} ${trend} (K: ${stochResult.k} | D: ${stochResult.d})
Signal: ${stochResult.signal}
PnL: ${pnl}
Chart: [GMGN Link](https://gmgn.ai/sol/token/${holding.token_address})`;
  }

  formatScannerAlert(tokens) {
    let msg = `🔥 *NEW OPPORTUNITY — Top Pre-filtered*\n\n`;

    tokens.slice(0, 3).forEach((token, index) => {
      const mcap = this._formatCurrency(token.marketcap);
      const liq = this._formatCurrency(token.liquidity);
      const vol1h = this._formatCurrency(token.volume_1h);
      
      msg += `${index + 1}️⃣ *$${token.symbol}*
   MC: ${mcap} | Liq: ${liq}
   Vol(1h): ${vol1h} | Holders: ${token.holder_count}
   Chart: [GMGN Link](https://gmgn.ai/sol/token/${token.address})\n\n`;
    });

    msg += `⚠️ _DYOR — Not financial advice_`;
    return msg;
  }

  formatPortfolioSummary(holdings) {
    if (!holdings || holdings.length === 0) {
      return `💼 *Portfolio is empty or could not be fetched.*`;
    }

    let msg = `💼 *WALLET PORTFOLIO*\n\n`;
    let totalUsd = 0;

    holdings.forEach(h => {
      const value = h.usd_value || 0;
      totalUsd += value;
      msg += `• *$${h.symbol || 'Unknown'}*: $${value.toFixed(2)} (${(h.unrealized_pnl_pct * 100).toFixed(2)}%)\n`;
    });

    msg += `\n💰 *Total Value:* $${totalUsd.toFixed(2)}`;
    return msg;
  }
  
  formatHistorySummary(activities) {
    if (!activities || activities.length === 0) {
      return `📝 *No recent activity found.*`;
    }

    let msg = `📝 *RECENT trades*\n\n`;
    activities.slice(0, 10).forEach(act => {
      const action = act.type === 'buy' ? '🟢 BUY' : (act.type === 'sell' ? '🔴 SELL' : '⚪ ' + act.type);
      const amount = act.token_amount ? act.token_amount.toFixed(2) : '0';
      msg += `${action} ${amount} $${act.token_symbol} \n`;
    });

    return msg;
  }

  _formatCurrency(value) {
    if (!value) return '$0';
    const num = parseFloat(value);
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  }
}

module.exports = new BotFormatter();
