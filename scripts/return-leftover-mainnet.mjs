// Return leftover deployer BNB to the user wallet after mainnet deploy.
// Usage: node scripts/return-leftover-mainnet.mjs
// Sends a fixed 0.0019 BNB (deployer held 0.00190943015 after deploy),
// leaving ~0.0000094 BNB — ~9x the ~0.00000105 BNB gas cost of this
// 21,000-gas transfer at 0.05 gwei. Key is read from .env.mainnet only
// and never printed. Verifies the receipt status on-chain.
import { ethers } from "ethers";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RPCS = [
  "https://bsc-dataseed.binance.org/",
  "https://bsc-dataseed1.binance.org/",
  "https://bsc-dataseed2.binance.org/",
  "https://bsc-dataseed1.defibit.io/",
  "https://bsc-dataseed3.binance.org/",
];
const USER_WALLET = "0x75d251Ba39dED2E456d9f6DD776f77d422864403";
const SEND = ethers.parseEther("0.0019");

const env = {};
for (const line of fs.readFileSync(path.join(root, ".env.mainnet"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
if (!env.DEPLOYER_PRIVATE_KEY) { console.log("BLOCKED: no DEPLOYER_PRIVATE_KEY in .env.mainnet."); process.exit(2); }

let provider = null;
for (const url of RPCS) {
  try {
    const p = new ethers.JsonRpcProvider(url, 56);
    if (Number((await p.getNetwork()).chainId) === 56) { provider = p; console.log("Mainnet RPC:", url); break; }
  } catch (e) { console.log(`RPC ${url} failed — trying next.`); }
}
if (!provider) { console.log("BLOCKED: no mainnet RPC answered."); process.exit(2); }

const deployer = new ethers.Wallet(env.DEPLOYER_PRIVATE_KEY, provider);
console.log("Deployer:", deployer.address);
const before = await provider.getBalance(deployer.address);
console.log("Deployer balance before return:", ethers.formatEther(before), "BNB");
if (before < SEND) { console.log("BLOCKED: balance below planned send amount."); process.exit(2); }

const tx = await deployer.sendTransaction({ to: USER_WALLET, value: SEND });
console.log("Return tx sent:", tx.hash);
const rc = await tx.wait();
console.log("Receipt status:", rc.status, "block:", rc.blockNumber, "gasUsed:", rc.gasUsed.toString());
const after = await provider.getBalance(deployer.address);
console.log("Deployer balance after return:", ethers.formatEther(after), "BNB");
console.log("User wallet balance now:", ethers.formatEther(await provider.getBalance(USER_WALLET)), "BNB");
if (rc.status !== 1) { console.log("RETURN TX FAILED on-chain."); process.exit(1); }
console.log("Leftover returned OK.");
