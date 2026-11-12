// Deploy AgentKeyPass to BSC MAINNET (chain 56).
// MAINNET — REAL BNB. Deploy ONLY after the user explicitly approves
// mainnet in the Agent Key Pass chat, and ONLY with the funded throwaway
// deployer in .env.mainnet (chmod 600). Never use the user's real wallet
// key, never use the testnet deployer key (.env.testnet) on mainnet.
//
// Constructor args (TRIPLE-CHECK before running):
//   agentIdRegistry_ = REAL Binance Agent ID registry
//     0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F
//   initialOwner     = user wallet 0x75d251Ba39dED2E456d9f6DD776f77d422864403
// NO mock registry on mainnet. Paid mint() has NO registry check by
// design (user-locked Gate 0: free Agent-only, paid open to everyone).
// Do NOT "fix" that — it is the locked spec, proven both ways in the
// 44/44 local suite and 16/16 live testnet tests.
//
// What this script does NOT do:
//   - No minting of any kind (minting on mainnet creates REAL tokens
//     and spends REAL BNB — never scripted here).
//   - No setBaseURI (owner-only; the user wallet signs that later,
//     after the Cloudflare site is live — see PREDEPLOY-CHECKLIST.md).
//   - No withdraw (owner-only; user wallet only).
//   - No verification submit (run Sourcify + BscScan verification
//     after deploy with verification/standard-json.json, solc 0.8.26,
//     Cancun, optimizer 200, exact constructor args above).
//
// Funding (2026-11-02 ~17:33 GMT, live checks):
//   BNB $699.47 (CoinGecko), mainnet gas 0.05 gwei (block 131281470).
//   Deploy gas 1,811,397 (proven on testnet) = 0.00009057 BNB (~$0.063)
//   at 0.05 gwei; 0.000181 BNB at 0.1 gwei; 0.000906 BNB at 0.5 gwei;
//   0.001811 BNB at 1 gwei. REQUESTED FUNDING: 0.002 BNB (~$1.40) —
//   covers deploy up to ~1.1 gwei, ~22x the cost at current gas.
//   The script aborts if the deployer balance is below the estimated
//   cost at current gas price x2 margin (or below a 0.0005 BNB floor).
//   Leftover BNB is returned to the user wallet after deploy; record
//   the return tx in deployment-mainnet.json / PREDEPLOY-CHECKLIST.md.
//
// Usage:
//   node scripts/deploy-mainnet.js --estimate   # gas estimate + balance check only, NO deploy
//   node scripts/deploy-mainnet.js              # deploy (needs funded deployer)
import { ethers } from "ethers";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// bsc-dataseed.binance.org intermittently 403s (seen 2026-11-02 ~17:34 GMT:
// 403 one minute, 200 the next). Try the seed list in order and use the
// first that answers eth_chainId with 56 — never fail a deploy on one
// flaky endpoint.
const RPCS = [
  "https://bsc-dataseed.binance.org/",
  "https://bsc-dataseed1.binance.org/",
  "https://bsc-dataseed2.binance.org/",
  "https://bsc-dataseed1.defibit.io/",
  "https://bsc-dataseed3.binance.org/",
];
const CHAIN_ID = 56;
const ENV_FILE = path.join(root, ".env.mainnet");
const DEPLOY_FILE = path.join(root, "deployment-mainnet.json");
const REGISTRY = "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F"; // REAL Binance Agent ID registry
const USER_WALLET = "0x75d251Ba39dED2E456d9f6DD776f77d422864403";
const PAID_PRICE = ethers.parseEther("0.00142");
const TESTNET_DEPLOYER = "0x4f034A86EF3B1DAE84Ccba9764564304d2821B98"; // must NEVER be reused on mainnet
const FUNDING_REQUESTED = "0.002"; // BNB — see header math
const MIN_BALANCE_FLOOR = ethers.parseEther("0.0005");

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

