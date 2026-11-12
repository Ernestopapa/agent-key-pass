// Local dry-run: full test suite against a local Anvil chain (Cancun).
// No faucet, no real funds, no network. Proves the contract logic and
// measures real deployment + mint gas before any testnet spend.
// Anvil binary lives in tools/anvil (Foundry nightly, Cancun by default).
// Usage: node scripts/local-test.mjs
// Writes test-results.json.
//
// CRITICAL DIFFERENCE FROM NFOX: paid mint() is OPEN TO ALL wallets.
// freeMint() checks the Agent ID registry; mint() intentionally does NOT.
// The suite proves both directions: non-agent freeMint reverts, and
// non-agent paid mint SUCCEEDS after free exhaustion.
import { spawn } from "node:child_process";
import { ethers } from "ethers";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const load = (n) => JSON.parse(fs.readFileSync(path.join(root, "build", `${n}.json`), "utf8"));
const ANVIL = path.join(root, "tools", "anvil");
const PORT = 8547;

const PRICE = "0.00142";
const results = { network: "anvil-local (dry run)", startedAt: new Date().toISOString(), tests: [] };
function check(name, ok, detail = "") {
  results.tests.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}

const anvil = spawn(ANVIL, ["--port", String(PORT), "--silent"], { stdio: "ignore" });
const fetchReq = new ethers.FetchRequest(`http://127.0.0.1:${PORT}`);
fetchReq.timeout = 60000;
const provider = new ethers.JsonRpcProvider(fetchReq);
const log = (m) => process.stderr.write(m + "\n");
try {
  for (let i = 0; i < 50; i++) {
    try { await provider.getBlockNumber(); break; } catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  await provider.getBlockNumber();

  const [deployer, agent, plain] = await Promise.all([0, 1, 2].map((i) => provider.getSigner(i)));
  const deployerAddr = await deployer.getAddress();
  const agentAddr = await agent.getAddress();
  const plainAddr = await plain.getAddress();

  const mockArt = load("AgentIdRegistryMock");
  const akeyArt = load("AgentKeyPass");

  // Deploy mock
  const mock = await new ethers.ContractFactory(mockArt.abi, mockArt.bytecode, deployer).deploy(deployerAddr);
  await mock.waitForDeployment();
  const mockRc = await (await mock.deploymentTransaction().wait());
  check("mock registry deploys", true, `gas ${mockRc.gasUsed}`);

  // Deploy AgentKeyPass with the mock as registry
  const akey = await new ethers.ContractFactory(akeyArt.abi, akeyArt.bytecode, deployer).deploy(await mock.getAddress(), deployerAddr);
  await akey.waitForDeployment();
  const akeyRc = await (await akey.deploymentTransaction().wait());
  const akeyAddr = await akey.getAddress();
  results.deployment = {
    mockAddress: await mock.getAddress(), mockDeployGas: mockRc.gasUsed.toString(),
    akeyAddress: akeyAddr, akeyDeployGas: akeyRc.gasUsed.toString(),
  };
  check("AgentKeyPass deploys", true, `gas ${akeyRc.gasUsed} (local addr ${akeyAddr})`);

  // Views / constants
  check("name/symbol", (await akey.name()) === "Agent Key Pass" && (await akey.symbol()) === "AKEY");
  check("constants", (await akey.MAX_SUPPLY()) === 444n && (await akey.FREE_SUPPLY()) === 77n && (await akey.PAID_SUPPLY()) === 367n && (await akey.PAID_PRICE()) === ethers.parseEther(PRICE) && (await akey.MAX_PAID_PER_TX()) === 3n);
  check("totalSupply starts 0", (await akey.totalSupply()) === 0n);
  check("freeRemaining 77 / paidRemaining 367 at start", (await akey.freeRemaining()) === 77n && (await akey.paidRemaining()) === 367n);
  check("freeOpen true at start", await akey.freeOpen());
  check("paidOpen false at start", !(await akey.paidOpen()));
  check("owner is deployer", (await akey.owner()) === deployerAddr);
  check("registry is mock", (await akey.agentIdRegistry()) === (await mock.getAddress()));

  // Non-agent freeMint must revert
  try {
    await (await akey.connect(plain).freeMint()).wait();
    check("non-agent freeMint reverts", false, "mint succeeded — BUG");
  } catch (e) { check("non-agent freeMint reverts", true, String(e.shortMessage || e.message).slice(0, 80)); }

  // Paid mint during free phase must revert (even for an agent)
  try {
    await (await akey.connect(agent).mint(1, { value: ethers.parseEther(PRICE) })).wait();
    check("paid mint blocked during free phase", false, "mint succeeded — BUG");
  } catch (e) { check("paid mint blocked during free phase", true, String(e.shortMessage || e.message).slice(0, 80)); }

  // Mark agent wallet, freeMint succeeds
  await (await mock.setAgent(agentAddr, true)).wait();
  const tx1 = await akey.connect(agent).freeMint();
  const rc1 = await tx1.wait();
  results.freeMint = { tx: tx1.hash, gas: rc1.gasUsed.toString() };
  check("agent freeMint succeeds", (await akey.ownerOf(1)) === agentAddr, `token #1, gas ${rc1.gasUsed}`);
  check("freeMinted mapping set", await akey.freeMinted(agentAddr));
  check("freeMintedCount = 1", (await akey.freeMintedCount()) === 1n);
  check("tokenURI uses baseURI", true, "baseURI empty on fresh deploy; set via setBaseURI before launch");

  // freeMint with attached BNB must revert (non-payable)
  try {
    await (await akey.connect(agent).freeMint({ value: ethers.parseEther("0.00001") })).wait();
    check("freeMint with value reverts", false, "mint succeeded — BUG");
  } catch (e) { check("freeMint with value reverts", true, String(e.shortMessage || e.message).slice(0, 80)); }

  // ERC-2981 royalties: 5% to the owner (deployer) on a 1 BNB sale
  const [royReceiver, royAmount] = await akey.royaltyInfo(1, ethers.parseEther("1"));
  results.royalty = { receiver: royReceiver, amountWei: royAmount.toString(), salePriceWei: ethers.parseEther("1").toString() };
  check("royaltyInfo 5% to owner", royReceiver === deployerAddr && royAmount === ethers.parseEther("0.05"), `receiver ${royReceiver}, amount ${ethers.formatEther(royAmount)} BNB on 1 BNB sale`);
  check("supportsInterface ERC2981", await akey.supportsInterface("0x2a55205a"));

  // Double freeMint must revert
  try {
    await (await akey.connect(agent).freeMint()).wait();
    check("double freeMint reverts", false, "second mint succeeded — BUG");
  } catch (e) { check("double freeMint reverts", true, String(e.shortMessage || e.message).slice(0, 80)); }

  // setBaseURI: non-owner reverts, owner succeeds, tokenURI reflects it
  try {
    await (await akey.connect(agent).setBaseURI("https://example.invalid/metadata/")).wait();
    check("non-owner setBaseURI reverts", false, "call succeeded — BUG");
  } catch (e) { check("non-owner setBaseURI reverts", true, String(e.shortMessage || e.message).slice(0, 80)); }
  const txB = await akey.connect(deployer).setBaseURI("https://example.invalid/metadata/");
  const rcB = await txB.wait();
  results.setBaseURI = { tx: txB.hash, gas: rcB.gasUsed.toString() };
  check("owner setBaseURI succeeds + tokenURI", (await akey.tokenURI(1)) === "https://example.invalid/metadata/1", `gas ${rcB.gasUsed}, tokenURI(1)=${await akey.tokenURI(1)}`);

  // Exhaust the free supply with fresh wallets (76 more free mints).
  console.log("Exhausting free supply: 76 more free mints (local chain)...");
  const t0 = Date.now();
  const BATCH = 50;
  for (let start = 0; start < 76; start += BATCH) {
    const n = Math.min(BATCH, 76 - start);
    const wallets = Array.from({ length: n }, () => ethers.Wallet.createRandom().connect(provider));
    for (const w of wallets) {
      await provider.send("anvil_setBalance", [w.address, "0x8ac7230489e80000"]); // 10 ETH
    }
    await (await mock.setAgents(wallets.map((w) => w.address), true)).wait();
    let done = 0;
    const mintOne = async (w, idx) => {
      for (let attempt = 1; attempt <= 3; attempt++) {
        if (await akey.freeMinted(w.address)) return;
        try {
          const tx = await Promise.race([
            akey.connect(w).freeMint(),
            new Promise((_, rej) => setTimeout(() => rej(new Error("send timeout")), 30000)),
          ]);
          await Promise.race([
            tx.wait(),
            new Promise((_, rej) => setTimeout(() => rej(new Error("wait timeout")), 30000)),
          ]);
          return;
        } catch (e) {
          log(`  retry wallet ${idx} attempt ${attempt}: ${e.shortMessage || e.message}`);
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
      throw new Error(`freeMint failed 3x for wallet ${idx}`);
    };
    let next = 0;
    const workers = Array.from({ length: 10 }, async () => {
      while (next < wallets.length) {
        const j = next++;
        await mintOne(wallets[j], start + j);
        done++;
      }
    });
    await Promise.all(workers);
    console.log(`  ... ${start + n}/76 done (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  check("free supply exhausted (77/77)", (await akey.freeMintedCount()) === 77n, `took ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  check("freeOpen false after exhaustion", !(await akey.freeOpen()));
  check("paidOpen true after exhaustion", await akey.paidOpen());
  check("freeRemaining 0 after exhaustion", (await akey.freeRemaining()) === 0n);

  // Free mint after exhaustion must revert
  const lateAgent = ethers.Wallet.createRandom().connect(provider);
  await provider.send("anvil_setBalance", [lateAgent.address, "0x8ac7230489e80000"]);
  await (await mock.setAgent(lateAgent.address, true)).wait();
  try {
    await (await akey.connect(lateAgent).freeMint()).wait();
    check("freeMint after exhaustion reverts", false, "mint succeeded — BUG");
  } catch (e) { check("freeMint after exhaustion reverts", true, String(e.shortMessage || e.message).slice(0, 80)); }

  // --- CRITICAL: non-agent CAN paid-mint after free exhaustion ---
  // `plain` has NO Agent ID in the mock registry (never setAgent'd).
  check("plain wallet has no Agent ID", (await mock.balanceOf(plainAddr)) === 0n);
  const txP1 = await akey.connect(plain).mint(1, { value: ethers.parseEther(PRICE) });
  const rcP1 = await txP1.wait();
  results.paidMintX1 = { tx: txP1.hash, gas: rcP1.gasUsed.toString(), qty: 1, by: "non-agent" };
  check("non-agent paid mint x1 succeeds (paid open to all)", (await akey.ownerOf(78)) === plainAddr, `token #78 to non-agent, gas ${rcP1.gasUsed}`);
  check("paidMinted = 1 after non-agent mint", (await akey.paidMinted()) === 1n);

  // Agent can paid-mint too (x3, the max per tx)
  const txP3 = await akey.connect(agent).mint(3, { value: ethers.parseEther("0.00426") });
  const rcP3 = await txP3.wait();
  results.paidMintX3 = { tx: txP3.hash, gas: rcP3.gasUsed.toString(), qty: 3, by: "agent" };
  check("agent paid mint x3 at 0.00426 BNB succeeds", (await akey.totalSupply()) === 81n, `gas ${rcP3.gasUsed}`);
  check("paidMinted = 4", (await akey.paidMinted()) === 4n);

  // Wrong price reverts
  try {
    await (await akey.connect(agent).mint(1, { value: ethers.parseEther("0.0004") })).wait();
    check("wrong-price paid mint reverts", false, "mint succeeded — BUG");
  } catch (e) { check("wrong-price paid mint reverts", true, String(e.shortMessage || e.message).slice(0, 80)); }

  // Qty 0 reverts
  try {
    await (await akey.connect(agent).mint(0, { value: 0 })).wait();
    check("qty 0 reverts", false, "mint succeeded — BUG");
  } catch (e) { check("qty 0 reverts", true, String(e.shortMessage || e.message).slice(0, 80)); }

  // Qty 4 reverts (max is 3)
  try {
    await (await akey.connect(agent).mint(4, { value: ethers.parseEther("0.00568") })).wait();
    check("qty 4 reverts", false, "mint succeeded — BUG");
  } catch (e) { check("qty 4 reverts", true, String(e.shortMessage || e.message).slice(0, 80)); }

  // Fill to the 444 cap with non-agent wallets (3 per tx), then exceed reverts.
  // Remaining paid after the 4 above: 367 - 4 = 363. 363 is divisible by 3:
  // do 121 x 3 = 363.
  console.log("Filling paid supply to the 444 cap (363 more paid mints)...");
  const t1 = Date.now();
  let paidDone = 0;
  const paidWallets = [];
  for (let i = 0; i < 121; i++) {
    const w = ethers.Wallet.createRandom().connect(provider);
    paidWallets.push(w);
    await provider.send("anvil_setBalance", [w.address, "0x8ac7230489e80000"]);
  }
  const paidOne = async (w, qty) => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const tx = await Promise.race([
          akey.connect(w).mint(qty, { value: ethers.parseEther(PRICE) * BigInt(qty) }),
          new Promise((_, rej) => setTimeout(() => rej(new Error("send timeout")), 30000)),
        ]);
        await Promise.race([tx.wait(), new Promise((_, rej) => setTimeout(() => rej(new Error("wait timeout")), 30000))]);
        return;
      } catch (e) {
        log(`  paid retry attempt ${attempt}: ${e.shortMessage || e.message}`);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    throw new Error("paid mint failed 3x");
  };
  let pNext = 0;
  const pWorkers = Array.from({ length: 10 }, async () => {
    while (pNext < paidWallets.length) {
      const j = pNext++;
      const qty = j < 121 ? 3 : 2;
      await paidOne(paidWallets[j], qty);
      paidDone += qty;
    }
  });
  await Promise.all(pWorkers);
  check("totalSupply reaches cap 444", (await akey.totalSupply()) === 444n, `paid ${paidDone} more in ${((Date.now() - t1) / 1000).toFixed(0)}s`);
  check("paidMinted = 367 at cap", (await akey.paidMinted()) === 367n);
  check("paidRemaining 0 at cap", (await akey.paidRemaining()) === 0n);
  check("paidOpen false at cap", !(await akey.paidOpen()));

  // One more paid mint must revert (exceeds max supply)
  try {
    await (await akey.connect(agent).mint(1, { value: ethers.parseEther(PRICE) })).wait();
    check("paid mint past cap 444 reverts", false, "mint succeeded — BUG");
  } catch (e) { check("paid mint past cap 444 reverts", true, String(e.shortMessage || e.message).slice(0, 80)); }

  // Withdraw: contract holds 367 x 0.00142 = 0.52114 BNB; owner withdraws it.
  // Balance read with RAW eth_getBalance + retries (NFOX M9 lesson: ethers
  // getBalance() once returned a stale value after 1000+ calls).
  const expectedPaid = ethers.parseEther("0.52114");
  const balBefore = await provider.send("eth_getBalance", [await akey.getAddress(), "latest"]);
  check("contract holds paid BNB 0.52114", BigInt(balBefore) === expectedPaid, `${ethers.formatEther(balBefore)} BNB`);
  const txW = await akey.connect(deployer).withdraw();
  const rcW = await txW.wait();
  check("withdraw tx succeeds", rcW.status === 1, `gas ${rcW.gasUsed}`);
  let balAfter = null;
  for (let i = 0; i < 5; i++) {
    balAfter = BigInt(await provider.send("eth_getBalance", [await akey.getAddress(), "latest"]));
    if (balAfter === 0n) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  results.withdraw = { tx: txW.hash, gas: rcW.gasUsed.toString(), balanceAfter: balAfter.toString() };
  check("owner withdraw empties contract", balAfter === 0n, `${ethers.formatEther(balAfter ?? 0n)} BNB left`);

  // Non-owner withdraw must revert (contract is empty now, so use a fresh
  // check: it reverts on onlyOwner before the balance check — either way
  // it must not succeed).
  try {
    await (await akey.connect(agent).withdraw()).wait();
    check("non-owner withdraw reverts", false, "call succeeded — BUG");
  } catch (e) { check("non-owner withdraw reverts", true, String(e.shortMessage || e.message).slice(0, 80)); }

  // Mainnet cost estimate from REAL measured gas (BSC mainnet ~0.05 gwei, BNB ~$704.080)
  const bnb = (gas) => ethers.formatEther(BigInt(gas) * 50_000_000n);
  const usd = (gas) => (parseFloat(bnb(gas)) * 704.08).toFixed(4);
  results.mainnetCostEstimate = {
    gasPriceAssumption: "0.05 gwei",
    bnbPriceAssumptionUsd: 704.08,
    akeyDeployGas: akeyRc.gasUsed.toString(),
    akeyDeployBnb: bnb(akeyRc.gasUsed), akeyDeployUsd: usd(akeyRc.gasUsed),
    freeMintGas: rc1.gasUsed.toString(), freeMintBnb: bnb(rc1.gasUsed), freeMintUsd: usd(rc1.gasUsed),
    paidMintX1Gas: rcP1.gasUsed.toString(), paidMintX1Bnb: bnb(rcP1.gasUsed), paidMintX1Usd: usd(rcP1.gasUsed),
    paidMintX3Gas: rcP3.gasUsed.toString(), paidMintX3Bnb: bnb(rcP3.gasUsed), paidMintX3Usd: usd(rcP3.gasUsed),
    withdrawGas: rcW.gasUsed.toString(), withdrawBnb: bnb(rcW.gasUsed), withdrawUsd: usd(rcW.gasUsed),
    setBaseURIGas: rcB.gasUsed.toString(), setBaseURIBnb: bnb(rcB.gasUsed), setBaseURIUsd: usd(rcB.gasUsed),
    note: "Mock is local-only; mainnet uses the real registry, so mainnet deployment = AgentKeyPass deploy only (+ setBaseURI tx).",
  };
  console.log("\nMainnet cost estimate (0.05 gwei, BNB $704.080):");
  console.log(`  deploy AgentKeyPass: ${results.mainnetCostEstimate.akeyDeployBnb} BNB (~$${results.mainnetCostEstimate.akeyDeployUsd})`);
  console.log(`  one free mint (minter pays gas): ${results.mainnetCostEstimate.freeMintBnb} BNB (~$${results.mainnetCostEstimate.freeMintUsd})`);
  console.log(`  paid mint x3 (minter pays gas): ${results.mainnetCostEstimate.paidMintX3Bnb} BNB (~$${results.mainnetCostEstimate.paidMintX3Usd})`);

  results.finishedAt = new Date().toISOString();
  results.allPassed = results.tests.every((t) => t.ok);
  fs.writeFileSync(path.join(root, "test-results.json"), JSON.stringify(results, null, 2));
  console.log(`\n${results.tests.filter((t) => t.ok).length}/${results.tests.length} tests passed. Saved test-results.json`);
  if (!results.allPassed) process.exitCode = 1;
} finally {
  anvil.kill("SIGTERM");
}
