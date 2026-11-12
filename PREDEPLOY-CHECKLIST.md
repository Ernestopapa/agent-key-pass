# Agent Key Pass — Pre-Deploy Checklist (Mainnet)

Prepared 2026-11-02 ~17:34 GMT. User approved mainnet 2026-11-02 ~17:30 GMT
("Yes — go to mainnet now"). **PREP ONLY — nothing deployed, no real BNB
spent, no transaction sent.** The deployer holds 0.0 BNB on mainnet.

## 1. Final specs (locked, Gate 0)

- Name: Agent Key Pass, symbol AKEY, BSC mainnet chain 56, ERC-721,
  transferable (NOT soulbound).
- Total 444 = 77 free + 367 paid. Free: Agent ID only, 1/wallet, gas only,
  via `freeMint()` checking the REAL registry
  `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`.
- Paid: open to EVERYONE after the free 77 are exhausted, 0.00142 BNB
  ($1.00), max 3/tx, via `mint()` with **NO Agent ID check — deliberate
  and user-locked**. Do NOT re-add a registry check to `mint()`.
- Royalties: 5% ERC-2981 to the owner. Max paid revenue $367.00
  (0.52114 BNB).
- Art: single shared image for all 444 tokens, IPFS CID
  `bafybeifl4gr6ym3p6saqu7jtahndddyy5mfcduwsvssu3z33crmadczzcm`.
- Contract is NOT third-party audited. Never promise floor price, returns,
  APY, a dated token/airdrop, a game, or merch.

## 2. Pre-deploy recheck (re-run 2026-11-02 ~17:31–17:34 GMT)

