# This implementation, measured against Kinexys Project EPIC

[Project EPIC](JPMC-Kinexys-Project-Epic-Whitepaper-2024.pdf) — *Fueling Tokenized
Finance with On-Chain Enterprise Privacy, Identity, and Composability*, Kinexys by
J.P. Morgan, 2024 — set out privacy requirements for tokenized funds and invited five
platforms to implement them as proofs of concept. Its evaluation matrix (pp. 33–34) is a
useful external yardstick because it was written by a prospective institutional *buyer*,
not by a privacy vendor.

This document scores the stack in this repository against that matrix. It is a
self-assessment, not a Kinexys evaluation.

**COTI was not one of the five platforms EPIC evaluated** — those were Zama's fhEVM,
PADL (J.P. Morgan's own research team), Avacy, Rayls and Fhenix. Nothing here claims a
Kinexys result. Where the matrix records what those five achieved, this document makes no
comparison: the checkmark values are rendered as graphics in the PDF and were not read.

Assessed against the working tree and COTI testnet on 20 September 2026. Read
[`MPC-CONFIDENTAL-IMPLEMENTATION.md`](MPC-CONFIDENTAL-IMPLEMENTATION.md) first — every finding below is
evidenced there or in the contracts.

---

## Scorecard

Two questions, deliberately kept apart. **Status** is what runs today. **Blocker** is why
not — and whether finishing it is a matter of work, of architecture, or of something the
privacy technology cannot do at all.

| # | EPIC capability | Status today | Blocker | What is actually in the way |
| --- | --- | --- | --- | --- |
| 1 | Confidential ownership balance | ✅ **Built** | — | — |
| 2 | Confidential transaction value | ◐ **Partial** | 🔧 Engineering | Issuance settles in a public ERC-20; a confidential one already exists unused |
| 3 | Confidential transaction type | **TBD** | 🏗 Architecture | Needs uniform dispatch with every branch executed; cost scales with operation count |
| 4 | Confidential token type | **TBD** | 🏗 Architecture | Needs one multi-fund contract; cost scales with fund count |
| 5 | Confidential bids | **TBD** | 🔧 Engineering | No auction exists. The MPC primitives for a sealed-bid one do |
| 6 | Anonymity of user addresses | **TBD** | 🧱 Outside the privacy layer | Encryption does not hide who signed. Needs stealth addresses — a separate, additive tool |
| 7 | Confidential smart-contract logic | **N/A** | 🚫 Not achievable | MPC and FHE run **public programs over private data**. Structural, not a choice |
| 8 | Sanctions check | **TBD** | 🔧 Engineering | The ERC-3643 identity half is mocked out |

**One built, one partial, five TBD, one N/A.** The five marked TBD are not one kind of
thing — the distance from each to "done" ranges from wiring an existing contract to
redesigning the token — and collapsing them into a single ✗ is what makes a scorecard
like this misleading. Capability 7 is **N/A** rather than TBD because no amount of work
reaches it; see the 🚫 tier below.

### The four tiers, and why they matter

**🔧 Engineering — capabilities 2, 5, 8.** Nothing stands in the way but work. Every
primitive needed already exists, in COTI's own published contracts or in this tree:

- **Capability 2** needs a confidential payment token. COTI ships one —
  `PrivateBridgedUSDC` (`p.USDC.e`, 6dp) and `PrivateTetherUSD`, both `PrivateERC20`
  subclasses in `coti-contracts`. The demo settles in the *public* USDC.e instead. This is
  a wiring decision, not a research problem.
- **Capability 5** needs a sealed-bid auction. `MpcCore` exposes `max`, `gt`, `ge` and `eq`
  over `gtUint256`, which is exactly the comparison-and-select a sealed-bid auction is. A
  sealed-bid auction is close to the canonical MPC application; the reason there isn't one
  is that no secondary market was built.
- **Capability 8** needs the ERC-3643 identity half — ONCHAINID, claim topics, trusted
  issuers, sanctions as a claim topic. The standard specifies it and the port mocked it.

**🏗 Architecture — capabilities 3 and 4.** Achievable on this technology, but not on this
contract design, and the cost is real rather than nominal.

- **Capability 4** wants the fund identity hidden. Storage slots cannot be looked up by an
  encrypted key, so a multi-fund contract has to write *every* fund's slot on every
  transaction and `mux` the real one in — O(number of funds) per call. Fine for two funds,
  not for two hundred.
- **Capability 3** wants the operation hidden, which means one entry point that executes
  every branch and selects the outcome under encryption — O(number of operations) per call.
  With ~2.3 KB of bytecode headroom left under Paris, this token cannot absorb that today.

These are **scope decisions with a price attached**, not backlog items. Call them possible
but expensive.

**🧱 Outside the privacy layer — capability 6.** MPC hides values; it does not hide who
signed a transaction, because the sender must be recoverable to pay gas and authorise the
call. Address anonymity is a *different* cryptographic construction — stealth addresses,
rotation, or ZK membership proofs — layered on top. It is buildable on COTI, but not *by*
COTI's MPC. That several of EPIC's platforms paired their encryption scheme with stealth
addresses is the tell: the privacy layer did not give it to them either.

**🚫 Not achievable — capability 7.** This is the only genuine wall, and it applies to the
whole class of technology rather than to this port.

FHE and MPC are built on the same bargain: **the program is public, the data is private.**
Every party must agree on the circuit being evaluated, and on a public chain the bytecode
is on-chain and decompilable whether or not anyone verifies the source. No amount of
engineering changes that — it is the computational model. The same holds for an FHE chain
such as Zama's fhEVM.

The one architecture in EPIC's set that *can* hide logic does it by not being a public
chain: Rayls runs segregated per-institution Privacy Ledgers behind a permissioned Commit
Chain, so the code itself lives somewhere the public cannot read. That is a different
deployment model, not a better cipher.

So capability 7 is not a gap in this repository. **It is a property of choosing
public-chain confidential computation at all**, and it should be argued rather than
scored — the honest position is that source-verifiable logic is a feature of this design,
and the capability is unreachable regardless.

---

## 1. Confidential ownership balance — built

The one capability the port delivers outright.

Balances are stored as `utUint256` — a contract copy plus a holder copy — and
`balanceOf(address)` returns a `ctUint256` readable by exactly one AES key. An explorer,
an indexer and every other holder see a 64-byte ciphertext.

Confirmed live rather than argued: the JTRSY holder ciphertext at
`0x6D7cf587…Baf3` decrypts to `197763652658` (1977.63652658 shares) with the holder's key,
against a public `totalSupply` of `198213115504`. The value round-trips, and it is
unreadable without the key.

**Caveat on scope.** `totalSupply` stays a public `uint256` by deliberate design choice
([`MPC-CONFIDENTAL-IMPLEMENTATION.md`](MPC-CONFIDENTAL-IMPLEMENTATION.md) §4.3). With two funds and a
small holder set, a public supply plus public subscription amounts narrows the search
space for any individual position considerably. EPIC's use case assumes an institutional
register where that inference matters.

## 2. Confidential transaction value — partial · 🔧 engineering

Split cleanly down the middle, and the split is the most important finding in this
document.

**Secondary transfers: confidential.** `transfer(address, itUint256)` takes a signed
encrypted amount, and the `Transfer` event carries two `ctUint256` values — one readable
by the sender, one by the receiver — and nothing else. A blocked transfer moves an
encrypted zero rather than reverting, so even the *outcome* is not disclosed.

**Primary issuance: public.** `RwaSubscription.subscribe` settles the stablecoin leg in
ordinary public ERC-20s (USDC.e, USDT) and `priceOf` is a public `uint256`, so the share
count follows arithmetically from the payment. The contract documents this itself rather
than hiding it. Confirmed in `0x8ffe8404…df788`:

```
Subscribed(buyer=0xAb81c57C…c30012, paymentAmount=100000000, shares=8989256939)
```

Both integers are plaintext in the log.

**Agent mint and burn: public.** `mint(address,uint256)`, `burn(address,uint256)` and
their batch forms take cleartext amounts, and `MintFinalized` / `BurnFinalized` emit
`uint256` values — a direct consequence of keeping supply public.

So the amount is protected once a share is held and moving between investors, and exposed
at every point where a share is created, destroyed or bought from the issuer.
**Confidentiality protects the holding, not the acquisition.**

## 3. Confidential transaction type — TBD · 🏗 architecture

EPIC's use case 1 requires that an observer cannot tell *what kind* of operation occurred.
Here every call is identifiable from its four-byte selector in calldata: `subscribe`,
`transfer`, `approve`, `mint`, `freezePartialTokens` are all distinguishable, and the
distinct event `topic0` for each confirms it independently.

MPC encrypts the *operands*, never the *operation* — so hiding the operation means never
branching on it in the clear. The construction exists: a single entry point taking an
encrypted opcode, executing **every** branch, and selecting the result with `mux`. An
observer then sees one indistinguishable call and one uniform set of storage writes.

It is achievable, and it is expensive. Cost scales with the number of operations, because
every call pays for all of them, and this token has roughly 2.3 KB of bytecode headroom
left under Paris. **The blocker is contract architecture and its price, not the
cryptography** — which is why this sits in the 🏗 tier rather than alongside capability 7.

## 4. Confidential token type — TBD · 🏗 architecture

EPIC's bar: "the fund being entered" remains private.

This implementation puts **each fund in its own contract** — JTRSY at `0x6D7cf587…Baf3`,
JAAA at `0x20b2C3cc…6732`, with a separate registry, compliance module and subscription
contract each. The `to` address of any transaction therefore names the fund exactly.
Holding a position in a specific, named, rated fund is fully public; only its size is not.

For the cap-table exposure this project set out to address, that is the material half. An
observer who wants to know *who is in JTRSY* — as distinct from how much they hold — reads
it straight off the `Transfer` logs.

**A different architecture reaches this, at a price.** One multi-fund contract could take
the fund as an encrypted operand — but storage slots cannot be addressed by an encrypted
key, so every fund's slot must be written on every transaction with `mux` selecting the
real one, or the write pattern gives the fund away. That is O(number of funds) per call:
workable for the two funds deployed here, not for a platform carrying many. Again the
blocker is architecture and cost, not the cryptography.

## 5. Confidential bids — TBD · 🔧 engineering

There is no auction, order book or bidding mechanism anywhere in the repository — grep
across `contracts/`, `contracts-private/` and `app/src` returns nothing. `RwaSubscription`
is a fixed-price primary-market till: `priceOf[paymentToken]` is set by the owner and
`subscribe` fills at that price. EPIC exercises this capability in its secondary-market
use case (p. 42), where investors submit encrypted bids to an auction contract and an
identity check gates each bid. **This repository implements no secondary market at all.**

The reason this is *not built* rather than *not achievable* is worth stating, because it
is the clearest case on the list. A sealed-bid auction — take encrypted bids, compare them
without decrypting, reveal only the winner — is close to the textbook application of
secure multi-party computation. The primitives are already in the vendored library:

```solidity
MpcCore.max(gtUint256 a, gtUint256 b)   // and gt, ge, eq over encrypted 256-bit values
```

Comparison-and-select over ciphertext is exactly what a sealed-bid auction needs. Nothing
about COTI's model obstructs this capability; the repository simply never built the market
it would live in.

## 6. Anonymity of user addresses — TBD · 🧱 outside the privacy layer

`Transfer(address indexed _from, address indexed _to, ctUint256, ctUint256)` — both
counterparties are indexed, cleartext addresses. Subscriptions carry
`Subscribed(address indexed buyer, …)`. The identity registry exposes
`isVerified(address)` as a public view, so an observer can enumerate who is eligible for a
fund without holding any key.

There are no stealth addresses, no address rotation and no mixing. Two of EPIC's five
platforms paired their encryption scheme with stealth addresses precisely because
encrypting values does not anonymise parties — that is an application-layer construction
on top of the privacy technology, and this repository does not build it.

**This is the capability whose absence most undercuts capability 1.** With 17 holders in
the real JTRSY, a public graph of who transacted with whom, plus public subscription
amounts, leaves encrypted balances doing less work than they appear to.

## 7. Confidential smart-contract logic — N/A · 🚫 not achievable

**The only capability on this list that no amount of work would deliver**, and the
distinction matters more than the score.

FHE and MPC share one bargain: **the program is public, the data is private.** Every party
evaluating the circuit must agree on what circuit it is. On a public chain the bytecode is
on-chain and decompilable whether or not the source is verified, so there is no version of
this port — or of an equivalent Zama fhEVM deployment — that hides its own logic. Hiding
logic requires changing where the code lives, not how the data is encrypted: EPIC's Rayls
submission achieves it with segregated per-institution Privacy Ledgers behind a
permissioned Commit Chain, which is a different deployment model rather than a stronger
cipher.

Given that, the repository's actual position is the defensible one: all nine deployed
contracts are **source-verified on cotiscan with a full bytecode match**, and the port's
central claim is auditability — every `offBoardToUser` call site makes read access visible
in the code that grants it ([`MPC-CONFIDENTAL-IMPLEMENTATION.md`](MPC-CONFIDENTAL-IMPLEMENTATION.md)
§4.1). Obscuring the logic would forfeit that and buy nothing, since the bytecode would
still be public.

**This row should be argued, not scored.**

Worth separating from the headline, though: **the rule parameters are public too.**

```solidity
mapping(address => uint256) public maxBalance;   // MaxBalancePrivateCompliance
```

The *tracked balance* is an encrypted shadow ledger, but the **cap applied to each
investor is a public getter**. A per-investor concentration limit is itself commercially
sensitive — it discloses how the issuer classifies that investor. The encryption stops one
layer short.

## 8. Sanctions check — TBD · 🔧 engineering

EPIC's bar (p. 42) is concrete: an auction contract calls an on-chain identity check that
verifies AML/KYC rules **and screens against a sanctions list**, with the claims themselves
encrypted. In their scenario Investor D's bid is rejected at exactly that step.

This repository has none of it. The deployed registry is `MockPrivateIdentityRegistry`:

```solidity
mapping(address => bool) public verified;
function setVerified(address _userAddress, bool _isVerified) external { ... }
```

No ONCHAINID, no `ClaimTopicsRegistry`, no `TrustedIssuersRegistry`, no claim walk, no
issuer callback, no sanctions list — and **no access control on `setVerified`,
`registerIdentity` or `deleteIdentity`**, so anyone can verify anyone. Eligibility is also
cleartext by design: `isVerified` returns a plain `bool`.

Two further points an issuer would raise:

- **The remediation path is broken.** `forcedTransfer` and `batchForcedTransfer` take
  `gtUint256` and are uncallable from outside
  ([`MPC-CONFIDENTAL-IMPLEMENTATION.md`](MPC-CONFIDENTAL-IMPLEMENTATION.md) §7.1). If a holder *were*
  found on a sanctions list post-issuance, the agent cannot seize the position.
- **Supervisors cannot read balances.** An agent can re-encrypt a holder's *frozen* amount
  to itself, but there is no path to a holder's balance at all (§4.1). A compliance officer
  cannot see what they are meant to supervise.

The ERC-3643 standard supports all of this through claim topics and trusted issuers
([`ERC-3643-STANDARD.md`](ERC-3643-STANDARD.md) §3, §5). **The standard's identity half is
simply not implemented here** — that is the single largest gap in the port, and it is
already recorded as such.

---

## 9. The sharpest test: EPIC use case 1

EPIC's first use case (p. 31) describes, almost exactly, the flow this repository
implements:

> An institutional investor is able to subscribe into a fund, but **their identity**, **the
> fund being entered**, and **the amount being invested** remain private.

Three requirements. Run the demo's own subscription transaction against them:

| EPIC requirement | In `0x8ffe8404…df788` |
| --- | --- |
| Identity private | ❌ `Subscribed(buyer=0xAb81c57C…c30012)`, indexed |
| Fund entered private | ❌ the call is to the JTRSY subscription contract |
| Amount invested private | ❌ `paymentAmount=100000000`, `shares=8989256939` |

**Zero of three**, in the one flow the repository was built to demonstrate. The encrypted
balance that results is real and valuable, but it is established by a transaction that
discloses everything EPIC asked to be hidden.

This is not a contradiction of the port's own claims — `RwaSubscription.sol` carries the
disclosure in its own header comment, and `MPC-CONFIDENTAL-IMPLEMENTATION.md` §6 states it. EPIC
just makes the cost legible by naming the three things separately.

## 10. Not built yet vs. cannot be built

The single most useful reading of this scorecard, and the reason the blocker column exists:

**Three of the seven gaps are backlog.** Capabilities 2, 5 and 8 have no technical obstacle
whatsoever. The confidential payment token is published and unused; the MPC comparison
primitives for sealed bids are in the vendored library; the identity design is specified
by ERC-3643 itself. Anyone reading this table as "COTI cannot do these" would be wrong —
**this repository did not do them.**

**Two are architectural.** Capabilities 3 and 4 are reachable on the same technology, but
only by redesigning around uniform dispatch and a multi-asset contract, paying O(branches)
and O(funds) per transaction. Possible, priced, and a decision rather than a task.

**One is outside the privacy layer.** Capability 6 needs stealth addresses or an
equivalent, which sit *beside* MPC rather than inside it — additive work on any chain,
which several EPIC platforms did precisely because their encryption layer did not supply
it.

**One is a wall — and is therefore marked N/A, not TBD.** Capability 7 is unreachable for
any public-chain FHE or MPC design, Zama's included, because those systems run public
programs over private data. It is not a shortfall of this port, and it will not move.

So the fair summary is **not** "one of eight". It is: one capability built, one half-built,
two TBD with a clear path, two TBD with an expensive path, one TBD requiring a different
tool, and one N/A requiring a different kind of chain.

That still leaves the port well short of what EPIC's five submissions were aiming at —
they were purpose-built against these requirements, and this was not. A port whose goal
was to prove ERC-3643's compliance surface survives encryption on COTI should be read as
having answered *that* question. But the gap between it and an EPIC-grade stack is mostly
**unbuilt work, not unavailable technology**, and that is the more accurate and more
useful conclusion.

## 11. What would move the score

Roughly in order of effort against benefit:

1. **A confidential payment token** for the subscription leg — upgrades capability 2 from
   partial toward met, and removes the arithmetic inference that currently defeats
   capability 1 for newly issued shares.
2. **A real identity registry** — ONCHAINID plus claim topics and trusted issuers, with
   sanctions as a claim topic. Opens capability 8 and is required for any real issuer
   regardless of EPIC.
3. **Fix `forcedTransfer`** to take `itUint256` — small, and without it the sanctions story
   has no remediation step even once screening exists.
4. **Agent read access to balances** — needed before a compliance officer can supervise.
5. **Stealth addresses or equivalent** — the only route to capability 6, and a substantial
   piece of application work rather than a contract change.

Items 1–4 are 🔧 engineering and close real gaps. Item 5 is 🧱 additive work beside the
privacy layer. **Capabilities 3 and 4 are absent from this list on purpose** — they need
an architecture change with a per-transaction cost (§10) and belong in a design review,
not a backlog. **Capability 7 is absent because no amount of work reaches it.**

---

*Source: [`JPMC-Kinexys-Project-Epic-Whitepaper-2024.pdf`](JPMC-Kinexys-Project-Epic-Whitepaper-2024.pdf),
pp. 31, 33–34, 42. The capability names are Kinexys'; the assessments are this
repository's own.*

**Next:** [`ZAMA-COMPARISSON.md`](ZAMA-COMPARISSON.md) — the other confidential ERC-3643,
side by side: encrypt-in-place against a wrapper, 256-bit against 64-bit, and the one
argument that survives the comparison.
