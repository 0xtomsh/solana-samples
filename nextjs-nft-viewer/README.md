# Next.js NFT Viewer

Solana devnet NFT viewer built with Next.js, React, and Solana Wallet Adapter.

## Features

- Connect Phantom or Solflare on devnet.
- Load NFT-like token accounts for the connected wallet or any owner address.
- Resolve Metaplex token metadata accounts and display name, symbol, URI, and image when available.
- Open mints and owners in Solana Explorer.

## Getting Started

Install dependencies from the repository root:

```bash
pnpm install
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

The app uses Solana devnet RPC via `clusterApiUrl("devnet")`.
