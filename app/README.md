# COTI RWA — demo frontend

A React UI for the confidential ERC-3643 token deployed on COTI testnet. Built to the mockups in
[`../`](../): `dashboard.png`, `rwa_detail.png`, `rwa_transfer.png`.

## What it does

- **Lists tokenized funds** — the Centrifuge-style roster from the research (JTRSY, JAAA, ACRDX,
  SPXA, HYB), with `Investors only` and `Seeding soon` states as in the mockup. Funds actually
  deployed on COTI carry a **Live on COTI** badge.
- **Unlocks private access** — the [COTI wallet plugin](https://www.npmjs.com/package/@coti-io/coti-wallet-plugin)
  derives the account's AES key from a wallet signature and holds it for the session. No private
  key is ever handled by this app.
- **Subscribes to a fund** — approve USDC/USDT, then `RwaSubscription.subscribe`, which mints
  encrypted shares to the buyer. Registers ERC-3643 eligibility first if needed.
- **Shows a confidential holding** — `balanceOf` returns a `ctUint256`, decrypted in the browser
  with the account's key. Without a key the figure renders blurred rather than absent, which is the
  honest depiction: the value exists on-chain and is unreadable.

## Running it

```sh
npm install
npm run dev     # http://localhost:5173
```

Requires MetaMask on **COTI Testnet** (chain `7082400`); the app offers to add the network.

## Contracts

Addresses live in [`src/data/deployment.json`](src/data/deployment.json), written by
`scripts/deploy-rwa-demo.ts` in the contract repo. Re-deploy and copy the file to point the UI
somewhere else.

| | |
| --- | --- |
| Payment tokens | USDC.e `0x63f3D2Cc…D19C`, USDT `0x9e961430…3Cf0` — both 6 decimals |
| Fund shares | 8 decimals, price quoted in payment-token units per `1e8` shares |

## Stack

`@coti-io/coti-wallet-plugin` provides the wagmi + RainbowKit providers, the COTI testnet chain
definition, the private-access unlock flow (`usePrivateUnlock`) and confidential balance reads
(`usePrivateTokenBalance`). Contract calls go through viem via wagmi. Mounted the same way as the
[hrpayroll demo](../../../coti-demos/hrpayroll): `configureCotiPlugin` once, then
`WagmiRainbowKitProvider` → `PrivacyBridgeProvider`.

Set `VITE_WALLETCONNECT_PROJECT_ID` for WalletConnect; injected wallets work without it.

## One honest limitation

**Subscriptions are not confidential; balances are.** USDC and USDT on COTI testnet are ordinary
ERC-20s with public amounts, and the share price is public, so a subscription discloses its own size.
Confidentiality begins at the first transfer. The UI states this on the invest panel rather than
implying otherwise — closing it needs a confidential payment token or off-chain settlement.
