# JTrade (Advanced Fintech Platform)

JTrade is a highly sophisticated, enterprise-grade Next.js React application featuring live algorithmic pattern recognition, complex portfolio management, and dynamic automated trading simulations powered by custom algorithms. 

The entire platform boasts a unified, premium sleek "White-Theme" across all interfaces and utilizes low-level HTML5 canvas APIs for high-performance stock charting and analysis graphs.

## Core Features
1. **Interactive Dashboard**: A minimalist, high-level overview wrapper displaying total financial health, integrated beautifully with Next.js navigation capabilities.
2. **Real-time Portfolio Simulation**: Buy, sell, and manage virtual asset positions. Track dynamic P&L on assets powered by live random-walk algorithms. 
3. **Multi-Asset Live Charts (Canvas)**: Performant multi-asset rendering engines written natively in `canvas` Context APIs, displaying Line, Bar, and Candlestick OHLC charts.
4. **Algorithmic Pattern Recognition Engine**: 
   - Uses bespoke recursive functions to scan stock movement streams to detect 'Hammer', 'Morning Star', and 'Engulfing' candlestick structures in real-time. 
   - Automatic visual highlights via dynamic UI triangles and detailed tooltips.
5. **Algorithmic Backtesting Strategy Builder**: 
   - An advanced backtest generator where you can overlay custom Bollinger Bands, SMAs, EMAs, and RSI logic seamlessly. 
   - Provides historical execution breakdowns in a beautiful log trace.
6. **Detailed Analytics Engine**: Generates 4 simultaneous parallel canvases tracking complex standard deviation distributions, RSI bounds, multi-asset mean reversion calculations, and volume histograms.

## Deployment & Development

First, make sure Firebase is correctly configured and the environment variables matched.
Then, run the development server locally:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to explore the dashboard.

## Technical Architecture
- **Framework:** Next.js 16 (App Router)
- **Design System:** TailwindCSS V4 (Sleek Slate-50 custom white-theme implementation)
- **Component Stack:** React 19 functional async handling, zero third-party graph library dependencies internally (all HTML Canvas logic is proprietary custom-coded).
- **Backend Storage:** Firebase Authentication & Firestore (secure state syncing across devices).
