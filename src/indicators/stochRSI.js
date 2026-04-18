/**
 * Calculate RSI
 */
function calculateRSI(closes, period = 14) {
  if (closes.length <= period) return [];

  let gains = 0;
  let losses = 0;
  const rsi = new Array(closes.length).fill(null);

  // Initial average gain/loss
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  if (avgLoss === 0) {
    rsi[period] = 100;
  } else {
    let rs = avgGain / avgLoss;
    rsi[period] = 100 - (100 / (1 + rs));
  }

  // Smoothed Moving Average (SMMA) for the rest
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    let gain = 0, loss = 0;
    if (diff > 0) gain = diff;
    else loss = -diff;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if (avgLoss === 0) {
      rsi[i] = 100;
    } else {
      let rs = avgGain / avgLoss;
      rsi[i] = 100 - (100 / (1 + rs));
    }
  }

  return rsi;
}

/**
 * Calculate Simple Moving Average
 */
function calculateSMA(data, period) {
  const sma = new Array(data.length).fill(null);
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = 0; j < period; j++) {
      if (data[i - j] !== null) {
        sum += data[i - j];
        count++;
      }
    }
    if (count === period) {
      sma[i] = sum / period;
    }
  }
  return sma;
}

/**
 * Calculate Stochastic RSI (14, 3, 3)
 */
function stochRSI(candles, period = 14, smoothK = 3, smoothD = 3) {
  if (!candles || candles.length < period * 2) return null;

  const closes = candles.map(c => c.c);
  const rsi = calculateRSI(closes, period);
  
  const stochRsiKRaw = new Array(rsi.length).fill(null);

  for (let i = period; i < rsi.length; i++) {
    const rsiWindow = rsi.slice(Math.max(0, i - period + 1), i + 1).filter(val => val !== null);
    if (rsiWindow.length === period) {
      const highestRSI = Math.max(...rsiWindow);
      const lowestRSI = Math.min(...rsiWindow);
      
      if (highestRSI === lowestRSI) {
        stochRsiKRaw[i] = 0; // Prevent div by 0
      } else {
        stochRsiKRaw[i] = ((rsi[i] - lowestRSI) / (highestRSI - lowestRSI)) * 100;
      }
    }
  }

  // Smooth K line
  const kLine = calculateSMA(stochRsiKRaw, smoothK);
  // Smooth D line
  const dLine = calculateSMA(kLine, smoothD);

  const lastK = kLine[kLine.length - 1];
  const lastD = dLine[dLine.length - 1];
  
  if (lastK === null || lastD === null || Number.isNaN(lastK)) {
    return null;
  }

  let signalStr = 'Neutral';
  let isAlert = false;
  if (lastK < 30) {
    signalStr = '🟢 DCA Zone (Oversold)';
    isAlert = true;
  } else if (lastK > 70) {
    signalStr = '🔴 TP Zone (Overbought)';
    isAlert = true;
  }

  return {
    k: Number(lastK.toFixed(2)),
    d: Number(lastD.toFixed(2)),
    signal: signalStr,
    isAlert
  };
}

module.exports = {
  stochRSI
};
