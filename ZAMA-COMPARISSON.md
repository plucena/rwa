# COTI vs Zama: the two confidential ERC-3643s

A short decision brief. Both implementations exist, both run on a testnet, and the difference
between them is decidable from evidence. Sources: [`Private_RWAs.md` Addendum VIII](Private_RWAs.md#addendum-viii-the-two-confidential-erc-3643s-side-by-side),
[`coti_rwa.md`](coti_rwa.md), [`workplan.md` B7](workplan.md).

## The evidence is asymmetric, and that colours everything below

|  | COTI | Zama |
| --- | --- | --- |
| Source | Published — [`repos/private-ERC-3643-coti-port/`](repos/private-ERC-3643-coti-port/) | `github.com/tokeny/confidential-token` → **404** |
| Verification | 60 tests against a live node; nine contracts source-verified on cotiscan, full bytecode match | None possible |
| What we actually read | The code and the deployed contracts | A **57-function ABI** pulled from the front-end bundle, plus RPC probes |

Everything asserted about Zama is **ABI-level and behavioural**. Signatures and types are exact;
semantics are inferred. Re-derive from source if Tokeny ever publishes.

## The architectural split

**COTI encrypts in place.** `PrivateToken` *is* the ERC-3643 token. Balances are `ctUint256`,
compliance evaluates on ciphertext inside the transfer, and there is one token.

**Zama wraps.** An ERC-7984 confidential token takes `constructor(IToken erc3643Token_)`, holds the
T-REX token and issues a parallel encrypted balance. Two tokens, with a `wrap`/`unwrap` boundary.

---

## Advantages of the COTI implementation

1. **The rulebook evaluates under encryption.** `canTransfer` runs inside the transfer against an
   encrypted shadow ledger. The wrapper has **no `canTransfer` and no `getModules`** — it gates on
   `isUserAllowed` and a `blockUser` restriction list. The six amount-reading modules, the four
   rolling accumulators and the fee-derived nested transfer live on the *underlying* token, so a
   confidential transfer between two wrapped holders never touches them. **This is the whole thesis,
   and it is the only defensible technical argument the track has.**
2. **256-bit against 64-bit.** COTI uses `ctUint256`; Zama uses `euint64` for every balance,
   transfer, freeze and supply figure. A 64-bit ceiling is ~1.8 × 10¹⁹ units — at 8 decimals that is
   ~184 billion tokens (fine); at **18 decimals it is ~18.4 tokens** (not fine). The underlying
   ERC-3643 token is `uint256`, so the wrapper cannot represent the full range of what it wraps, and
   carries a `rate()` to scale between them.
3. **A much shorter dependency surface.** A COTI confidential transfer involves the COTI chain and
   the on-chain `MpcCore` precompile. A Zama one involves the host chain, an ACL contract, an
   off-chain **relayer**, a separate **gateway chain** (`10901`) and a **KMS** — five moving parts
   under at least two operators, with Zama testnet infrastructure in the live path. *"What has to be
   running for my register to work, and who runs it"* is asked in every institutional diligence
   process, and COTI's answer is materially shorter.
4. **Synchronous decrypt.** `MpcCore.decrypt` returns in-transaction; balance reads decrypt locally
   from an AES key derived from one wallet signature. Zama needs a gateway round trip
   (`requestDiscloseEncryptedAmount` → `finalizeUnwrap`) and the Relayer SDK (`userDecrypt`, EIP-712,
   generated keypair) for a balance read.
5. **It is auditable at all.** Published, tested, bytecode-verified. Zama's is a 404.
6. **No wrap boundary to manage.** One token, one balance, no 1:1 shadow position and no class of
   bugs from the two drifting apart.
7. **Blocked transfers disclose nothing.** A failed transfer moves an encrypted zero rather than
   reverting, closing the revert side-channel. Verified by test on COTI; unknown on the wrapper.

## Disadvantages of the COTI implementation

1. **No regulator disclosure path.** Zama has `requestDiscloseEncryptedAmount` → `AmountDisclosed`
   with a verifiable `decryptionProof`. COTI has nothing, and
   [`coti_rwa.md` §11 item 4](coti_rwa.md#11-what-is-missing) flags this as the load-bearing gap —
   it depends on a COTI capability (one computation emitting a result encrypted under sender,
   receiver **and** an audit key) that **has not been confirmed**. This is the only item on this
   list that is research rather than engineering.
2. **Agent seizure does not work.** `forcedTransfer` takes a `gtUint256` no caller can construct —
   four entry points are unreachable. Zama's `forceConfidentialTransferFrom(from, to, euint64)`
   works on ciphertext. Worse, `gtUint256` is invisible in an ABI, so those four functions are
   **ABI-identical and semantically incompatible** with upstream T-REX: tooling encodes a plaintext
   amount and the contract reads it as a handle. A missing function fails loudly; this does not.
3. **Identity is a mock.** `MockPrivateIdentityRegistry` with a `setVerified` switch, against Zama
   reading the real underlying registry via `getIdentityRegistry()` / `isUserAllowed()`.
4. **No standards conformance.** Bespoke interface, no ERC-165. Zama ships ERC-7984 plus
   `supportsInterface`, `multicall` and an operator model — an issuer's integrators can code against
   a published standard rather than one vendor's interface.
5. **One compliance module of eleven.** Only `MaxBalance`, and with no `addModule`/`getModules` a
   second rule means a *new contract*, not a bound module. Ten modules unported, including the four
   rolling accumulators and `TransferFees`.
6. **No factory integration, no holder counting.** `TREXFactory` and `TREXGateway` know nothing
   about `PrivateToken`; every deployment is manual. Issuers deploy through the factory.
7. **The commercial position is behind, not just the code.** Zama has been the **default
   confidentiality layer of the T-REX Ledger since 24 March 2026**, sits on the ERC-3643 Association
   beside DTCC, Deloitte, Tokeny and OpenZeppelin, and ships a 1:1 wrap path advertised as *"no
   migration friction"*. COTI is not a member. The wrapper runs on InGen (chain `364301`), producing
   blocks since April 2026.

Items 2–6 are ordinary engineering. Item 1 is not, and item 7 is not engineering at all.

## What is *not* a differentiator either way

- **Both are testnet.** COTI on `7082400`; Zama on InGen against Zama's *testnet* gateway and
  relayer. Neither should be described as production.
- **Neither protects the acquisition.** `wrap(address to, uint256 amount)` takes a plaintext amount,
  exactly as COTI's `RwaSubscription` discloses the stablecoin leg and the minted amount. Both
  protect the holding, not the purchase. That is a property of the class.
- **Neither gives anonymity.** Addresses, timing and counterparties stay visible on both.
- **Both need an async decrypt round trip somewhere**, for the same reason: a public underlying
  supply means someone has to learn the real amount. FHE or MPC, everyone arrives at the same place.

## Bottom line

COTI is **not technically behind** — it is ahead on encrypted width, on evaluating the rulebook under
encryption, and on being auditable at all. It **is** behind on what an issuer asks for second:
seizure, disclosure, real identity, and a standard to integrate against.

The one argument that survives is narrow and real: **if an issuer binds amount-dependent compliance
modules and expects them to bind every transfer, a wrapper does not deliver that and encrypt-in-place
does.** It is worth exactly as much as the number of issuers for whom it is true — and that is
answerable in one free call. Read `getModules()` on the target issuer's compliance contract. **If it
returns `[]`, the argument is worth nothing and the track should close.** Both SkyBridge funds
return `[]`.
