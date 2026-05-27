# solana-samples

Public monorepo for small Solana application samples.

## Apps

| App | Stack | Description |
| --- | --- | --- |
| [`nextjs-token-swap`](./nextjs-token-swap) | Next.js, Solana Wallet Adapter, Jupiter API | Token swap interface with mainnet Jupiter execution, devnet mock swap flow, balances, slippage, confirmation, and local history. |
| [`nextjs-nft-viewer`](./nextjs-nft-viewer) | Next.js, Solana Wallet Adapter, Solana Web3.js | Devnet NFT viewer that scans owner token accounts and resolves Metaplex metadata when available. |
| [`solana-wallet-connection`](./solana-wallet-connection) | Next.js, Solana Wallet Adapter | Devnet wallet connection sample with wallet status, public key tools, and SOL balance display. |
| [`react-solana-transaction-history`](./react-solana-transaction-history) | Vite, React, Solana Web3.js | Wallet transaction history viewer using signatures and parsed transaction details. |

## Screenshots

### Next.js Token Swap

![Next.js Token Swap](./docs/screenshots/nextjs-token-swap.png)

### Solana Wallet Connection

![Solana Wallet Connection](./docs/screenshots/solana-wallet-connection.png)

### React Solana Transaction History

![React Solana Transaction History](./docs/screenshots/react-solana-transaction-history.png)

## Getting Started

Install dependencies from the repository root:

```bash
pnpm install
```

Run an app:

```bash
pnpm dev:nts
pnpm dev:nft
pnpm dev:swc
pnpm dev:rth
```

Build or typecheck an app:

```bash
pnpm build:nts
pnpm typecheck:nts

pnpm build:nft
pnpm typecheck:nft

pnpm build:swc
pnpm typecheck:swc

pnpm build:rth
pnpm typecheck:rth
```

Stop local dev servers that commonly run in this workspace:

```bash
pnpm dev:down
```

## Package Scripts

| Script | Description |
| --- | --- |
| `dev:nts` | Start `nextjs-token-swap`. |
| `build:nts` | Build `nextjs-token-swap`. |
| `typecheck:nts` | Typecheck `nextjs-token-swap`. |
| `dev:nft` | Start `nextjs-nft-viewer`. |
| `build:nft` | Build `nextjs-nft-viewer`. |
| `typecheck:nft` | Typecheck `nextjs-nft-viewer`. |
| `dev:swc` | Start `solana-wallet-connection`. |
| `build:swc` | Build `solana-wallet-connection`. |
| `typecheck:swc` | Typecheck `solana-wallet-connection`. |
| `dev:rth` | Start `react-solana-transaction-history`. |
| `build:rth` | Build `react-solana-transaction-history`. |
| `typecheck:rth` | Typecheck `react-solana-transaction-history`. |
| `dev:down` | Stop common local dev server ports: `3000`, `3001`, `3002`, `3003`, `4173`, `5173`, `5174`. |

## Notes

- Next.js apps use Turbopack.
- The swap app defaults to mainnet-beta for real Jupiter swaps.
- The swap app's devnet mode is intentionally mocked for swap execution while still using devnet RPC for wallet and balance reads.
