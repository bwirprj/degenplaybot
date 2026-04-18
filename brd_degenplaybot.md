# Business Requirement Document (BRD)
## GMGN Solana Token Alert Bot (Telegram Integration)

---

## 1. Objective
Membangun bot berbasis Telegram yang:
- Memonitor portfolio token Solana dari 1 wallet
- Memberikan alert berbasis indikator **Stochastic RSI (14,3,3)** timeframe **15 menit**
- Menemukan peluang token baru berdasarkan filter tertentu dari GMGN
- Memberikan alert sebagai **signal saja (tanpa auto-trade)**

---

## 2. Scope

### In Scope
- Integrasi API GMGN (data utama)
- Fallback ke OKX (jika data tidak tersedia di GMGN)
- Perhitungan indikator internal (fallback terakhir)
- Monitoring 1 wallet Solana (static)
- Telegram bot untuk alert

### Out of Scope (Phase 1)
- Auto trading
- Multi-user / multi-wallet
- Risk management kompleks
- Backtesting

---

## 3. System Overview

### Modules
1. Data Ingestion Layer
   - Fetch data dari GMGN
   - Fallback ke OKX
   - Fallback ke self-calculation

2. Portfolio Monitoring Engine
   - Monitor holdings
   - Generate alert tiap 15 menit

3. Market Scanner Engine
   - Scan token baru tiap 30 menit
   - Apply filter

4. Alert Engine
   - Generate signal
   - Format pesan Telegram

5. Scheduler
   - Cron-based execution

---

## 4. Functional Requirements

### 4.1 Portfolio Monitoring

#### Input
- Wallet address (static)
- Token holdings dari GMGN

#### Process
- Ambil data harga (candle 15m)
- Ambil / hitung Stoch RSI (14,3,3)

#### Logic
- Stoch RSI < 30 → DCA Zone / Oversold
- Stoch RSI > 70 → Take Profit Zone / Overbought

#### Output
- Alert ke Telegram

---

### 4.2 Market Scanner

#### Interval
- Setiap 30 menit

#### Filter Criteria

| Parameter            | Value       |
|---------------------|------------|
| Market Cap          | 10K – 1M   |
| Holders             | ≥ 1000     |
| Age                 | ≥ 4 jam    |
| Volume (1h)         | ≥ 1K       |
| Liquidity           | ≥ 1K       |
| Total Fees          | ≥ 30 SOL   |
| Bundler Percentage  | ≤ 30%      |
| Social Presence     | ≥ 1        |
| Wash Trading        | Excluded   |
| Stoch RSI           | < 30       |

---

### 4.3 Indicator Strategy (Fallback Priority)

1. GMGN API  
2. OKX API  
3. Internal Calculation:
   - Input: OHLC 15m
   - Indicator: Stoch RSI (14,3,3)

---

### 4.4 Telegram Alert Format
#### Portfolio Alert
🚨 PORTFOLIO ALERT
Token: $ABC
Price: $0.0123
Stoch RSI: 25 ↓
Signal: 🟢 DCA Zone
PnL: -12.4%
Chart: [Link GMGN]
Dex: [Link GMGN]

#### Scanner Alert
🔥 NEW OPPORTUNITY
Token: $XYZ
MC: $120K
Liquidity: $15K
Volume(1h): $3K
Stoch RSI: 28
Signal: 🟢 Oversold
DYOR

---

## 5. Non-Functional Requirements

### Performance
- Max delay: < 1 menit dari jadwal
- Support retry jika API gagal

### Reliability
- Fallback API system
- Error handling (tidak crash)

### Security
- API key disimpan di environment variable
- Tidak expose private key

## 6. Architecture Overview
Scheduler (Cron)
├── Portfolio Worker (15m)
│ ├── Fetch Wallet Tokens
│ ├── Get Indicator
│ └── Send Alert
│
└── Scanner Worker (30m)
├── Fetch Market Data
├── Apply Filters
└── Send Alert

---

## 7. Risks & Constraints

### Data Availability Risk
- GMGN mungkin tidak menyediakan:
  - wash trading flag
  - bundler percentage
- Fallback to OKX

### Indicator Accuracy Risk
- Perbedaan antara GMGN, OKX, dan internal calculation

### Latency Risk
- Interval 15 menit bisa terlalu lambat untuk market volatile

### Alert Fatigue
- Tanpa cooldown → spam alert


## 8. Assumptions
- GMGN API dapat diakses dengan private key
- Data candle 15m tersedia
- Token Solana dapat di-track via wallet API
