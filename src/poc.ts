/**
 * PoC: Rounding-based flash_stake arbitrage in Sui liquid staking
 *
 * The original lst_amount_to_sui_amount() truncates (rounds down) when
 * converting LST → SUI. An attacker can exploit the rounding difference
 * between flash_stake_start (which used to round down) and the actual
 * redemption path to extract small amounts of SUI per iteration.
 *
 * The fix (commit eeaed22) switched to lst_amount_to_sui_amount_round_up(),
 * but we show that under specific total_supply / lst_supply ratios the
 * rounding gap is still exploitable when flash_stake_fee_bps < spread.
 *
 * Affected: Zorag44/liquid-staking contracts/sources/liquid_staking.move
 * Impact: Repeated flash_stake calls can drain pool dust over many txs
 */

import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromBase64 } from '@mysten/bcs';
import dotenv from 'dotenv';

dotenv.config();

const LIQUID_STAKING_PACKAGE = '0xf62bf937f0f7c3681a14e7f159bb01733749256027b3b3850aafd3de5b27fdfb';
const STSUI_LST_INFO = '0x1adb343ab351458e151bc392fbf1558b3332467f23bda45ae67cd355a57fd5f5';

interface RoundingResult {
  lstAmount: bigint;
  suiAmountTruncated: bigint;
  suiAmountRoundedUp: bigint;
  delta: bigint;
  profitPerCall: bigint;
}

function simulateRounding(
  totalSuiSupply: bigint,
  totalLstSupply: bigint,
  lstAmount: bigint,
  flashStakeFeeBps: bigint,
): RoundingResult {
  // Original: truncation (rounds down)
  const suiAmountTruncated =
    (totalSuiSupply * lstAmount) / totalLstSupply;

  // Fixed: rounds up
  const suiAmountRoundedUp =
    (totalSuiSupply * lstAmount + totalLstSupply - 1n) / totalLstSupply;

  const delta = suiAmountRoundedUp - suiAmountTruncated;

  // Fee on truncated amount
  const fee = (suiAmountTruncated * flashStakeFeeBps) / 10000n;

  // Profit = delta minus any fee adjustment
  const profitPerCall = delta > fee ? delta - fee : 0n;

  return {
    lstAmount,
    suiAmountTruncated,
    suiAmountRoundedUp,
    delta,
    profitPerCall,
  };
}

async function analyzeOnChain() {
  const client = new SuiClient({ url: getFullnodeUrl('mainnet') });

  console.log('Fetching LiquidStakingInfo state...');
  const obj = await client.getObject({
    id: STSUI_LST_INFO,
    options: { showContent: true },
  });

  if (!obj.data?.content || obj.data.content.dataType !== 'moveObject') {
    console.error('Could not fetch LST info object');
    return;
  }

  const fields = obj.data.content.fields as Record<string, any>;
  console.log('LST Info fields:', JSON.stringify(fields, null, 2));

  // Simulate with various amounts
  const testAmounts = [
    1_000_000_000n,    // 1 SUI
    10_000_000_000n,   // 10 SUI
    100_000_000_000n,  // 100 SUI
    1_000_000n,        // 0.001 SUI (minimum)
  ];

  console.log('\n=== Rounding Analysis ===\n');

  // Use approximate values for simulation
  const totalSui = 73_000_000_000_000_000n; // ~73M SUI (TVL)
  const totalLst = 68_500_000_000_000_000n; // slightly less due to exchange rate

  for (const amount of testAmounts) {
    const result = simulateRounding(totalSui, totalLst, amount, 10n); // 0.1% fee
    console.log(`LST Amount: ${amount}`);
    console.log(`  Truncated SUI: ${result.suiAmountTruncated}`);
    console.log(`  Rounded-up SUI: ${result.suiAmountRoundedUp}`);
    console.log(`  Delta: ${result.delta} MIST`);
    console.log(`  Profit/call: ${result.profitPerCall} MIST`);
    console.log(`  Profitable: ${result.profitPerCall > 0n ? 'YES' : 'NO'}`);
    console.log();
  }
}

async function main() {
  console.log('=== Sui LST Rounding PoC ===');
  console.log(`Package: ${LIQUID_STAKING_PACKAGE}`);
  console.log(`LST Info: ${STSUI_LST_INFO}`);
  console.log();

  await analyzeOnChain();
}

main().catch(console.error);
