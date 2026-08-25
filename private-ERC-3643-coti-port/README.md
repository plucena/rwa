# Soda Labs' private ERC-3643, ported to COTI `MpcCore`

Phases **B0**, **B2**, **B3**, **B4** and **B6** (deploy + tests) of [`../../workplan.md`](../../workplan.md).

**B0 — can COTI's published MPC library replace the `bubble/` library Soda does not publish?** Yes.

**B2 — can Soda's `permit` ACL be translated to COTI's `offBoard` model?** Yes, and it is done.
All **61 permit call sites are gone**, `tree/contracts/bubble/MpcCore.sol` is **byte-identical to
[`coti-io/coti-contracts`](https://github.com/coti-io/coti-contracts/tree/main/contracts/utils/mpc)**
— no stubs, no local edits — and the tree compiles:

```
Compiled 22 Solidity files successfully (evm target: paris)
PrivateToken: 22,309 bytes deployed
```

(20 files at B2; the demo's `AccountOnboard` and `RwaSubscription` bring it to 22.)

`tree/` holds the port, minus `node_modules` and build output.

## Status: deployed and executing on COTI testnet

There are **two independent deployments** on chain `7082400`. Read the next two sections together
before verifying anything — they are easy to confuse, and only the second one backs the website.

### 1. The B6 proof deploy — `tree/deployments/coti-testnet.json`

Deployed 9 August 2026. A single `pTREX` token, used to prove the port executes. **Nothing consumes
this stack**; it is kept because the mint evidence below refers to it.

| Contract | Address |
| -------- | ------- |
| `PrivateToken` | `0xa885398494fB02916C1AeC8Bd31DD7d1a0694Bd7` |
| `MaxBalancePrivateCompliance` | `0xc3b5F4eFe6954EC39598D83b5Ea033273eefB917` |
| `MockPrivateIdentityRegistry` | `0x05f99994eF7E27792C36353065A6E12Ba9f2bEF7` |

A mint of 1,000 pTREX (tx `0x5c5d34ae…`, 823,651 gas) proved three things a compiler could not:
`MintRequested` and `MintFinalized` fired in the **same transaction**, so the synchronous decrypt
shim replaces Soda's off-chain relayer; the public `totalSupply` reconciled to exactly
`100000000000`; and decrypting `balanceOf` with the holder's AES key returns **1000**, so the eager
`offBoardToUser` copy is genuinely readable by its owner.

**`evmVersion` must be `paris`.** COTI rejects Shanghai `PUSH0`. This tree compiled for `cancun`
through B0–B2 and would never have deployed — compiling is not deploying.

### 2. The RWA demo stack — `tree/deployments/rwa-demo.json`

**This is what <https://rwa.demo.coti.io> talks to.** Deployed 10 August 2026 by
`scripts/deploy-rwa-demo.ts`: two funds, each with its own registry, compliance module and
`PrivateToken`, plus an `RwaSubscription` priced in testnet USDC and USDT, and one shared
`AccountOnboard`. The frontend reads this file directly — `rwa/app/src/data/deployment.json` is a
copy of it, and the two must stay identical or the site points at the wrong contracts.

| | JTRSY — Janus Henderson Treasury Fund | JAAA — Janus Henderson AAA CLO Fund |
| -- | -- | -- |
| `PrivateToken` | `0x6D7cf587dbF68eb233B7BEd1f45BDfB6aE31Baf3` | `0x20b2C3cc4F7b4a5f727b1aa69779aD9C20036732` |
| `MockPrivateIdentityRegistry` | `0x9Da490afb22cEb1B8aA82d2EC4418BB4A62e5F37` | `0xC64DC85109E823380ea4DE34b6ac1B22a02Ba23E` |
| `MaxBalancePrivateCompliance` | `0xB5d2e8880005dCF84f13Fc58626d7F67734E28CB` | `0x2abfd1194120fb2BDc2D3Fd8366C2979c7aea531` |
| `RwaSubscription` | `0x5cf23F0cf6369477d1F267e5f9F281C3e6B8A98f` | `0x0A1089dc8b71E463c3AD89363058B5a07A7f1bf9` |

`AccountOnboard` is `0x686035856C60D73843C839ad50eDC6c40385C825`. It is recorded for completeness
but the frontend does **not** read it — onboarding is owned by the COTI wallet plugin, which ships
its own contract. Payment tokens are the pre-existing testnet `USDC.e`
(`0x63f3D2Cc8F5608F57ce6E5Aa3590A2Beb428D19C`) and `USDT`
(`0x9e961430053cd5AbB3b060544cEcCec848693Cf0`), both 6dp; shares are 8dp.

Verified against chain on 25 August 2026 by `eth_getCode`: seven of the nine contracts are
**byte-identical** to the artifacts this tree compiles, metadata hash included. The two
`RwaSubscription` copies differ at exactly two 20-byte runs — offsets 155 and 522, the
`immutable token` slot, which the constructor fills with each fund's own token address — and in
their metadata hash, because a comment in `RwaSubscription.sol` was edited after deployment. The
executable body is bit-identical across that edit, so the deployed code is this source. Anything
beyond those two runs would mean the chain and the tree have genuinely diverged.

On-chain state matches the JSON for both funds: name, symbol, 8 decimals, `identityRegistry`,
`compliance`, `subscription.token()`, and `priceOf()` for both payment tokens; both tokens are
unpaused and both subscriptions are agents of their token.

What is still **not** done:

- **The ten unported compliance modules** remain the main gap.
- **`forcedTransfer`, `batchForcedTransfer` and batch freeze/unfreeze take `gtUint256`** and are
  therefore **uncallable from outside on COTI** — a garbled handle cannot survive a transaction
  boundary. They need `itUint256` parameters. Two tests pin the behaviour.
- Soda's two suites have been **rewritten against the ct model** rather than repointed — theirs
  assumed durable `gtUint256` handles in storage, which this port removed. Every original test
  intent is preserved, including four that assert the `gtUint256` entry points are unreachable.
- **Nothing is audited**, and 823k gas for one mint is a data point, not a cost model.
- **Bytecode headroom is thin** — 22,309 of 24,576 bytes under Paris, ~2.3 KB left. Phase B5 adds
  six compliance modules; some will need library extraction.

## Scripts

```sh
cd tree && npm install

# The RWA demo stack the website uses. Rewrites deployments/rwa-demo.json; after running it,
# copy that file to rwa/app/src/data/deployment.json or the site keeps the old addresses.
npx hardhat run scripts/deploy-rwa-demo.ts        --config hardhat.private.config.ts --network coti-testnet

# The B6 proof deploy. verify-deployment.ts reads deployments/coti-testnet.json and so checks
# only that stack — it does not look at the demo contracts.
npx hardhat run scripts/deploy-private-token.ts   --config hardhat.private.config.ts --network coti-testnet
npx hardhat run scripts/verify-deployment.ts      --config hardhat.private.config.ts --network coti-testnet
npx hardhat run scripts/decrypt-balance.ts        --config hardhat.private.config.ts --network coti-testnet

# 60 passing, against live testnet
npx hardhat test test/token/private-token-coti.tests.ts                    --config hardhat.private.config.ts --network coti-testnet
npx hardhat test test/token/private-token-coti-allowances.tests.ts         --config hardhat.private.config.ts --network coti-testnet
npx hardhat test test/token/private-token-transfer.tests.ts                --config hardhat.private.config.ts --network coti-testnet
npx hardhat test test/token/private-token-max-balance-compliance.tests.ts  --config hardhat.private.config.ts --network coti-testnet
```

`testnet.coti.io` currently 502s on roughly half of all requests. Run the retrying proxy first or
no run will finish:

```sh
node scripts/rpc-retry-proxy.js &
COTI_TESTNET_RPC_URL=http://127.0.0.1:8545 npx hardhat test ... --network coti-testnet
```

Tests need `PRIVATE_KEY2` as a second funded signer. Two gotchas cost real time and are worth
knowing before writing any COTI client: **encrypted inputs are signed with a raw ECDSA signature
over the digest, serialised `r || s || (v − 27)`** — not `personal_sign`, and `v` is 0/1 — and
**COTI testnet returns no revert data**, so `revertedWith` misreports a reverting transaction as
succeeding. Assert failure, not reason.

Credentials are read from the research-root `.env` (`PRIVATE_KEY`, `PRIVATE_AES_KEY_TESTNET`); the
config falls back to it so secrets never sit inside this tree. Deploying to `coti-mainnet` requires
`ALLOW_MAINNET=true`.

## How the ACL was translated

Soda's `permit` is enforced *by the MPC layer*: a handle carries its own reader list. COTI has no
such list — **a ciphertext has exactly one reader, fixed when it is written.** So the ACL became
ordinary Solidity, and the encryption target became a consequence of it.

| Soda | Count | Became |
| ---- | ----- | ------ |
| `permitThis(v)` | 23 | `MpcCore.offBoard(v)` — the contract copy |
| `permit(v, addr)` | 27 | `MpcCore.offBoardToUser(v, addr)` — that reader's copy |
| `permitTransient(v, addr)` | 10 | **Deleted.** `gt` values already cross contracts within a transaction |
| `isSenderPermitted(v)` | 1 | **Deleted.** `validateCiphertext` carries a signature, so the binding is intrinsic |

Values are written **eagerly** wherever the reader is known and bounded, and **on demand** only for
the agent role, which is unbounded. See the B2 design note in the workplan for why on-demand is not
the default: it converts every read into an on-chain record of who read whose position.

| Value | Readers | Strategy |
| ----- | ------- | -------- |
| Balances | contract + holder | Eager `utUint256` |
| Allowances | contract + owner + spender | Eager three-ciphertext `PrivateAllowance` |
| Transferred amount | contract + sender + receiver | Eager, emitted as two ciphertexts |
| Frozen tokens | contract + holder + **agents** | Eager for the holder; agents call `reencryptFrozenTokens` |
| Key rotation | — | `setAccountEncryptionAddress`, the repair path |

## Behavioural changes a reviewer must not miss

1. **Events carry ciphertexts, not handles.** `Transfer` and `Approval` now emit one ciphertext per
   party (`_fromValue` / `_toValue`, `_ownerValue` / `_spenderValue`), mirroring COTI's
   `PrivateERC20`. A `gtUint256` in a log is meaningless once the transaction ends. **Any indexer
   reading amounts from logs must change.**
2. **`balanceOf`, `allowance` and `getFrozenTokens` return `ctUint256`,** the caller's copy, to be
   decrypted off-chain. They are `view` again.
3. **The `recoveryAddress` guard was repaired.** Soda compared a stored handle against its canonical
   zero handle — a pointer comparison that only worked because that handle was stable storage. Under
   COTI two fresh handles are always unequal, so a literal port would have made the check *always
   pass*. It now tests whether the balance slot was ever written. A true "balance is non-zero" test
   is not available without decrypting, on either system.
4. **Storage layout changed** — `_balances` and `_frozenTokens` are `utUint256`, `_allowances` is a
   three-ciphertext struct, and two mappings were added. `__gap` dropped 45 → 43 to compensate.
   This contract is upgradeable; **the layout is not compatible with a deployed Soda instance.**

## Changes made to the upstream work

Required by GPL-3.0 §5(a), and worth reading regardless.

| # | File | Change |
| - | ---- | ------ |
| 1 | `contracts/bubble/MpcCore.sol` | **Added**, unmodified, from `coti-io/coti-contracts` @ `6fbdce0` |
| 2 | `contracts/bubble/MpcInterface.sol` | **Added**, unmodified, same commit |
| 3 | `contracts/bubble/DecryptionCaller.sol` | **Written here.** Synchronous stand-in for Soda's async decrypt oracle, over `MpcCore.decrypt` — phase B4 arriving early |
| 4 | `contracts/token/PrivateTokenStorage.sol` | Storage moved from `gtUint256` handles to `utUint256` / `ctUint256`; `PrivateAllowance` added; reader and encryption-address mappings added; `__gap` 45 → 43 |
| 5 | `contracts/token/PrivateToken.sol` | 61 permit sites translated; ciphertext helpers added; `reencryptFrozenTokens`, `frozenTokensFor` and `setAccountEncryptionAddress` added; getters return ciphertexts; `recoveryAddress` guard repaired |
| 6 | `contracts/token/IPrivateToken.sol` | Event and getter signatures moved from `gtUint256` to `ctUint256` |
| 7 | `contracts-private/MaxBalancePrivateCompliance.sol` | Shadow ledger moved to `ctUint256`; permits removed |
| 8 | `contracts-private/PrivateTokenTestMocks.sol` | Permits removed |
| 9 | `hardhat.private.config.ts` | `viaIR: true`; solc `0.8.24` → `0.8.25`; **`evmVersion` cancun → paris** (COTI rejects `PUSH0`); `coti-testnet` / `coti-mainnet` networks; `.env` fallback to the research root |
| 10 | `.gitignore` | `contracts/bubble/` un-ignored — upstream excludes it because their library is unpublished; here it holds the COTI library |
| 11 | `scripts/deploy-private-token.ts`, `verify-deployment.ts`, `decrypt-balance.ts` | **Added.** Deployment and on-chain verification for COTI |
| 12 | `test/token/helpers/cotiCrypto.ts`, `test/token/private-token-coti.tests.ts`, `private-token-coti-allowances.tests.ts` | **Added.** COTI-native crypto and account onboarding replacing the bubble proxy, plus 23 tests passing against testnet |
| 13 | `contracts-private/AccountOnboard.sol`, `scripts/rpc-retry-proxy.js` | **Added.** COTI's onboarding contract vendored so fixtures can deploy it, and a retrying RPC proxy that works around testnet 502s |

Upstream is [soda-mpc/private-ERC-3643](https://github.com/soda-mpc/private-ERC-3643) @ `c1db386`
(10 April 2026), itself a fork of `ERC-3643/ERC-3643` v4.1.3. **GPL-3.0**, and `tree/LICENSE.md` is
preserved — anything COTI ships derived from this stays GPL-3.0.

## Building it

```sh
cd tree
npm install
npx hardhat compile --config hardhat.private.config.ts
```

## Remaining caveats on the toolchain

- **solc 0.8.25, not 0.8.24.** 0.8.24 could not be fetched in the test environment. Both satisfy the
  `^0.8.24` and `^0.8.20` pragmas, but a real port should pin what upstream pins.
- **`viaIR: true`** changes the optimiser pipeline and needs its own gas and audit review.
