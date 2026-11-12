# Agent Key Pass — Specs (Gate 0)

Name LOCKED 2026-11-02 ~14:54 GMT (user tapped option): Agent Key Pass
Symbol LOCKED: AKEY — "Agent Key Pass", no Neon anywhere in the name.
Token (planned): none. No token is promised. No date, no price, no airdrop.

## Locked by user 2026-11-02

- Total supply: 444
- Free supply: 77
- Free phase: Agent ID holders ONLY, 1 per wallet ever, gas only
  - Free mint via `freeMint()`, checks the real Binance Agent ID registry
- Paid phase: OPEN TO ALL wallets (Agent ID and non-Agent ID)
  - Paid supply: 367 (444 - 77)
  - Paid opens only after the free 77 are exhausted
- Paid price LOCKED: $1.00, coded as 0.00142 BNB
  - Price math (BNB price checked 2026-11-02 ~15:00 GMT via CoinGecko
    public API: BNB = $704.08): $1.00 / $704.08 = 0.0014203 BNB,
    rounded to 0.00142 ether.
  - 1 mint $1.00, 3 mints $3.00
  - Max paid revenue: 367 x $1.00 = $367.00 (367 x 0.00142 = 0.52114 BNB)
- Max paid per tx: 3
- Royalties: 5% ERC-2981 to owner, same as NFOX / SEVEN SIGMA.
  Note: not guaranteed — some marketplaces ignore ERC-2981
  (Element displayed 0% for NFOX).
- Gating rationale (agreed): free Agent-only keeps AgenticMint / radar
  detection (Agent ID 100%) and the NFOX / SIGMA community; paid open
  brings a wider holder base and a faster sellout.
- Art model LOCKED: single shared art for ALL 444 tokens. No unique
  variants, no traits/rarity, no delayed reveal. The Agent ID gate is
  the value. Art: restrained, not flashy — dark card, thin gold key
  with a small Agent ID mark. Same image for every token.
- Transferable: ERC-721, NOT soulbound. Passes can be sold / transferred.
  (User chose transferable 2026-11-02 ~14:48 GMT.)

## Owner powers (plain language)

- Owner: user wallet 0x75d251Ba39dED2E456d9f6DD776f77d422864403 (neongred.ai).
- Owner CAN: withdraw all BNB, change metadata via setBaseURI(),
  transfer/renounce ownership.
- Owner CANNOT: change supply (444), free supply (77), price (0.00142 BNB),
  max 3 per transaction, or the Agent ID registry, and cannot mint extra
  Passes, pause, freeze, burn, or take holders' Passes.
- Contract is NOT audited by a third party. Say so on the site.
  "Built on OpenZeppelin" is not an audit.
- Registry: real Binance Agent ID registry
  0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F.
  Testnet/local: deploy AgentIdRegistryMock first and pass its address.

## CRITICAL gating deviation (SEVEN SIGMA rule)

Paid mint() must NOT check the Agent ID registry. This is deliberate
and user-locked. Free mint is Agent ID only; paid mint is open to
EVERY wallet, Agent ID or not. Do NOT re-add a registry check to mint().
The generic skill line ("gate both phases") and the NFOX playbook M1
gate do NOT apply here; the correct gate is the opposite: mint() must
succeed for a non-agent after free exhaustion, and freeMint() must
still revert for a non-agent. Both directions are covered by the
local test suite.

## Future stages (stages, not dates — NOT built now)

- Companion (gated): 222 holder-only Passes at $1.50 each (max $333),
  only if main paid sells >50%. Not built in this project.
- Raffle: 20% of actual paid revenue received goes into a capped holder
  raffle pot. Capped, from money actually received. No return promised.
- Points: a score, not a token. Points do NOT entitle anyone to tokens
  or payouts. No token, no airdrop date, no game, no merch promised.
- Never promise floor price, returns, APY, a dated token/airdrop,
  a game, or merch.

## Hosting (user chose 2026-11-02 ~14:52 GMT)

- Cloudflare Pages (NOT Netlify — Netlify credits are exhausted).
- Site files < 1,000 for drag-and-drop: ~15 site files + 444
  extensionless metadata files ONLY (no .json duplicates, unlike
  NFOX 6,671 files / SIGMA 1,554), single shared art on IPFS via
  Pinata, total ~459 files.
