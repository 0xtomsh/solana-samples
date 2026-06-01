# Vercel Deployment

This repository is a pnpm workspace. Deploy each app as a separate Vercel project and point each project at its own root directory.

## Shared Settings

- Git repository: this repository
- Package manager: pnpm
- Install command: `pnpm install`
- Node.js version: Vercel default is fine

Do not deploy the repository root as one project. Create three Vercel projects instead.

## nextjs-nft-viewer

- Framework preset: Next.js
- Root directory: `nextjs-nft-viewer`
- Build command: `pnpm build`
- Output directory: leave empty / framework default

Environment variables:

```bash
ALCHEMY_API_KEY=your_alchemy_api_key
```

`ALCHEMY_API_KEY` is required for the NFT API route to return NFT data in production.

## nextjs-token-swap

- Framework preset: Next.js
- Root directory: `nextjs-token-swap`
- Build command: `pnpm build`
- Output directory: leave empty / framework default

Optional production environment variables:

```bash
NEXT_PUBLIC_SOLANA_RPC_URL=https://your-mainnet-rpc.example
NEXT_PUBLIC_SOLANA_MAINNET_RPC_URL=https://your-mainnet-rpc.example
NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL=https://your-devnet-rpc.example
NEXT_PUBLIC_SOLANA_TESTNET_RPC_URL=https://your-testnet-rpc.example
JUPITER_API_KEY=your-jupiter-api-key
JUPITER_API_BASE_URL=https://api.jup.ag/swap/v1
```

Without `JUPITER_API_KEY`, the app uses Jupiter's lite API. For production swaps, use a dedicated Solana RPC endpoint and a Jupiter API key.

## react-solana-transaction-history

- Framework preset: Vite
- Root directory: `react-solana-transaction-history`
- Build command: `pnpm build`
- Output directory: `dist`

Optional production environment variable:

```bash
VITE_SOLANA_RPC_URL=https://your-rpc-provider.example
```

Set `VITE_SOLANA_RPC_URL` for production to avoid public Solana RPC rate limits.

## CLI Deployment

If you prefer the Vercel CLI, run it from the repository root and link one Vercel project at a time:

```bash
vercel link --repo
vercel --prod

vercel link
vercel --prod

vercel link
vercel --prod
```

For each `vercel link` run, select the Vercel project that corresponds to one app root directory. Add the same environment variables in the Vercel dashboard or with `vercel env add`.

## Verified Local Builds

These production builds should pass before deploying:

```bash
pnpm --filter nextjs-nft-viewer build
pnpm --filter nextjs-token-swap build
pnpm --filter react-solana-transaction-history build
```
