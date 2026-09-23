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

## Architecture: wagmi, viem and submitting transactions

No component talks to a node. wagmi owns the connection and hands out two viem clients — a
**public client** for reads and a **wallet client** for writes — and every call to either lives in a
hook under `src/lib/`. Components hold UI state and nothing else.

### The files

| File | Role |
| --- | --- |
| `src/providers/AppProviders.tsx` | Calls `configureCotiPlugin` once in the browser (WalletConnect id, `defaultNetworkId`, and the callbacks that store the encrypted AES backup in `localStorage`), then mounts `WagmiRainbowKitProvider` → `PrivacyBridgeProvider`. The tree is withheld until the first effect runs, since the plugin and the injected provider both touch browser globals. |
| `src/lib/contracts.ts` | The one place addresses and ABIs are declared: `DEPLOYMENT` from `deployment.json`, `COTI_TESTNET` (chain id, name, explorer), `SHARE_DECIMALS` / `SHARE_BITS`, the `Pay` type with `PAYMENT_TOKENS`, four ABIs built with viem's `parseAbi` (`PRIVATE_TOKEN_ABI`, `SUBSCRIPTION_ABI`, `REGISTRY_ABI`, `ERC20_ABI`), and the explorer link helpers. |
| `src/lib/useWallet.ts` | Wallet and session state as one `WalletState`: wagmi's `useAccount` / `useChainId` / `useSwitchChain`, RainbowKit's connect and account modals, and the plugin's `usePrivateUnlock` / `usePrivacyBridgeUnlock` for the AES session key. Exposes `address`, `chainId`, `aesKey`, `onCorrectChain` and the `connect` / `switchNetwork` / `onboard` / `lock` actions. |
| `src/lib/useFundContracts.ts` | Every chain read and write. `useInvest(fund, wallet, pay)` returns the payment-token balance and the `subscribe` flow; `useHolding(fund, wallet)` returns the public total supply and the decrypted share balance. |
| `src/data/deployment.json` | Fund and payment-token addresses, written by `scripts/deploy-rwa-demo.ts` in the contract repo. |
| `src/data/funds.ts` | The fund catalogue for the UI; attaches the deployed addresses to JTRSY and JAAA, and leaves the rest without a `contracts` field, which is what puts them in the "not yet available" state. |
| `src/components/*` | `InvestPanel` (tab, amount, busy, error), `FundDetail`, `OnboardModal`, `Dashboard`, `Header`. None of them import viem or an ABI. |

### Submitting a subscription

```mermaid
sequenceDiagram
    autonumber
    participant UI as InvestPanel
    participant Hook as useInvest.subscribe
    participant WC as viem wallet client
    participant Wallet as MetaMask
    participant PC as viem public client
    participant Chain as COTI testnet

    UI->>Hook: subscribe(parseUnits(amount, decimals), setBusy)
    opt not yet eligible
        Hook->>WC: writeContract setVerified on the registry
        WC->>Wallet: request signature
        Wallet-->>WC: tx hash
        Hook->>PC: waitForTransactionReceipt
        PC-->>Hook: mined
    end
    Hook->>PC: readContract allowance
    opt allowance below the amount
        Note over Hook: reset to 0 first if a non-zero allowance exists
        Hook->>WC: writeContract approve
        WC->>Wallet: request signature
        Wallet-->>WC: tx hash
        Hook->>PC: waitForTransactionReceipt
        Hook->>PC: re-read allowance, throw if still short
    end
    Hook->>WC: writeContract subscribe, gas 8000000
    WC->>Wallet: request signature
    Wallet-->>WC: tx hash
    Hook->>PC: waitForTransactionReceipt
    PC->>Chain: RwaSubscription.subscribe pulls payment, mints encrypted shares
    Hook->>PC: refresh balance and eligibility
    Hook-->>UI: tx hash
    Note over UI: shows the explorer link, and FundDetail reloads the holding
```

Each write returns as soon as the user signs; waiting for the receipt is a separate public-client
call. `subscribe` reports progress through an `onStep` callback, which is how the button text moves
from "Registering eligibility…" to "Approving USDC…" to "Subscribing…" without the hook knowing
anything about the UI.

### Where wagmi ends and viem begins

- **wagmi** owns connection state and hands over the clients: `usePublicClient()` for reads,
  `useWalletClient()` for writes through the injected provider.
