# Next.js NFT Viewer

Multi-chain wallet NFT viewer built with Next.js, React, Solana Wallet Adapter, browser EVM wallets, and Alchemy.

## Features

- Connect Phantom or Solflare for Solana.
- Connect MetaMask or another injected EVM wallet.
- Load NFTs from Ethereum, Polygon, Base, Arbitrum, Optimism, and Solana through Alchemy.
- Search, sort, filter by chain, and inspect NFT metadata detail views.

## Getting Started

Install dependencies from the repository root:

```bash
pnpm install
```

Create `nextjs-nft-viewer/.env.local`:

```bash
ALCHEMY_API_KEY=your_alchemy_api_key
```

Run the app:

```bash
pnpm dev:nft
```

Build or typecheck:

```bash
pnpm build:nft
pnpm typecheck:nft
```

EVM NFTs are loaded with Alchemy NFT API. Solana NFTs are loaded with Alchemy DAS.
