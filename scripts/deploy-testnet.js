// Deploy AgentKeyPass + AgentIdRegistryMock to BSC TESTNET (chain 97).
// TESTNET ONLY. Never point this at mainnet, never use the user's real
// wallet key. The deployer is a FRESH throwaway wallet generated locally
// and stored in .env.testnet (chmod 600). Only its ADDRESS is recorded
// in deployment-testnet.json / SPECS.md / reports.
//
// Owner on testnet = user wallet 0x75d251Ba39dED2E456d9f6DD776f77d422864403
// (same as mainnet will be). Consequence: withdraw() and setBaseURI()
// are owner-only, so they CANNOT be executed live on testnet by the
// deployer — they are proven locally (44/44 Anvil) and the live script
// records the non-owner revert + the contract's held balance instead.
// setBaseURI is NOT attempted here at all (site is not live yet).
//
// Usage:
//   node scripts/deploy-testnet.js            # deploy + run live tests
//   node scripts/deploy-testnet.js --estimate # gas estimate only, no deploy
// The deployer needs >= 0.025 tBNB: deploys (~2.1M gas) + setAgents batches
// + funding 77 agent test wallets (0.0001 tBNB each for free-mint gas)
// + funding the plain test wallet for paid mints. One faucet claim
// (~0.1 tBNB) is more than enough. If the balance is lower the script
// stops (exit 2) with faucet instructions. Fund it, then re-run.
// Faucet: https://testnet.bnbchain.org/faucet-smart
import { ethers } from "ethers";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RPC = "https://data-seed-prebsc-1-s1.binance.org:8545/";
const CHAIN_ID = 97;
const FAUCET = "https://testnet.bnbchain.org/faucet-smart";
const ENV_FILE = path.join(root, ".env.testnet");
const DEPLOY_FILE = path.join(root, "deployment-testnet.json");
const TESTS_FILE = path.join(root, "testnet-live-tests.json");
const WALLETS_FILE = path.join(root, "test-wallets-testnet.json");
// MIN_BALANCE lowered 2026-11-02 by the testnet runner: deployer holds exactly
// 0.02 tBNB (verified on-chain, 2 RPCs, gas 0.1 gwei). Actual need at 0.1 gwei:
// deploys 2,138,974 gas = 0.000214 + setAgents ~1.8M gas = 0.00018 +
// 79 funding transfers ~1.66M gas = 0.000166 + funding value 0.0187
// = ~0.0193 tBNB total, leaving ~0.0007 surplus. The old 0.025 was a
// conservative buffer, not a hard requirement. Do NOT lower this further.
const MIN_BALANCE = ethers.parseEther("0.0195");
const FREE_COUNT = 77;
const PAID_PRICE = ethers.parseEther("0.00142");
const USER_WALLET = "0x75d251Ba39dED2E456d9f6DD776f77d422864403";

function loadArtifact(name) {
  return JSON.parse(fs.readFileSync(path.join(root, "build", `${name}.json`), "utf8"));
}
function loadEnv() {
  const out = {};
  if (fs.existsSync(ENV_FILE)) {
    for (const line of fs.readFileSync(ENV_FILE, "utf8").split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].trim();
    }
  }
  return out;
}

const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID);
const env = loadEnv();
let deployer;
if (env.DEPLOYER_PRIVATE_KEY) {
  deployer = new ethers.Wallet(env.DEPLOYER_PRIVATE_KEY, provider);
} else {
  deployer = ethers.Wallet.createRandom().connect(provider);
  fs.writeFileSync(
    ENV_FILE,
    `# TESTNET-ONLY throwaway deployer — never fund with real BNB, never use on mainnet.\n# Address: ${deployer.address}\nDEPLOYER_PRIVATE_KEY=${deployer.privateKey}\n`,
    { mode: 0o600 }
  );
  console.log("Generated fresh throwaway testnet deployer.");
}
console.log("Deployer address:", deployer.address);

const balance = await provider.getBalance(deployer.address);
console.log("Deployer tBNB balance (on-chain):", ethers.formatEther(balance));
const feeData = await provider.getFeeData();
console.log("Testnet gas price:", feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, "gwei") + " gwei" : "n/a");