- **viem** does the encoding: the `parseAbi` ABIs give `readContract` and `writeContract` their
  types, so `totalSupply` is known to return a `bigint` at compile time, and `parseUnits` /
  `formatUnits` convert between base units and what the user types.
- **The wallet plugin** owns everything COTI-specific: the chain definition and RPC, the unlock that
  derives the session AES key from a signature, and `fetchPrivateBalance`, which reads the
  `ctUint256` and decrypts it locally. Confidential reads therefore do **not** go through viem.

### Details worth knowing before changing this

- **`account` and `chain: null` on every write.** The account is passed explicitly and viem's chain
  assertion is switched off, because network switching belongs to the plugin. The UI gates on
  `wallet.onCorrectChain` instead, and offers a "Switch to COTI Testnet" button.
- **`gas: 8_000_000n` on `subscribe`.** Minting an encrypted balance runs garbled-circuit MPC and
  costs far more than an ordinary ERC-20 mint, and estimation against the testnet RPC is unreliable.
- **Approval hygiene.** A failed allowance read returns `0n`, never `undefined`: `undefined < value`
  is `false` in JS, which would silently skip approving and revert inside the token instead. The
  allowance is re-read after approving, and a non-zero allowance is reset to zero first, since some
  ERC-20s reject a non-zero-to-non-zero change.
- **Self-registration is a demo affordance.** `registry.setVerified` is callable by anyone here; a
  real ERC-3643 deployment issues an ONCHAINID claim from a trusted issuer.
- **Failed reads keep the previous value.** The testnet RPC drops requests, so read paths swallow
  errors rather than blanking the UI.

### Adding a contract call

1. Add the signature to the right ABI in `contracts.ts`, or a new `parseAbi` block for a new
   contract. Addresses come from `deployment.json`; don't hardcode them in a component.
2. Add a read or a write to `useFundContracts.ts`. Reads are a `useCallback` plus a `useEffect`;
   writes take an `onStep` callback and resolve with the transaction hash.
3. Call it from a component, which keeps only UI state.

### Configuration

| What | Where |
| --- | --- |
| WalletConnect project id | `VITE_WALLETCONNECT_PROJECT_ID`; injected wallets work without it |
| Chain and RPC | Chain `7082400`; the plugin's `cotiTestnet` definition owns the RPC URL |
| Contract addresses | `src/data/deployment.json`, regenerated by the deploy script |
| Session key backup | `localStorage`, under `coti-rwa:aes-backup:<chainId>:<address>` |
| Dev server | Port 5173, set in `vite.config.ts` |

## Suggestions: a server-side transaction worker on AWS

Nothing below is built. It sketches how the platform's *own* transactions — agent operations such
as registry updates, price changes, redemptions or mints — could be executed by a TypeScript worker
on AWS. Investor subscriptions stay where they are: signed in the browser by the investor's own
wallet. A worker must never hold an investor's key.

### The part that is not like other chains

A worker on Ethereum signs one thing, the transaction. On COTI it signs **two**, and only the first
is standard:

1. **The transaction**, secp256k1 over the transaction digest, as anywhere else.
2. **Each encrypted input** (`itUint`). The value is AES-encrypted with the *sender's* key, and the
   ciphertext is signed as `keccak256(sender, contract, selector, ciphertext)` — a raw ECDSA sign of
   that digest, serialised as `r || s || (v - 27)`. Not `personal_sign`, and `v` is 0/1 rather than
   27/28.

Two consequences worth designing around:

- Both signatures are raw-digest ECDSA, so **one KMS-backed signer covers both**. KMS signs a digest
  when called with `MessageType: DIGEST`, and in both cases you recover `v` yourself by trying both
  recovery ids, since KMS doesn't return it.
- Because an input is bound to sender, contract and selector but carries no nonce or expiry, a
  **fee-bumped resend with identical calldata stays valid**. The reconciler can bump and rebroadcast
  without rebuilding or re-encrypting anything.

The reference implementation already exists in this repo:
[`private-ERC-3643-coti-port/tree/test/token/helpers/cotiCrypto.ts`](../private-ERC-3643-coti-port/tree/test/token/helpers/cotiCrypto.ts)
does the encryption, the input signing and the onboarding against `node-forge` directly. Port it,
swapping its `SigningKey.signDigest` for a KMS call.

