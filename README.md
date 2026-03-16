# Ragnar Solana Token Launcher

React + Vite Solana token launcher with Phantom wallet support, SPL token minting, authority revoke options, and an in-app launch tutorial.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## Vercel deployment

This project is configured for Vercel with [vercel.json](vercel.json).

- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`

## Important notes

- The site charges no platform fee.
- Solana mainnet is not free: wallet signatures, account creation, and rent still cost SOL.
- Devnet is for testing only.
- A minted token does not automatically appear on Dexscreener. It usually needs a supported mainnet liquidity pool and indexing.