async function connectProvider() {
  for (const url of RPCS) {
    try {
      const p = new ethers.JsonRpcProvider(url, CHAIN_ID);
      const net = await p.getNetwork();
      if (Number(net.chainId) === CHAIN_ID) {
        console.log("Mainnet RPC:", url);
        return p;
      }
      console.log(`RPC ${url} answered wrong chain ${net.chainId} — trying next.`);
    } catch (e) {
      console.log(`RPC ${url} failed (${String(e.message).slice(0, 80)}) — trying next.`);
    }
  }
  console.log("BLOCKED: no mainnet RPC answered. Check network and re-run.");
  process.exit(2);
}
const provider = await connectProvider();
const env = loadEnv();
if (!env.DEPLOYER_PRIVATE_KEY) {
  console.log("BLOCKED: no DEPLOYER_PRIVATE_KEY in .env.mainnet. Generate it first (see PREDEPLOY-CHECKLIST.md).");
  process.exit(2);
}
const deployer = new ethers.Wallet(env.DEPLOYER_PRIVATE_KEY, provider);
if (deployer.address.toLowerCase() === TESTNET_DEPLOYER.toLowerCase()) {
  console.log("BLOCKED: deployer IS the testnet deployer. Never reuse a testnet key on mainnet.");
  process.exit(2);
}
if (deployer.address.toLowerCase() === USER_WALLET.toLowerCase()) {
  console.log("BLOCKED: deployer IS the user wallet. Mainnet deploys use a throwaway deployer only.");
  process.exit(2);
}
console.log("Mainnet deployer:", deployer.address);
console.log("Registry (real):", REGISTRY);
console.log("Owner (user wallet):", USER_WALLET);

const network = await provider.getNetwork();
if (Number(network.chainId) !== CHAIN_ID) {
  console.log(`BLOCKED: connected chain ${network.chainId}, expected ${CHAIN_ID}.`);
  process.exit(2);
}
const balance = await provider.getBalance(deployer.address);
console.log("Deployer BNB balance (on-chain):", ethers.formatEther(balance));
const feeData = await provider.getFeeData();
const gasPrice = feeData.gasPrice ?? 3_000_000_000n;
console.log("Mainnet gas price:", ethers.formatUnits(gasPrice, "gwei"), "gwei");

const akeyArt = loadArtifact("AgentKeyPass");
const akeyFactory = new ethers.ContractFactory(akeyArt.abi, akeyArt.bytecode, deployer);
const deployTx = await akeyFactory.getDeployTransaction(REGISTRY, USER_WALLET);
const estGas = await provider.estimateGas({ ...deployTx, from: deployer.address });
const estCost = estGas * gasPrice;
const required = estCost * 2n; // 2x margin for gas-price movement before inclusion
console.log(`Est. deploy gas: ${estGas} — cost at current gas: ${ethers.formatEther(estCost)} BNB (~$${(Number(ethers.formatEther(estCost)) * 699.47).toFixed(4)} at $699.47/BNB)`);
console.log(`Balance guard: need >= ${ethers.formatEther(required)} BNB (est. cost x2) and >= ${ethers.formatEther(MIN_BALANCE_FLOOR)} BNB floor.`);
console.log(`Funding requested from user: ${FUNDING_REQUESTED} BNB (covers deploy up to ~1.1 gwei).`);

if (process.argv.includes("--estimate")) {
  console.log(balance >= required && balance >= MIN_BALANCE_FLOOR ? "Estimate OK: balance covers deploy with margin." : "Estimate: balance INSUFFICIENT — fund the deployer before deploying.");
  process.exit(0);
}

if (balance < required || balance < MIN_BALANCE_FLOOR) {
  console.log("\n=== BLOCKED: mainnet deployer needs BNB ===");
  console.log(`1. Send ${FUNDING_REQUESTED} BNB (BSC mainnet, chain 56) to: ${deployer.address}`);
  console.log("2. Verify the balance on-chain, then re-run: node scripts/deploy-mainnet.js");
  console.log("   (Key is in .env.mainnet — never share it. Leftover BNB is returned to the user wallet after deploy.)");
  process.exit(2);
}

