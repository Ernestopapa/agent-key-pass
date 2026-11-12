// Generate Agent Key Pass metadata: 444 extensionless files ONLY (1..444).
// No .json duplicates — this is how the Cloudflare deploy stays under
// 1,000 files (444 metadata + ~15 site files = ~459).
// Image: single shared art on IPFS, CID passed in via --cid (or env AKEY_CID).
// Usage: node scripts/generate-metadata.mjs --cid <CID>
// Writes metadata/1 .. metadata/444 (extensionless, JSON content).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const cidIdx = args.indexOf("--cid");
const CID = cidIdx >= 0 ? args[cidIdx + 1] : process.env.AKEY_CID;
if (!CID || !/^bafybei|^bafkrei/.test(CID)) {
  console.error("Usage: node scripts/generate-metadata.mjs --cid <IPFS CID>");
  process.exit(1);
}

const IMAGE = `ipfs://${CID}`;
const DESCRIPTION =
  "Agent Key Pass (AKEY) — 444 transferable Passes on BNB Smart Chain. " +
  "77 free for Binance Agent ID holders (1 per wallet, gas only), then 367 paid " +
  "at 0.00142 BNB (~$1.00) each, open to all wallets. A Pass unlocks holder-only " +
  "companion mint access, raffle entries and advisory votes. Points are a score, " +
  "not a token, and do not entitle anyone to tokens or payouts. " +
  "The contract is not audited by a third party. No floor price, returns, APY, " +
  "dated token or airdrop, game, or merch is promised.";

const dir = path.join(root, "metadata");
fs.mkdirSync(dir, { recursive: true });
for (let id = 1; id <= 444; id++) {
  const origin = id <= 77 ? "Free" : "Paid";
  const meta = {
    name: `Agent Key Pass #${id}`,
    description: DESCRIPTION,
    image: IMAGE,
    attributes: [
      { trait_type: "Collection", value: "Agent Key Pass" },
      { trait_type: "Type", value: "Pass" },
      { trait_type: "Transferable", value: "Yes" },
      { trait_type: "Origin", value: origin },
      { trait_type: "Token ID", value: id },
    ],
  };
  fs.writeFileSync(path.join(dir, String(id)), JSON.stringify(meta, null, 2) + "\n");
}
const files = fs.readdirSync(dir);
console.log(`Wrote ${files.length} metadata files to metadata/ (1..444, extensionless only)`);
console.log(`Image: ${IMAGE}`);
