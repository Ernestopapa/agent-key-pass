# Gate 2a — Static scans, 2026-11-02

Tools (reused from SEVEN SIGMA, not newly installed):
- Slither 0.11.6 (venv `~/.venvs/slither`), solc binary 0.8.26+commit.8a97fa7a (`~/.local/bin/solc`)
- Aderyn 0.6.8 (`~/.local/bin/aderyn`)
- Raw outputs: `scans/slither-2026-11-02.txt`, `scans/aderyn-2026-11-02.json` (+ `.log`)

## Slither 0.11.6 — 69 results total, 25 contracts analysed

Command: `slither contracts/AgentKeyPass.sol --solc ~/.local/bin/solc --solc-remaps "@openzeppelin/=node_modules/@openzeppelin/"`
(Slither exits 255 when findings exist — same as the SIGMA run; the
output file is the evidence, not the exit code.)

- 64 of the 69 results are inside `node_modules/@openzeppelin/`
  (Math.mulDiv, Bytes, Strings, StorageSlot, Context, ERC2981, ERC721
  internals): incorrect-exp, divide-before-multiply, assembly,
  dead-code, too-many-digits, solc-version (broad OZ pragma ranges).
  Known, audited OpenZeppelin v5.6.1 library internals, identical to
  the NFOX and SIGMA builds. No action.
- 5 results touch `contracts/AgentKeyPass.sol` itself, all
  informational/low, none a real vulnerability — identical to SIGMA:

| Detector | Location | Verdict |
|---|---|---|
| reentrancy-no-eth | `mint()` #150-164 — `_safeMint` then `_nextId++` in loop | Mitigated. `mint()` is `nonReentrant`; per iteration the id is assigned BEFORE `_safeMint`; `paidMinted` and the supply cap are checked before the loop; loop max 3. |
| reentrancy-events | `withdraw()` #168-174 — event emitted after the low-level call | Informational. `withdraw()` is `onlyOwner`; balance is read into `amount` BEFORE the call, so a re-entrant `withdraw` during the callback sees balance 0 and reverts on "nothing to withdraw". No double-spend. |
| low-level-calls | `withdraw()` — `owner().call{value: amount}()` | Known pattern, same as NFOX/SIGMA. Return value checked (`require(ok)`). |
| costly-loop | `mint()` — `_nextId++` (SSTORE) inside loop | Intentional, max 3 iterations, negligible gas (paid x3 = 122,431 gas local). |
| pragma / solc-version | `^0.8.26` in AgentKeyPass; OZ files use `^0.8.20` etc. | Not applicable to the deployed bytecode: the build pins solc to exactly 0.8.26. |

## Aderyn 0.6.8 — 1 high, 7 low

Caveat: Aderyn compiled with its own bundled solc v0.8.33 / EVM Prague,
not the project's pinned solc 0.8.26 / Cancun. Findings are pattern-based
and still valid for review.

### High (1) — FALSE POSITIVE (same as SIGMA)
- `reentrancy-state-change` in `freeMint()`, reported at line 135.
  The hint lists `freeMinted[msg.sender] = true`, `_freeCount += 1`,
  `uint256 tokenId = _nextId++` as "state changed after an external call".
  In the actual code those writes are ALL BEFORE `_safeMint` — i.e. the
  checks-effects-interactions pattern is followed — and `freeMint()` is
  `nonReentrant`. The only thing after the external call is the
  `FreeMinted` event emit. No re-entrancy path exists. No fix needed.

### Low (7) — all known / intentional (same as SIGMA)
- `centralization-risk`: documented owner powers (constructor royalty,
  `setBaseURI`, `withdraw`); mock `setAgent`/`setAgents` is testnet-only.
- `costly-loop` (`mint()` line 159; mock `setAgents`): intentional, max 3.
- `unspecific-pragma` (`^0.8.26`, compiler pinned to exactly 0.8.26).
- `public-view-functions` (standard API views).
- PUSH0 note: BSC supports Cancun.

## Verdict

No new issues vs NFOX / SEVEN SIGMA. No real vulnerability found.
Gate 2a passes with the same documented false positive as SIGMA.