const mockArt = loadArtifact("AgentIdRegistryMock");
const akeyArt = loadArtifact("AgentKeyPass");
const mockFactory = new ethers.ContractFactory(mockArt.abi, mockArt.bytecode, deployer);
const akeyFactory = new ethers.ContractFactory(akeyArt.abi, akeyArt.bytecode, deployer);
try {
  const mockTx = await mockFactory.getDeployTransaction(deployer.address);
  const akeyTx = await akeyFactory.getDeployTransaction(deployer.address, USER_WALLET);
  const mockGas = await provider.estimateGas({ ...mockTx, from: deployer.address });
  const akeyGas = await provider.estimateGas({ ...akeyTx, from: deployer.address });
  const price = feeData.gasPrice ?? 3_000_000_000n;
  console.log(`Est. deploy gas: mock ${mockGas}, AgentKeyPass ${akeyGas} (total ${mockGas + akeyGas})`);
  console.log(`Est. deploy cost at ${ethers.formatUnits(price, "gwei")} gwei: ${ethers.formatEther((mockGas + akeyGas) * price)} tBNB`);
  console.log(`Plus ~0.02 tBNB to fund 77 agent test wallets + paid-test wallet. Total needed: ~0.025 tBNB (one faucet claim of ~0.1 tBNB is plenty).`);
} catch (e) {
  console.log("Gas estimate failed (RPC may need a funded from-address):", e.message);
}

if (process.argv.includes("--estimate")) process.exit(0);

if (balance < MIN_BALANCE) {
  console.log("\n=== BLOCKED: testnet deployer needs tBNB ===");
  console.log(`1. Open ${FAUCET}`);
  console.log(`2. Paste this address: ${deployer.address}`);
  console.log(`3. Claim testnet BNB (faucet gives ~0.1 tBNB per claim; one claim is plenty).`);
  console.log("4. Re-run: node scripts/deploy-testnet.js");
  console.log("   (Key is saved in .env.testnet — never share it, never fund it with real BNB.)");
  console.log("   Verify the balance on-chain before re-running: the script reads it first.");
  process.exit(2);
}

const tests = [];
function record(name, ok, detail) {
  tests.push({ name, ok, detail });
  console.log(`TEST ${name}: ${ok ? "OK" : "FAIL"}${detail ? " — " + detail : ""}`);
}

console.log("\nDeploying AgentIdRegistryMock...");
const mock = await mockFactory.deploy(deployer.address);
await mock.waitForDeployment();
const mockAddr = await mock.getAddress();
const mockRc = await (await mock.deploymentTransaction().wait());
console.log("Mock deployed:", mockAddr, "tx", mock.deploymentTransaction().hash, "gas", mockRc.gasUsed.toString());

// 77 agent test wallets (one free mint each) + 1 plain wallet (never an agent).
const agentWallets = Array.from({ length: FREE_COUNT }, () => ethers.Wallet.createRandom().connect(provider));
const plainWallet = ethers.Wallet.createRandom().connect(provider);
console.log("Agent test wallets: 77 generated. Plain test wallet:", plainWallet.address);
// Persist test wallets IMMEDIATELY (lesson from the 2026-11-02 SIGMA crash).
fs.writeFileSync(
  WALLETS_FILE,
  JSON.stringify(
    {
      note: "TESTNET-ONLY throwaway wallets. Never use on mainnet, never fund with real BNB.",
      agents: agentWallets.map((w) => ({ address: w.address, privateKey: w.privateKey })),
      plain: { address: plainWallet.address, privateKey: plainWallet.privateKey },
    },
    null,
    2
  ),
  { mode: 0o600 }
);
console.log("Test wallets saved to test-wallets-testnet.json (before any deploy).");
for (let i = 0; i < agentWallets.length; i += 50) {
  const batch = agentWallets.slice(i, i + 50).map((w) => w.address);
  await (await mock.setAgents(batch, true)).wait();
  console.log(`Mock: agents ${i + 1}-${i + batch.length} marked as Agent ID holders.`);
}

console.log(`Deploying AgentKeyPass (owner = user wallet ${USER_WALLET}, TESTNET ONLY)...`);
const akey = await akeyFactory.deploy(mockAddr, USER_WALLET);
await akey.waitForDeployment();
const akeyAddr = await akey.getAddress();
const akeyRc = await (await akey.deploymentTransaction().wait());
console.log("AgentKeyPass deployed:", akeyAddr, "tx", akey.deploymentTransaction().hash, "gas", akeyRc.gasUsed.toString());

// On-chain constants / owner check right after deploy
record("name/symbol", (await akey.name()) === "Agent Key Pass" && (await akey.symbol()) === "AKEY", `${await akey.name()} / ${await akey.symbol()}`);
record(
  "constants + owner is user wallet",
  (await akey.MAX_SUPPLY()) === 444n && (await akey.FREE_SUPPLY()) === 77n && (await akey.PAID_PRICE()) === PAID_PRICE && (await akey.owner()) === USER_WALLET,
  `owner ${await akey.owner()}`
);
record("totalSupply 0 / freeOpen true / paidOpen false at start", (await akey.totalSupply()) === 0n && (await akey.freeOpen()) === true && (await akey.paidOpen()) === false, "");