### Library choices

| Option | Fits | Watch out for |
| --- | --- | --- |
| **viem + a custom account** (suggested) | Public calls and transaction signing. Same library, and the same `parseAbi` ABIs, as this UI. | You supply the account yourself; viem only asks for `signTransaction` and friends. |
| ethers v6 + a KMS signer package | Parity with the contract repo's deploy scripts, which use ethers through Hardhat. | Another library in the stack for no gain if the rest is viem. |
| `@coti-io/coti-ethers` | The browser, which is what it targets. | Its input-signing path uses `signMessage` **because MetaMask cannot raw-sign**. Server-side you can raw-sign, so this is the wrong shape for a worker. |
| `@coti-io/coti-sdk-typescript` | Encryption and onboarding primitives without the wallet layer. | Check what it expects to hold in memory; the AES key belongs in Secrets Manager, not in a long-lived global. |

A KMS-backed account for viem is small — the whole COTI-specific part is recovering `v`:

```ts
// sketch: one signer for both transaction and itUint digests
const account = toAccount({
  address: signerAddress,
  async signTransaction(tx) {
    const digest = keccak256(serializeTransaction(tx));
    return serializeTransaction(tx, await signDigestWithKms(digest)); // {r, s, v}
  },
  // ...signMessage / signTypedData as needed
});
```

`signDigestWithKms` calls `kms:Sign` with `MessageType: DIGEST`, parses the DER answer into `r` and
`s`, normalises `s` to the lower half of the curve order for EIP-2, then picks the recovery id whose
recovered address equals the signer's. That same helper signs `itUint` digests.

### Where the AES key comes from

The worker's account needs its own COTI AES key before it can build encrypted inputs or read its own
encrypted balances. Onboard the account once through `AccountOnboard` — the key is the XOR of the two
shares the onboarding event returns — and keep the result in **Secrets Manager**, cached in memory
for the life of the container and never logged. It is a 16-byte key tied to that one account: a new
signer means a new onboarding, and rotation means onboarding a fresh account, granting it the agent
role onchain, then revoking the old one.

### Runtime shape

| Piece | Suggestion |
| --- | --- |
| Queue | SQS FIFO, `MessageGroupId` = signer address, so one nonce lane is serialised for you |
| Submitter | A Lambda per message group, signing and broadcasting one transaction, never waiting for confirmations |
| Reconciler | A second Lambda on an EventBridge schedule, polling receipts and bumping fees |
| State | Postgres or DynamoDB: the intent row, its status, the signed bytes and hash |
| Bundling | esbuild (CDK's `NodejsFunction`, SAM or SST). viem tree-shakes well; `node-forge` and friends are the weight to watch |
| Infra | CDK in TypeScript, so infra and worker share one language and one set of types |

The full lifecycle argument — nonce lanes, stuck transactions, idempotency keys, DLQ alarms — is
written up in the API repo's README rather than duplicated here.

### Sharing the ABIs

`src/lib/contracts.ts` is plain TypeScript with no browser dependency: `parseAbi` definitions,
addresses from `deployment.json`, and nothing else. A worker should import or vendor that same file
rather than restate any ABI, which is how the Express API consumes it today. One definition, one
place to change after a redeploy.

### Testing

Keep the signer behind an interface so unit tests can stub it, and assert on the calldata that comes
out of `encodeFunctionData` rather than on a live chain. MPC operations exist only on COTI, so
anything touching encrypted values needs an integration test against testnet with a funded, onboarded
account, exactly as the contract repo's private tests do. The testnet RPC drops requests, so give the
worker the same retry treatment the rest of this project uses.

### A reasonable first cut

One signer key, one FIFO queue, one submitter Lambda, one reconciler on a one-minute schedule, the
ported `cotiCrypto` helpers behind a `signDigestWithKms` function, and the AES key in Secrets
Manager. Add lanes, Step Functions or Fargate only when something concrete demands them.

## One honest limitation

**Subscriptions are not confidential; balances are.** USDC and USDT on COTI testnet are ordinary
ERC-20s with public amounts, and the share price is public, so a subscription discloses its own size.
Confidentiality begins at the first transfer. The UI states this on the invest panel rather than
implying otherwise — closing it needs a confidential payment token or off-chain settlement.
