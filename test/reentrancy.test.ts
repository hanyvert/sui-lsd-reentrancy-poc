/**
 * Test: verify flash_stake rounding gap is exploitable
 *
 * Simulates the attack loop against various pool states.
 * Does NOT execute on-chain — pure arithmetic verification.
 */

interface PoolState {
  totalSuiSupply: bigint;
  totalLstSupply: bigint;
  flashStakeFeeBps: bigint;
  redeemFeeBps: bigint;
}

function lstToSuiTruncated(pool: PoolState, lstAmount: bigint): bigint {
  return (pool.totalSuiSupply * lstAmount) / pool.totalLstSupply;
}

function lstToSuiRoundUp(pool: PoolState, lstAmount: bigint): bigint {
  return (pool.totalSuiSupply * lstAmount + pool.totalLstSupply - 1n) / pool.totalLstSupply;
}

function simulateAttack(pool: PoolState, iterations: number): {
  totalProfit: bigint;
  profitableIterations: number;
} {
  let totalProfit = 0n;
  let profitableIterations = 0;

  const amounts = [
    1_000_000n,
    5_000_000n,
    10_000_000n,
    50_000_000n,
    100_000_000n,
    500_000_000n,
    1_000_000_000n,
  ];

  for (let i = 0; i < iterations; i++) {
    for (const amount of amounts) {
      const truncated = lstToSuiTruncated(pool, amount);
      const roundedUp = lstToSuiRoundUp(pool, amount);
      const delta = roundedUp - truncated;

      const fee = (truncated * pool.flashStakeFeeBps) / 10000n;
      const profit = delta > fee ? delta - fee : 0n;

      if (profit > 0n) {
        totalProfit += profit;
        profitableIterations++;
      }
    }
  }

  return { totalProfit, profitableIterations };
}

function runTests() {
  console.log('=== Flash Stake Rounding Attack Simulation ===\n');

  const scenarios: Array<{ name: string; pool: PoolState }> = [
    {
      name: 'Current mainnet (approx)',
      pool: {
        totalSuiSupply: 73_100_000_000_000_000n,
        totalLstSupply: 68_450_000_000_000_000n,
        flashStakeFeeBps: 10n,
        redeemFeeBps: 50n,
      },
    },
    {
      name: 'Low liquidity (early pool)',
      pool: {
        totalSuiSupply: 1_000_000_000_000n,
        totalLstSupply: 950_000_000_000n,
        flashStakeFeeBps: 10n,
        redeemFeeBps: 50n,
      },
    },
    {
      name: 'Extreme ratio (after large unstake)',
      pool: {
        totalSuiSupply: 50_000_000_000_000_000n,
        totalLstSupply: 73_000_000_000_000_000n,
        flashStakeFeeBps: 5n,
        redeemFeeBps: 30n,
      },
    },
  ];

  for (const { name, pool } of scenarios) {
    console.log(`--- ${name} ---`);
    console.log(`  SUI supply: ${pool.totalSuiSupply}`);
    console.log(`  LST supply: ${pool.totalLstSupply}`);
    console.log(`  Flash fee: ${pool.flashStakeFeeBps} bps`);

    const result = simulateAttack(pool, 1000);
    console.log(`  Result (1000 iterations x 7 amounts):`);
    console.log(`    Total profit: ${result.totalProfit} MIST (${Number(result.totalProfit) / 1e9} SUI)`);
    console.log(`    Profitable iterations: ${result.profitableIterations} / 7000`);

    if (result.totalProfit > 0n) {
      console.log(`    STATUS: VULNERABLE`);
    } else {
      console.log(`    STATUS: Not exploitable at current state`);
    }
    console.log();
  }

  console.log('NOTE: This PoC tests the arithmetic gap only.');
  console.log('On-chain exploitation requires gas cost < profit per tx.');
  console.log('Run `npm run poc` for live on-chain state analysis.');
}

runTests();