- Metadata hosted on the mint site, image on IPFS (Pinata free plan
  caps at 500 pinned files, so 444 metadata files cannot be pinned).

## Facts carried forward (do not re-learn)

- Radars find verified contracts in minutes; mints can start before
  any announcement. Supply size does not change deploy cost — deploy
  cost is code size; minters pay their own mint gas.
- GitHub and Vercel are optional only, not required for launch.
- baw cannot deploy a contract directly; testnet/mainnet deploy uses
  a fresh throwaway deployer, owner = user wallet.

## Gate 1 — COMPLETE 2026-11-02 (local only, no deploy, no wallet touched)

- Contract: `~/workspace/agent-key-pass/contracts/AgentKeyPass.sol`
  (copied from SEVEN SIGMA template, renamed AgentKeyPass,
  "Agent Key Pass" / "AKEY"). Mock: `contracts/AgentIdRegistryMock.sol`
  (copied, local/testnet only).
- Stack: Solidity ^0.8.26, OpenZeppelin v5.6.1, Cancun, optimizer 200.
  solc pinned to exactly 0.8.26.
- Constants: MAX_SUPPLY 444, FREE_SUPPLY 77, PAID_SUPPLY 367,
  PAID_PRICE 0.00142 ether, MAX_PAID_PER_TX 3, royalties 5% (500 bps).
- Compile: `npm run compile` — clean, no errors. AgentKeyPass bytecode
  8,460 bytes, ABI 59 entries.
- Local tests: `npm run test:local` (Anvil, port 8547) — **44/44 passed**,
  first full run, `allPassed: true`, results in `test-results.json`.
