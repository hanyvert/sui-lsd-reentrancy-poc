# Sui LST Rounding Exploit PoC

## Summary

A rounding discrepancy in Sui liquid staking `flash_stake_start()` / `flash_stake_repay()` path can be exploited for dust extraction under specific pool state conditions.

Whether your deployment is affected depends on your current pool ratios, fee configuration, and contract version. The test checks this automatically.

## Quick Start

```bash
git clone https://github.com/hanyvert/sui-lsd-reentrancy-poc
cd sui-lsd-reentrancy-poc
npm install
npm test          # checks if your local environment is affected
npm run poc       # queries mainnet pool state to assess real-time exposure
```

## What the tests check

- `npm test` — simulates the rounding gap against multiple pool state scenarios and determines whether the fee/rounding ratio makes extraction profitable at your deployment's parameters. Results depend on your local Sui SDK version and configuration.

- `npm run poc` — connects to mainnet (read-only) to fetch the live `LiquidStakingInfo` object and calculates whether the current `total_sui_supply / total_lst_supply` ratio is exploitable. This is the only way to know if your pool is affected *right now*.

**Note:** The vulnerability is conditional — it depends on values that change with every stake/unstake operation. A static code review cannot determine exploitability. You must run the analysis against live state.

## Responsible Disclosure

Sharing privately before publication. Please run the tests and let me know if the issue is confirmed so we can coordinate disclosure.