console.log("\nDeploying AgentKeyPass on MAINNET (owner = user wallet)...");
const akey = await akeyFactory.deploy(REGISTRY, USER_WALLET);
await akey.waitForDeployment();
const akeyAddr = await akey.getAddress();
const akeyRc = await akey.deploymentTransaction().wait();
console.log("AgentKeyPass deployed:", akeyAddr, "tx", akey.deploymentTransaction().hash, "gas", akeyRc.gasUsed.toString());

// On-chain checks immediately after deploy (read-only, no minting).
const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok, detail });
  console.log(`CHECK ${name}: ${ok ? "OK" : "FAIL"}${detail ? " — " + detail : ""}`);
}
check("name/symbol", (await akey.name()) === "Agent Key Pass" && (await akey.symbol()) === "AKEY", `${await akey.name()} / ${await akey.symbol()}`);
check(
  "constants + owner is user wallet + registry is real",
  (await akey.MAX_SUPPLY()) === 444n &&
    (await akey.FREE_SUPPLY()) === 77n &&
    (await akey.PAID_PRICE()) === PAID_PRICE &&
    (await akey.owner()) === USER_WALLET &&
    (await akey.agentIdRegistry()) === REGISTRY,
  `owner ${await akey.owner()} registry ${await akey.agentIdRegistry()}`
);
check(
  "totalSupply 0 / freeRemaining 77 / paidRemaining 367 / freeOpen true / paidOpen false",
  (await akey.totalSupply()) === 0n &&
    (await akey.freeRemaining()) === 77n &&
    (await akey.paidRemaining()) === 367n &&
    (await akey.freeOpen()) === true &&
    (await akey.paidOpen()) === false,
  ""
);
const royalty = await akey.royaltyInfo(1, ethers.parseEther("1"));
check("royaltyInfo 5% to owner", royalty[1] === ethers.parseEther("0.05") && royalty[0] === USER_WALLET, `receiver ${royalty[0]} amount ${ethers.formatEther(royalty[1])} BNB on 1 BNB sale`);
let tokenUri1 = "";
try { tokenUri1 = await akey.tokenURI(1); } catch { tokenUri1 = "<reverts>"; }
check("baseURI empty (setBaseURI pending live site)", tokenUri1 === "", `tokenURI(1) = ${JSON.stringify(tokenUri1)} — expected empty until the owner sets baseURI after the site is live`);

const leftover = await provider.getBalance(deployer.address);
const deployment = {
  network: "BSC mainnet",
  chainId: CHAIN_ID,
  deployedAt: new Date().toISOString(),
  deployer: deployer.address,
  registry: REGISTRY,
  agentKeyPass: akeyAddr,
  agentKeyPassDeployTx: akey.deploymentTransaction().hash,
  agentKeyPassDeployGas: akeyRc.gasUsed.toString(),
  deployCostBNB: ethers.formatEther(akeyRc.gasUsed * (akeyRc.gasPrice ?? gasPrice)),
  owner: USER_WALLET,
  fundingRequestedBNB: FUNDING_REQUESTED,
  deployerBalanceAfterDeployBNB: ethers.formatEther(leftover),
  leftoverReturnTx: null, // fill in after returning leftover BNB to the user wallet
  checks,
  note: "MAINNET. No mints were made by this script. setBaseURI is owner-only and pending the live Cloudflare site URL. Verify on Sourcify + BscScan with verification/standard-json.json (solc 0.8.26, Cancun, optimizer 200, constructor args registry + user wallet) before any launch post.",
};
fs.writeFileSync(DEPLOY_FILE, JSON.stringify(deployment, null, 2));
console.log("\nSaved:", DEPLOY_FILE);
console.log(`Deployer leftover: ${ethers.formatEther(leftover)} BNB — RETURN it to the user wallet ${USER_WALLET} and record the tx.`);
console.log("Verify on BscScan: https://bscscan.com/address/" + akeyAddr);
const failed = checks.filter((c) => !c.ok);
if (failed.length) {
  console.log(`\n${failed.length} POST-DEPLOY CHECK(S) FAILED — do not launch, do not post.`);
  process.exit(1);
}
console.log("\nAll post-deploy checks passed. Next: Sourcify + BscScan verification, then setBaseURI once the site is live.");