// Fund test wallets: agents need free-mint gas only; plain needs paid price + gas.
// agentWallets[0] also gets an extra 0.005 tBNB for the agent paid-mint x3
// test (0.00426) — lesson from the 2026-11-02 SIGMA crash.
for (const w of agentWallets) {
  await (await deployer.sendTransaction({ to: w.address, value: ethers.parseEther("0.0001") })).wait();
}
await (await deployer.sendTransaction({ to: agentWallets[0].address, value: ethers.parseEther("0.005") })).wait();
await (await deployer.sendTransaction({ to: plainWallet.address, value: ethers.parseEther("0.006") })).wait();
console.log("Test wallets funded.");

// --- Live test 1: freeMint succeeds for Agent ID holder ---
const tx1 = await akey.connect(agentWallets[0]).freeMint();
const rc1 = await tx1.wait();
record("freeMint (agent wallet)", (await akey.ownerOf(1)) === agentWallets[0].address, `tx ${tx1.hash} gas ${rc1.gasUsed} token #1`);

// --- Live test 2: second freeMint from same wallet must revert ---
try {
  await (await akey.connect(agentWallets[0]).freeMint()).wait();
  record("double freeMint reverts", false, "second mint succeeded (BUG)");
} catch (e) {
  record("double freeMint reverts", /already claimed free/.test(e.message), String(e.message).slice(0, 100));
}

// --- Live test 3: non-Agent wallet must revert on freeMint ---
try {
  await (await akey.connect(plainWallet).freeMint()).wait();
  record("freeMint (non-agent) reverts", false, "non-agent minted (BUG)");
} catch (e) {
  record("freeMint (non-agent) reverts", /no Agent ID/.test(e.message), String(e.message).slice(0, 100));
}

// --- Live test 4: paid mint is blocked while free supply remains ---
// Use the FUNDED plain wallet (0.006 tBNB) so the revert is proven to come
// from the contract ("paid mint not open yet"), not from insufficient funds.
try {
  await (await akey.connect(plainWallet).mint(1, { value: PAID_PRICE })).wait();
  record("paid mint blocked during free phase", false, "paid mint succeeded early (BUG)");
} catch (e) {
  record("paid mint blocked during free phase", /paid mint not open yet/.test(e.message), String(e.message).slice(0, 100));
}

// --- Exhaust the free 77 ---
console.log(`\nExhausting free supply: ${FREE_COUNT - 1} more agent free mints...`);
let lastFreeTx = tx1.hash;
for (let i = 1; i < agentWallets.length; i++) {
  const tx = await akey.connect(agentWallets[i]).freeMint();
  const rc = await tx.wait();
  lastFreeTx = tx.hash;
  if ((i + 1) % 25 === 0) console.log(`  free mints done: ${i + 1}/77 (last tx ${tx.hash.slice(0, 18)}..., gas ${rc.gasUsed})`);
}
const freeCount = await akey.freeMintedCount();
record("free supply exhausted (77/77)", freeCount === 77n, `freeMintedCount=${freeCount} last tx ${lastFreeTx}`);
record("freeRemaining 0 / paidOpen true", (await akey.freeRemaining()) === 0n && (await akey.paidOpen()) === true, "");

// --- CRITICAL live test 5: non-agent CAN paid-mint after free exhaustion ---
const txP1 = await akey.connect(plainWallet).mint(1, { value: PAID_PRICE });
const rcP1 = await txP1.wait();
record(
  "paid mint x1 (NON-AGENT) succeeds after free exhaustion",
  (await akey.ownerOf(78)) === plainWallet.address,
  `tx ${txP1.hash} gas ${rcP1.gasUsed} token #78`
);

// --- Live test 6: agent paid mint x3 ---
const txP3 = await akey.connect(agentWallets[0]).mint(3, { value: PAID_PRICE * 3n });
const rcP3 = await txP3.wait();
record("paid mint x3 (agent) succeeds", (await akey.ownerOf(81)) === agentWallets[0].address, `tx ${txP3.hash} gas ${rcP3.gasUsed} tokens #79-81`);

// --- Live test 7: qty 4 must revert ---
try {
  await (await akey.connect(plainWallet).mint(4, { value: PAID_PRICE * 4n })).wait();
  record("paid mint qty 4 reverts", false, "qty 4 succeeded (BUG)");
} catch (e) {
  record("paid mint qty 4 reverts", /qty 1\.\.3/.test(e.message), String(e.message).slice(0, 100));
}

