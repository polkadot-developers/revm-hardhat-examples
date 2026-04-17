import bn from 'bignumber.js'
import { BigNumberish, MaxUint256 } from 'ethers'
import { TestERC20 } from '../../typechain-types'

// --- Constants ---

export const MaxUint128 = 2n ** 128n - 1n

export enum FeeAmount {
  LOW = 500,
  MEDIUM = 3000,
  HIGH = 10000,
}

export const TICK_SPACINGS: { [amount in FeeAmount]: number } = {
  [FeeAmount.LOW]: 10,
  [FeeAmount.MEDIUM]: 60,
  [FeeAmount.HIGH]: 200,
}

export const MIN_SQRT_RATIO = 4295128739n
export const MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342n

// --- Math helpers ---

bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 })

export function expandTo18Decimals(n: number): bigint {
  return BigInt(n) * 10n ** 18n
}

/**
 * Encodes a price as sqrtPriceX96.
 * @param reserve1 Amount of token1 in the pool
 * @param reserve0 Amount of token0 in the pool
 */
export function encodePriceSqrt(reserve1: BigNumberish, reserve0: BigNumberish): bigint {
  return BigInt(
    new bn(reserve1.toString())
      .div(reserve0.toString())
      .sqrt()
      .multipliedBy(new bn(2).pow(96))
      .integerValue(3)
      .toString()
  )
}

export function getMinTick(tickSpacing: number): number {
  return Math.ceil(-887272 / tickSpacing) * tickSpacing
}

export function getMaxTick(tickSpacing: number): number {
  return Math.floor(887272 / tickSpacing) * tickSpacing
}

// --- ERC20 helpers ---

export const APPROVAL_AMOUNT = MaxUint256

/**
 * Approves the spender to spend max from each of the given tokens.
 */
export async function approveAll(
  tokens: TestERC20[],
  spender: string,
  owner: { address: string; sendTransaction?: unknown }
): Promise<void> {
  for (const token of tokens) {
    await token.approve(spender, APPROVAL_AMOUNT)
  }
}

// --- Deadline helpers ---

/**
 * Returns a deadline 60 seconds into the future (suitable for Hardhat test environments).
 */
export function deadlineFromNow(secondsFromNow = 60): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + secondsFromNow)
}