| Check | Result |
|---|---|
| `npm run compile` | Clean, exit 0. AgentKeyPass bytecode 8,460 bytes, ABI 59 entries |
| `npm run test:local` (fresh re-run) | **44/44 passed, allPassed true**, finished 2026-11-02T17:31:36Z (test-results.json overwritten with the fresh run) |
| Contract constants | MAX_SUPPLY 444, FREE_SUPPLY 77, PAID_PRICE 0.00142 ether, MAX_PAID_PER_TX 3 — read from `contracts/AgentKeyPass.sol` |
| `mint()` gating | Only `agentIdRegistry.balanceOf` require is in `freeMint()`; `mint()` carries the explicit "intentionally NO check" note |
| Slither 0.11.6 (on file) | 69 results — last line of `scans/slither-2026-11-02.txt`: "69 result(s) found". 64 OpenZeppelin internals, 5 low/info on AgentKeyPass, no real vulnerability (see `scans/SUMMARY.md`) |
| Aderyn 0.6.8 (on file) | 1 high + 7 low in `scans/aderyn-2026-11-02.json`. High = `reentrancy-state-change` in `freeMint()` — DOCUMENTED FALSE POSITIVE (all state writes before `_safeMint`, `nonReentrant`). Lows: centralization risk, costly-loop (max 3), PUSH0, require-in-loop, state-change-without-event, unspecific pragma, public view functions |
| Metadata | 444 files in `metadata/`, all parse as JSON, placeholder grep (REPLACE/TODO/TBD/placeholder/NFOX/NeonFox/fox/3333/0.00007/testnet address) = **0**. Every image `ipfs://bafybeifl4gr6ym3p6saqu7jtahndddyy5mfcduwsvssu3z33crmadczzcm` |
| Site package v2 | `site-deploy-v2-2026-11-02-testnet-verified.zip`, 447 entries, `unzip -t` OK; `site-deploy/` = 447 files (under the 1,000 Cloudflare drag-and-drop limit) |
| Testnet contract `0x9E52aa8073F37C075822F4fEd6F33B8a7954D028` (BSC testnet RPC, live re-check ~17:33 GMT) | totalSupply **81**, owner = user wallet `0x75d251Ba39dED2E456d9f6DD776f77d422864403`, freeMintedCount 77, freeRemaining 0, paidRemaining 363, freeOpen false, paidOpen true, contract balance 0.00568 tBNB, royaltyInfo 5% to owner |
| Testnet verification (on file) | Sourcify **exact_match, matchId 58094532**, verified 2026-11-02T15:32:11Z (`verification/sourcify-result.json`); BscScan testnet getsourcecode returns ContractName AgentKeyPass, v0.8.26, runs 200, cancun (`verification/bscscan-result.json`) |
| Testnet live tests | 16/16 (free #1, double/non-agent reverts, paid blocked in free phase, free exhausted 77/77, **non-agent paid #78 succeeds**, agent paid x3 #79–81, royalty 5%, qty-4 + withdraw reverts proven via eth_call/staticCall corrections) |

**Discrepancies: none.** Every recheck matches the SPECS.md record. One
counting note, not a discrepancy: Slither's text file groups findings by
detector (11 "Detector:" headers); the 69 figure is the tool's own final
tally ("69 result(s) found"), confirmed on the file's last line.

## 3. KNOWN GAP — baseURI never set/proven (recorded explicitly)

- Testnet `tokenURI(1)` returns `""` (live re-check ~17:33 GMT) — the
  baseURI was never set on testnet because the Cloudflare site is not
  live yet. The user is creating the Cloudflare site themselves from
  `site-deploy-v2-2026-11-02-testnet-verified.zip`.
- Mainnet deploy MAY proceed without a live site, but **`setBaseURI` on
  mainnet must wait** for (a) the live `*.pages.dev` URL and (b) the user
  wallet to sign it (owner-only — the deployer cannot do it).
- Until `setBaseURI` is set and `tokenURI(1)` is verified loading live,
  tokens will have empty metadata. Do NOT announce minting as live
  before that check passes. The deploy script does not attempt setBaseURI.
- This is a deliberate deviation from the skill's "set baseURI on testnet
  before mainnet" step, forced by the site not being live yet. It is
  recorded here, not hidden.

## 4. Mainnet deployer (fresh throwaway)

- Address: **`0x8847D9bda887E936299C1230eB799b3F504a7c8B`**
- Generated 2026-11-02 ~17:33 GMT, never used before, NOT the testnet
  deployer (`0x4f034A86EF3B1DAE84Ccba9764564304d2821B98`), NOT the user wallet.
- Private key stored ONLY in `~/workspace/agent-key-pass/.env.mainnet`,
  chmod 600. Never printed, never committed, never reused elsewhere.
- Mainnet balance verified 0.0 BNB (~17:34 GMT) — nothing spent.

## 5. Funding requested + cost math

Live figures 2026-11-02 ~17:33 GMT: BNB **$699.47** (CoinGecko),
mainnet gas **0.05 gwei** (block 131281470). Deploy gas 1,811,397
(testnet actual; live estimate 1,826,940).

| Gas price | Deploy cost (BNB) | Deploy cost (USD) |
|---|---|---|
| 0.05 gwei (current) | 0.00009057 | ~$0.063 |
| 0.1 gwei | 0.00018114 | ~$0.127 |
| 0.5 gwei | 0.00090570 | ~$0.634 |
| 1 gwei | 0.00181140 | ~$1.267 |

- **REQUESTED FUNDING: 0.002 BNB (~$1.40).** SIGMA's 0.001 BNB would
  cover the deploy only up to ~0.55 gwei; 0.002 BNB covers it up to
  ~1.1 gwei — ~22x the cost at current gas — for $0.70 more, and the
  leftover is returned to the user wallet after deploy.
- `scripts/deploy-mainnet.js` has a balance guard: it aborts unless the
  deployer holds >= estimated cost x2 AND >= a 0.0005 BNB floor.
  `--estimate` was run 2026-11-02 ~17:34 GMT and correctly refused
  (balance 0.0, needs >= 0.0005 BNB): "Estimate: balance INSUFFICIENT".
- Send 0.002 BNB (BSC mainnet, chain 56) to
  `0x8847D9bda887E936299C1230eB799b3F504a7c8B`, verify on-chain, then run
  `node scripts/deploy-mainnet.js`.

## 6. Deploy script

- `scripts/deploy-mainnet.js` (syntax-checked, `--estimate` proven):
  BSC mainnet chain 56, NO mock registry, constructor args = real
  registry + owner = user wallet. No minting, no setBaseURI, no
  withdraw in-script. Writes `deployment-mainnet.json` on success and
  runs post-deploy on-chain checks (name/symbol, constants, owner,
  registry, totalSupply 0, freeRemaining 77, paidRemaining 367,
  freeOpen true, paidOpen false, royaltyInfo 5%).
- **RPC fix applied during prep:** `https://bsc-dataseed.binance.org/`
  returned 403 Forbidden once (~17:34 GMT) then 200 a minute later.
  The script now tries a fallback list in order
  (bsc-dataseed, bsc-dataseed1, bsc-dataseed2, defibit, bsc-dataseed3)
  and uses the first that answers chain 56. The `--estimate` run after
  the fix connected on the first endpoint.

## 7. Owner powers (plain language)

- Owner = user wallet `0x75d251Ba39dED2E456d9f6DD776f77d422864403`.
- Owner CAN: withdraw all BNB, change metadata via `setBaseURI()`,
  transfer/renounce ownership.
- Owner CANNOT: change supply (444), free supply (77), price
  (0.00142 BNB), max 3 per tx, or the Agent ID registry; cannot mint
  extra Passes, pause, freeze, burn, or take holders' Passes.
- Contract is NOT third-party audited.

## 8. Steps after funding (in order)

1. User sends 0.002 BNB to the deployer; verify balance on-chain.
2. Run `node scripts/deploy-mainnet.js` — record contract address + tx.
3. Verify on Sourcify (exact_match) AND BscScan with
   `verification/standard-json.json`, solc 0.8.26, Cancun, optimizer
   200, constructor args = real registry + user wallet. Do not treat
   one verification as complete.
4. Return leftover deployer BNB to the user wallet; record the return tx
   in `deployment-mainnet.json`.
5. Once the Cloudflare site is live: user wallet signs `setBaseURI`
   (owner-only, preview + explicit confirm), then verify `tokenURI(1)`
   loads live and the checker works on a real phone.
6. Only then: launch post (user posts manually, never attempt X login),
   refresh live counts from the chain right before posting.