// --- Live test 8: wrong price must revert ---
try {
  await (await akey.connect(plainWallet).mint(1, { value: ethers.parseEther("0.0004") })).wait();
  record("paid mint wrong price reverts", false, "wrong price succeeded (BUG)");
} catch (e) {
  record("paid mint wrong price reverts", /wrong price/.test(e.message), String(e.message).slice(0, 100));
}

// --- On-chain reads ---
const reads = {
  owner: await akey.owner(),
  totalSupply: (await akey.totalSupply()).toString(),
  freeMintedCount: (await akey.freeMintedCount()).toString(),
  freeRemaining: (await akey.freeRemaining()).toString(),
  paidRemaining: (await akey.paidRemaining()).toString(),
  freeOpen: await akey.freeOpen(),
  paidOpen: await akey.paidOpen(),
  royalty: await akey.royaltyInfo(78, ethers.parseEther("1")),
};
console.log("\nOn-chain reads:", JSON.stringify({ ...reads, royalty: [reads.royalty[0], reads.royalty[1].toString()] }, null, 2));
record("royaltyInfo 5% to owner (user wallet)", reads.royalty[1] === ethers.parseEther("0.05") && reads.royalty[0] === USER_WALLET, `receiver ${reads.royalty[0]} amount ${ethers.formatEther(reads.royalty[1])} tBNB on 1 tBNB sale`);

// --- Withdraw: owner is the USER wallet, deployer is NOT owner ---
// Live withdraw by the deployer must revert (onlyOwner). The owner
// withdraw itself is proven locally (44/44 Anvil) and cannot be signed
// live without the user wallet. Contract balance after the paid tests
// should be 0.00142 + 0.00426 = 0.00568 tBNB, held for the owner.
const contractBal = await provider.send("eth_getBalance", [akeyAddr, "latest"]);
record("contract holds paid tBNB 0.00568 for owner", BigInt(contractBal) === ethers.parseEther("0.00568"), `${ethers.formatEther(contractBal)} tBNB`);
try {
  await (await akey.connect(deployer).withdraw()).wait();
  record("non-owner (deployer) withdraw reverts", false, "withdraw succeeded (BUG)");
} catch (e) {
  record("non-owner (deployer) withdraw reverts", /OwnableUnauthorizedAccount/.test(e.message), String(e.message).slice(0, 120));
}

const deployment = {
  network: "BSC testnet",
  chainId: CHAIN_ID,
  deployedAt: new Date().toISOString(),
  deployer: deployer.address,
  mockRegistry: mockAddr,
  mockDeployTx: mock.deploymentTransaction().hash,
  mockDeployGas: mockRc.gasUsed.toString(),
  agentKeyPass: akeyAddr,
  agentKeyPassDeployTx: akey.deploymentTransaction().hash,
  agentKeyPassDeployGas: akeyRc.gasUsed.toString(),
  owner: USER_WALLET,
  agentTestWallets: agentWallets.map((w) => w.address),
  plainTestWallet: plainWallet.address,
  freeMintTx: tx1.hash,
  freeMintGas: rc1.gasUsed.toString(),
  lastFreeMintTx: lastFreeTx,
  nonAgentPaidMintTx: txP1.hash,
  nonAgentPaidMintGas: rcP1.gasUsed.toString(),
  agentPaidMintX3Tx: txP3.hash,
  agentPaidMintX3Gas: rcP3.gasUsed.toString(),
  contractBalanceAfterTestsTBNB: ethers.formatEther(contractBal),
  onChainReads: { ...reads, royalty: [reads.royalty[0], reads.royalty[1].toString()] },
  note: "TESTNET ONLY — SUPERSEDED contract, never point minters at it. Private keys are in .env.testnet / test-wallets-testnet.json (throwaway wallets). Never use on mainnet. Owner is the user wallet, so withdraw/setBaseURI need the user wallet to sign.",
};
fs.writeFileSync(DEPLOY_FILE, JSON.stringify(deployment, null, 2));
fs.writeFileSync(TESTS_FILE, JSON.stringify({ network: "BSC testnet", chainId: CHAIN_ID, at: new Date().toISOString(), tests }, null, 2));
console.log("\nSaved:", DEPLOY_FILE, "and", TESTS_FILE);
console.log("Verify on BscScan testnet: https://testnet.bscscan.com/address/" + akeyAddr);
const failed = tests.filter((t) => !t.ok);
if (failed.length) {
  console.log(`\n${failed.length} LIVE TEST(S) FAILED — do not proceed to mainnet.`);
  process.exit(1);
}
console.log(`\nAll ${tests.length} live tests passed.`);