- Paid-open-to-all is INTENTIONAL and tested both ways (overrides the
  generic skill line and the NFOX playbook M1 gate): freeMint() checks
  the registry (non-agent freeMint reverts "no Agent ID"); mint() has
  NO registry check (grep: the only `agentIdRegistry.balanceOf`
  require is in freeMint; mint has an explicit "intentionally NO check"
  note). Tests prove it: non-agent paid mint x1 succeeds after free
  exhaustion (token #78), agent paid mint x3 succeeds, non-agent
  freeMint reverts. Do NOT re-add the check to mint().
- Other tests: qty 0 and 4 revert, wrong price reverts, double free
  reverts, free after exhaustion reverts, supply cap 444 enforced,
  royaltyInfo 5% to owner, non-owner setBaseURI/withdraw revert, owner
  withdraw empties contract (raw eth_getBalance, M9 lesson), contract
  held exactly 0.52114 BNB (367 x 0.00142) before withdraw.
- Gas (local Anvil): deploy AgentKeyPass 1,811,397; mock 308,419;
  free mint 127,754; paid x1 (non-agent) 102,531; paid x3 (agent)
  122,431; withdraw 32,137; setBaseURI 91,474. Mainnet estimate at
  0.05 gwei / BNB $704.08: deploy ~$0.064, creator launch total
  (deploy + setBaseURI) ~$0.07.
- NOT done in Gate 1 (later gates): Slither/Aderyn, testnet deploy +
  live free AND paid tests, metadata/IPFS, verification, site,
  mainnet deploy, launch.

## Gate 2 — Scans COMPLETE 2026-11-02

- Slither 0.11.6 (solc 0.8.26 binary): 69 results, 25 contracts
  analysed. 64 are OpenZeppelin v5.6.1 library internals
  (known/audited, same as NFOX/SIGMA). 5 touch AgentKeyPass.sol,
  all informational/low, none a real vulnerability:
  reentrancy-no-eth in `mint()` (mitigated by `nonReentrant` + state
  before `_safeMint` + max 3 loop), reentrancy-events in `withdraw()`
  (onlyOwner, balance read before the call), low-level-calls in
  `withdraw()` (checked `.call`, same as NFOX/SIGMA), costly-loop in
  `mint()` (max 3), pragma/solc-version (build pins solc exactly
  0.8.26). Full output: `scans/slither-2026-11-02.txt`.
- Aderyn 0.6.8: 1 high, 7 low. The high (`reentrancy-state-change`
  in `freeMint`) is a FALSE POSITIVE — all state changes in
  `freeMint()` are BEFORE `_safeMint` (checks-effects-interactions)
  and the function is `nonReentrant`; only the event emit follows
  the call. Lows are all known / intentional: centralization risk
  (documented owner powers), costly-loop (max 3), PUSH0 (BSC
  supports Cancun), require-in-loop (atomic mint),
  state-change-without-event (`setBaseURI` has no event), unspecific
  pragma (`^0.8.26`, compiler pinned), public view functions
  (standard API). Caveat: Aderyn compiled with its own solc 0.8.33 /
  EVM Prague, not the pinned 0.8.26 / Cancun.
- Full analysis: `scans/SUMMARY.md`, raw Aderyn JSON
  `scans/aderyn-2026-11-02.json` (+ `.log`).
- Verdict: no new issues vs NFOX / SEVEN SIGMA. No real vulnerability.

## Gate 3 — COMPLETE 2026-11-02 (art + metadata; gateway check caveat)

- Art: ONE shared image for all 444 tokens, generated
  `art/agent-key-pass.webp` (356,518 bytes, image/webp): matte black
  card, thin gold key diagonal, small circular Agent ID mark,
  restrained, no text, no flash. Verified visually by the builder.
- IPFS: uploaded to Pinata (custom.pinata, auth 200), 1 file.
  CID: `bafybeifl4gr6ym3p6saqu7jtahndddyy5mfcduwsvssu3z33crmadczzcm`
  (pin confirmed server-side via Pinata pinList: count 1, pinned
  2026-11-02T14:59:19Z, size 356,626 bytes — Pinata's size includes
  IPFS chunking overhead over the 356,518-byte local file).
  CAVEAT: gateway.pinata.cloud returned 404 on first checks
  (~15:05 GMT, ~6 min after upload) — likely propagation delay;
  re-check before testnet baseURI is set. The pin itself is proven
  (pinList count 1). Do NOT claim the gateway 200 until a direct
  fetch returns 200 with matching sha256.
- Metadata: `scripts/generate-metadata.mjs --cid <CID>` — 444 files
  in `metadata/` (1..444, extensionless ONLY, no .json duplicates —
  deliberate deviation from the NFOX M5 "ship both" rule, per the
  locked <1,000-file Cloudflare requirement; tokenURI appends only
  the id, so extensionless is what matters). All 444 parse as JSON;
  every image is `ipfs://<CID>`; Origin Free #1-77, Paid #78-444.
- Placeholder grep over all 444 files (REPLACE, TODO, TBD,
  placeholder, NFOX, NeonFox, fox, 3333, 0.00007, testnet contract
  address) = **0**.
- Metadata NOT on IPFS — Pinata pin cap (500 files), same as NFOX/SIGMA.
  Metadata follows the NFOX route: JSON on the mint site, image on IPFS.
- NOT done (later gates): testnet deploy + live tests, Sourcify +
  BscScan verification, site, mainnet deploy, launch.

## Gate 4 — site COMPLETE 2026-11-02 (built + locally verified, NOT live)

- Site built in `site/` (index.html 15,838 B, llms.txt 4,217 B) and
  staged in `site-deploy/` with `agent-key-pass.webp` + `metadata/`
  (444 extensionless files). Package:
  `site-deploy-v1-2026-11-02-agent-key-pass.zip` (0.64 MB, 447 entries,
  testzip clean). Total files: **447** — under the 1,000 Cloudflare
  drag-and-drop limit (3 site files + 444 metadata).
- Pre-deploy honest state throughout: banner says NOT DEPLOYED YET,
  no contract address anywhere (none exists), no marketplace links,
  no X handle (none exists for AKEY). Checker reads the REAL mainnet
  registry (0x60B92624…) via public BSC RPC — Agent ID yes/no works
  today; contract-dependent fields say "not deployed yet". Agent
  prompt says do NOT mint until the contract is deployed + verified.
  Browser mint is collapsed and disabled until deploy.
- Design: dark, restrained, one gold accent (#c9a227), mobile-first,
  viewport meta, box-sizing, max-width cards. No traits/gallery/team/
  roadmap dates/fake countdown/placeholder URLs. Roadmap is
  stages-not-dates (companion gated, raffle 20% of actual paid
  revenue). Points are a score, not a token. Not-audited statement
  and owner powers in plain language. Technical details in a collapsed
  footer (price math, gas, scans, file counts, Cloudflare hosting).
- Greps on the built package: `verification pending` / testnet
  contract / NFOX / SIGMA / Neon = **0**. Inline JS parses
  (`node --check` OK). Artifact `agent-key-pass-mint-site` built for
  user review (preview only — the Cloudflare package is site-deploy/).
- Local verification (python http.server over site-deploy/):
  homepage **200** (15,838 B), `/metadata/1` **200**,
  `/metadata/77` **200**, `/metadata/78` **200**, `/metadata/444`
  **200**, `/llms.txt` **200**, `/agent-key-pass.webp` **200**
  (356,518 B). `/metadata/1.json` **404 by design** — extensionless
  only, per the locked <1,000-file rule; tokenURI appends only the id.
- Gateway re-check (Gate 3 caveat RESOLVED): Pinata gateway now
  returns **200 image/webp, 356,518 bytes, sha256
  ba41d7472eac7f7c1924f593c00df9f7e075aaa616c6241bbd812df8ecbbf519 —
  exact match to the local file**. The earlier 404 was propagation
  delay (~6 min after upload).
- NOT live, and NO Cloudflare site has been created yet. Creating the
  site is a NEW-site step (drag the EXTRACTED site-deploy/ folder,
  not the zip). Once live, the site URL goes into baseURI (testnet
  only, after testnet deploy) and the live /metadata/1 must be
  re-fetched for a 200.
- NOT done (later gates): testnet deploy + live free AND paid tests,
  Sourcify + BscScan verification, mainnet deploy, launch.

## Gate 5 — COMPLETE (testnet deployed + verified) 2026-11-02 ~15:32 GMT

- User approved testnet 2026-11-02 15:08 GMT, claimed the faucet, and
  re-checked on-chain: deployer 0x4f034A86EF3B1DAE84Ccba9764564304d2821B98
  held exactly **0.02 tBNB** (verified on 2 RPCs, gas 0.1 gwei).
  That was below the script's conservative 0.025 tBNB MIN_BALANCE, so
  the runner lowered it to 0.0195 with documented math: deploys
  2,138,974 gas = 0.000214 + setAgents ~0.00018 + 79 funding transfers
  ~0.000166 + funding value 0.0187 = ~0.0193 tBNB total. Actual
  deployer balance after the run: **0.0007412054 tBNB left** — the
  0.02 tBNB was enough, as calculated. Do NOT lower the threshold
  further. Deploy script: `scripts/deploy-testnet.js`.
- Mock registry deployed: **0x8a39690D5aE2B353B4E29e8DF2cbC1dB48485678**,
  tx 0x47f90d6a70f341bff99b4a1accfe8363ed6f32abcaf1bc3ac18cd6c6a9dbde04,
  gas 308,419.
- AgentKeyPass deployed (TESTNET ONLY, SUPERSEDED): **0x9E52aa8073F37C075822F4fEd6F33B8a7954D028**,
  tx 0x6910f2c8e87b21ca211be4a32b133f321f284e3a2f462c601ed5035ccdb632ec,
  gas 1,811,397, block time 2026-11-02T15:31:17Z. Owner = user wallet
  0x75d251Ba39dED2E456d9f6DD776f77d422864403 (verified on-chain).
- Live tests: **16 scripted, 14 passed, 2 first FAILed for harness
  reasons only — both corrected with raw-RPC proofs, final 16/16.**
  Free mint #1 tx 0xf17b1d6f9e4333b231682380252e9accab9b77203f6130812105a55585a7750f
  (gas 127,754); double free reverts "already claimed free"; non-agent
  free reverts "no Agent ID"; paid blocked during free phase
  ("paid mint not open yet"); free exhausted 77/77, last tx
  0x09a89b57c7d7351bc34f297e5c744716dea316fa6c9c79748167f342e3af503d;
  freeRemaining 0 / paidOpen true; **non-agent paid mint #78 succeeds**
  tx 0x8da78050fe90f858215bfbf00d459017109d3d6243e534587d4f8c6b0a191f9f
  (gas 102,531) — the critical paid-open proof; agent paid x3 tokens
  #79-81 tx 0x64bef3dbad35c819e8c9c4026ab45cb2c29a603a55fd23467ff4bc60edd96b6f
  (gas 122,431); wrong price reverts "wrong price"; royaltyInfo 5% to
  owner (0.05 on 1 tBNB sale); contract holds **0.00568 tBNB** for owner.
  On-chain reads verified independently: totalSupply 81, freeMinted 77,
  paidRemaining 363, ownerOf(1)=agent wallet[0], ownerOf(78)=plain
  wallet, ownerOf(81)=agent wallet[0].
  - CORRECTION 1: qty-4 "FAIL — insufficient funds" was a harness
    artifact (plain wallet held ~0.00457 after its x1 mint; the call
    sent value 0.00568 so ethers failed before the qty check). Re-proven
    by eth_call mint(4) value 0: reverts exactly "qty 1..3" — mint()
    checks qty FIRST. Max-3 cap proven live.
  - CORRECTION 2: withdraw "FAIL — unknown custom error" was a regex
    miss. Revert data was 0x118cdaa7 + deployer address; keccak
    ("OwnableUnauthorizedAccount(address)")[:4] = 0x118cdaa7, verified
    in node. Re-ran deployer withdraw via staticCall: reverts with
    exactly 0x118cdaa70000000000000000000000004f034a86ef3b1dae84ccba9764564304d2821b98
    = OwnableUnauthorizedAccount(deployer). Withdraw is owner-only, live.
  Full evidence: `deployment-testnet.json`, `testnet-live-tests.json`
  (incl. corrections + verification section).
- Verification (testnet): **Sourcify exact_match, matchId 58094532,
  verified 2026-11-02T15:32:11Z** (verification/sourcify-result.json,
  standard JSON in verification/standard-json.json). **BscScan testnet
  VERIFIED via Sourcify forwarding** — getsourcecode chain 97 returns
  ContractName AgentKeyPass, v0.8.26+commit.8a97fa7a, optimization 1,
  runs 200, EVM cancun, SourceCode 176,971 chars (no separate API
  submit needed; script recorded this in
  verification/bscscan-result.json).
- Site/llms/README labelled TESTNET ONLY / SUPERSEDED with the testnet
  address; minting stays disabled until mainnet. Site package rebuilt
  as site-deploy-v2-2026-11-02-testnet-verified.zip (447 files).
- NOT done: Cloudflare site creation (drag EXTRACTED site-deploy/
  folder, not the zip); baseURI on testnet (needs the live site URL +
  user-wallet signature — owner-only, cannot be done by the deployer);
  mainnet deploy + verification + setBaseURI (needs explicit user
  approval); real-phone checker test after the site is live.

## Gate 6 — Mainnet PREP COMPLETE 2026-11-02 ~17:34 GMT (prep only, NOT deployed)

- User approved mainnet 2026-11-02 ~17:30 GMT ("Yes — go to mainnet now").
- Pre-deploy recheck re-run fresh: `npm run compile` clean (AgentKeyPass
  8,460 bytes, ABI 59); `npm run test:local` **44/44, allPassed true**,
  finished 2026-11-02T17:31:36Z. Scans on file confirmed: Slither 69
  results (file's last line: "69 result(s) found"), Aderyn 1 high
  (documented false positive) + 7 low. Metadata 444 files, grep 0.
  Site-deploy v2 zip 447 files, testzip OK. Testnet re-checked live:
  totalSupply 81, owner = user wallet, balance 0.00568 tBNB, Sourcify
  exact_match matchId 58094532. No discrepancies.
- KNOWN GAP (recorded in PREDEPLOY-CHECKLIST.md §3): testnet baseURI was
  NEVER set/proven — `tokenURI(1)` returns `""` — because the Cloudflare
  site is not live yet (user creating it themselves). Mainnet may deploy,
  but setBaseURI on mainnet must wait for the live site URL + user-wallet
  signature. Do not announce minting live before tokenURI(1) loads live.
- Fresh mainnet deployer: **0x8847D9bda887E936299C1230eB799b3F504a7c8B**,
  key ONLY in `.env.mainnet` (chmod 600), never the testnet deployer.
  Balance 0.0 BNB — nothing spent.
- Funding requested: **0.002 BNB (~$1.40)** — BNB $699.47, gas 0.05 gwei
  (block 131281470); deploy 1,811,397 gas = 0.00009057 BNB (~$0.063) at
  current gas, 0.002 BNB covers up to ~1.1 gwei. SIGMA's 0.001 BNB would
  only cover to ~0.55 gwei. Script guard (est. cost x2 + 0.0005 floor)
  proven by `--estimate` refusing with balance 0.0.
- Script: `scripts/deploy-mainnet.js` (chain 56, real registry, owner =
  user wallet, no mock, no minting, no setBaseURI; writes
  `deployment-mainnet.json`). RPC fallback list added after
  bsc-dataseed.binance.org 403'd once then recovered.
- Full checklist: `PREDEPLOY-CHECKLIST.md`.
- NOT done at prep time: funding the deployer, the deploy itself, Sourcify + BscScan
  mainnet verification, leftover-BNB return, setBaseURI, launch post.
  (All but setBaseURI / launch post are now done — see below.)

## Gate 6 — MAINNET DEPLOYED + VERIFIED 2026-11-02 ~17:44 GMT

- Funding: user sent **0.002 BNB** to the deployer (verified on 2 RPCs).
- Contract (MAINNET, live): **0x9eec890f05a7f60452574FF4Ae98F5Ae31B621B2**
  Deploy tx: **0xf49bbcc4fa37ba29a84f5e79d435f965c416ce300ba343986f6c8933854e4500**,
  block **131282638**, receipt status **1**, gas **1,811,397** at 0.05 gwei,
  deploy cost **0.00009056985 BNB**. Deployed 2026-11-02 ~17:36 GMT.
- On-chain state verified by Muse on BSC mainnet RPC (re-checked independently
  2026-11-02 ~17:43 GMT): name Agent Key Pass, symbol AKEY, owner = user wallet
  0x75d251Ba39dED2E456d9f6DD776f77d422864403, registry = real
  0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F, MAX 444, FREE 77,
  PAID_PRICE 0.00142 ether, royaltyInfo 5% to owner, freeOpen true,
  paidOpen false, contract balance 0.0 BNB, tokenURI(1) "" (baseURI not set yet).
- Verification: **Sourcify exact_match, matchId 58107757**, verified
  2026-11-02T17:43:46Z (verification/sourcify-mainnet-result.json, standard
  JSON solc 0.8.26, Cancun, optimizer 200, constructor args real registry +
  user wallet). **BscScan mainnet VERIFIED via Sourcify forwarding** —
  getsourcecode chain 56 returns ContractName AgentKeyPass, v0.8.26+commit.8a97fa7a,
  optimization 1, runs 200, EVM cancun, SourceCode 176,971 chars
  (verification/bscscan-mainnet-result.json). The BscScan API key worked via
  the surrogate route — no manual website form was needed.
- Leftover return: deployer held 0.00190943015 BNB after deploy; **0.0019 BNB
  returned to the user wallet**, tx **0xf16e8465eb19979f61035fb5c6bd7e62cd264796b773ee860afbf110f0224498**,
  block 131283148, receipt status 1, gas 21,000. Deployer left with
  0.00000838015 BNB (near zero). User wallet balance after return:
  0.005694545539589172 BNB. Script: scripts/return-leftover-mainnet.mjs.
- Early free mints (before any announcement — radars detect verified contracts
  fast): **4 free mints by ~17:43 GMT**, all genuine Agent ID holders
  (registry balanceOf = 1), distinct wallets, freeRemaining 73, paidRemaining 367:
  #1 0x2648157127A212cE73d9E6AF9D57A169680164C9,
  #2 0xAC36961b7D0f46a742d9DC471bAF0F8428ac7c0B,
  #3 0xbE2AFf3C77E5947908d50f9dB5024A57d5CAC20a,
  #4 0xa6bEd08f06102E0ea1F5c1326B5aac85B2A26431.
  Mint tx hashes: lookup pending — get via BscScan; public RPC eth_getLogs is
  rate-limited (-32005) on bsc-dataseed.binance.org and
  bsc-dataseed1.defibit.io (one attempt each 2026-11-02 ~17:42 GMT, not looped).
- Harness notes: (1) The deploy script's post-deploy "totalSupply 0" check
  FAILED because 2 free mints landed within seconds of deploy — NOT a contract
  problem, the expectation was wrong (contract was live and mintable immediately).
  (2) The deploy script then crashed on a bug at (old) line 185:
  `(await akey.tokenURI(1)).catch(...)` — `.catch` called on an awaited string —
  so `deployment-mainnet.json` was never written by the deploy run. Fixed
  2026-11-02 ~17:42 GMT (try/catch around the tokenURI call, `node --check`
  clean); deploy was NOT re-run. File written afterwards:
  `deployment-mainnet.json` (contract, tx, block, gas, cost, checks, mints,
  verification, return tx).
- NOT done: setBaseURI on mainnet (owner-only, needs live Cloudflare site URL +
  user-wallet signature — site still being created by the user); launch post
  (do NOT announce minting live before tokenURI(1) loads live); real-phone
  checker test after the site is live.

## Gate 4b — site v3 (mainnet + dark desktop) COMPLETE 2026-11-02 ~18:51 GMT

- Mirrors the artifact agent-key-pass-mint-site mainnet update into the
  Cloudflare deploy package. The v2 package
  (site-deploy-v2-2026-11-02-testnet-verified.zip) is the OLD pre-mainnet
  version saying NOT DEPLOYED YET — do NOT upload v2. Upload v3.
- Package: **akey-site-deploy-v3-2026-11-02-mainnet-dark-desktop.zip**
  (664,074 bytes, 447 files total: index.html, llms.txt,
  agent-key-pass.webp + 444 extensionless metadata files), testzip clean.
- Mainnet state in site/index.html + site/llms.txt: contract
  0x9eec890f05a7f60452574FF4Ae98F5Ae31B621B2, deploy tx
  0xf49bbcc4fa37ba29a84f5e79d435f965c416ce300ba343986f6c8933854e4500,
  block 131282638, Sourcify exact match 58107757, BscScan verified.
  Live snapshot written in (read on-chain 2026-11-02 18:50:30 UTC, re-read
  to confirm — unchanged from the 18:49 read): totalSupply 78 (77 free +
  1 paid), free 77/77 SOLD OUT, paid OPEN, paidRemaining 366, paid price
  0.00142 BNB, max 3/tx, contract holds 0.00142 BNB. Page also refreshes
  the counts live from the contract on load; checker reads the real
  mainnet registry + live contract (freeMinted, balanceOf); browser mint
  targets mainnet with paid enabled and free disabled as sold out.
- Proper headers: <title> "Agent Key Pass (AKEY) — Binance Agent ID Pass",
  meta description, theme-color #0d0b08, Open Graph + Twitter card tags
  with og:image on the IPFS art gateway URL, plus visible section headers
  (Live status, 1. Check your wallet, What a Key Pass is, 2. Mint with
  your own AI agent, 3. Mint here in the browser, Technical details).
- Dark desktop: the workspace file was already dark on desktop; the
  900px+ media query only darkened the body to #0a0908 vs mobile #0d0b08.
  Aligned exactly to mobile: `@media (min-width: 900px) { body {
  background: #0d0b08; } .card { background: #171310; } }`. Mobile
  below 900px unchanged; same content, order and layout; one gold accent
  #c9a227 throughout.
- Greps on staged site-deploy/: "NOT DEPLOYED YET" = 0 (exact and any
  case); testnet contract 0x9E52aa8073F37C075822F4fEd6F33B8a7954D028 = 1
  mention total, in the index.html footer, labelled SUPERSEDED (llms.txt
  refers to the testnet deployment without its address). Inline JS
  `node --check` clean.
- Local verification (python http.server over site-deploy/, fresh port):
  homepage **200** (22,687 B), `/metadata/1` **200**, `/metadata/444`
  **200**, `/llms.txt` **200**, `/agent-key-pass.webp` **200** (356,518 B).
  NOTE: the first HTTP run hit a stale server on the old port and returned
  404s for /metadata/444 and the webp — re-run on a fresh port with the
  files verified on disk first, all 5 paths returned 200 with matching
  byte sizes. No stray server left running.
- baseURI still NOT set on mainnet (owner sets it once the Cloudflare site
  is live) — the site says so in the honest-notes section and does not
  claim token art loads on-chain. Not-audited note and no
  floor/returns/APY/dated-token promises kept.

## Playbook

Follow ~/workspace/custom-skills/agent-mint-launch/SKILL.md (gates 0-8)
and ~/workspace/agent-mint-launch/SECOND-CONTRACT-PLAYBOOK.md §0 (M1-M23).
Template contract: ~/workspace/seven-sigma/contracts/SevenSigma.sol
— copy it, change only name/symbol/supply/free/price.
CRITICAL: paid mint() must NOT check Agent ID (freeMint() must).
