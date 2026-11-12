// Verify AgentKeyPass on Sourcify MAINNET (chain 56) via the v2 API.
// Usage: node scripts/verify-sourcify-mainnet.mjs
// Reuses verification/standard-json.json (solc 0.8.26, Cancun, optimizer 200)
// written by the testnet verify run — same sources, same settings.
// No API key needed. Writes verification/sourcify-mainnet-result.json
// (testnet result stays in verification/sourcify-result.json).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ADDRESS = "0x9eec890f05a7f60452574FF4Ae98F5Ae31B621B2";
const CHAIN_ID = 56;
const CREATION_TX = "0xf49bbcc4fa37ba29a84f5e79d435f965c416ce300ba343986f6c8933854e4500";
const CONTRACT_ID = "AgentKeyPass.sol:AgentKeyPass";
const COMPILER_VERSION = "0.8.26+commit.8a97fa7a";
const SOURCIFY = "https://sourcify.dev/server";

const stdJsonInput = JSON.parse(
  fs.readFileSync(path.join(root, "verification", "standard-json.json"), "utf8")
);
console.log("stdJson sources:", Object.keys(stdJsonInput.sources).length, "settings:", JSON.stringify(stdJsonInput.settings));

// Check current status first
const statusRes = await fetch(
  `${SOURCIFY}/v2/contract/${CHAIN_ID}/${ADDRESS}`,
  { headers: { "User-Agent": "agent-key-pass/1.0" } }
);
const statusJson = await statusRes.json();
console.log("current Sourcify status:", JSON.stringify(statusJson).slice(0, 500));
if (statusJson.match || statusJson.creationMatch) {
  console.log("Already verified on Sourcify.");
  fs.writeFileSync(
    path.join(root, "verification", "sourcify-mainnet-result.json"),
    JSON.stringify({ alreadyVerified: true, status: statusJson }, null, 2)
  );
  process.exit(0);
}

const payload = {
  stdJsonInput,
  compilerVersion: COMPILER_VERSION,
  contractIdentifier: CONTRACT_ID,
  creationTransactionHash: CREATION_TX,
};

console.log("submitting to Sourcify v2 verify (chain 56)...");
const res = await fetch(`${SOURCIFY}/v2/verify/${CHAIN_ID}/${ADDRESS}`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "User-Agent": "agent-key-pass/1.0",
  },
  body: JSON.stringify(payload),
});
const body = await res.json();
console.log("submit HTTP", res.status, JSON.stringify(body).slice(0, 1000));
fs.writeFileSync(
  path.join(root, "verification", "sourcify-mainnet-result.json"),
  JSON.stringify({ submitStatus: res.status, submitBody: body }, null, 2)
);

const verificationId = body.verificationId;
if (!verificationId) {
  console.log("No verificationId returned — submission failed or already pending.");
  process.exit(1);
}

// Poll job status
for (let i = 0; i < 30; i++) {
  await new Promise((r) => setTimeout(r, 10000));
  const poll = await fetch(`${SOURCIFY}/v2/verify/${verificationId}`, {
    headers: { "User-Agent": "agent-key-pass/1.0" },
  });
  const pj = await poll.json();
  console.log(`poll ${i + 1}:`, JSON.stringify(pj).slice(0, 600));
  fs.writeFileSync(
    path.join(root, "verification", "sourcify-mainnet-result.json"),
    JSON.stringify({ submitStatus: res.status, submitBody: body, lastPoll: pj }, null, 2)
  );
  const s = (pj.status || pj.job?.status || "").toLowerCase();
  if (s === "done" || s === "failed" || pj.contract || pj.match) break;
}
console.log("done — see verification/sourcify-mainnet-result.json");
