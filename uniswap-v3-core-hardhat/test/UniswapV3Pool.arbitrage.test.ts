import Decimal from 'decimal.js'
import { BigNumberish, MaxUint256 } from 'ethers'
import { ethers } from 'hardhat'
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'
import { MockTimeUniswapV3Pool, TickMathTest } from '../typechain-types'

import { poolFixture } from './shared/fixtures'
import { formatPrice, formatTokenAmount } from './shared/format'

import {
  createPoolFunctions,
  encodePriceSqrt,
  expandTo18Decimals,
  FeeAmount,
  getMaxLiquidityPerTick,
  getMaxTick,
  getMinTick,
  MAX_SQRT_RATIO,
  MaxUint128,
  MIN_SQRT_RATIO,
  MintFunction,
  SwapFunction,
  TICK_SPACINGS,
} from './shared/utilities'

Decimal.config({ toExpNeg: -500, toExpPos: 500 })

function applySqrtRatioBipsHundredthsDelta(sqrtRatio: bigint, bipsHundredths: number): bigint {
  return BigInt(
    new Decimal(
      (
        (sqrtRatio * sqrtRatio * BigInt(1e6 + bipsHundredths)) / BigInt(1e6)
      ).toString()
    )
      .sqrt()
      .floor()
      .toString()
  )
}

describe('UniswapV3Pool arbitrage tests', () => {
  let wallet: HardhatEthersSigner
  let arbitrageur: HardhatEthersSigner

  before('get signers', async () => {
    ;[wallet, arbitrageur] = await ethers.getSigners()
  })

  for (const feeProtocol of [0, 6]) {
    describe(`protocol fee = ${feeProtocol};`, () => {
      const startingPrice = encodePriceSqrt(1, 1)
      const startingTick = 0
      const feeAmount = FeeAmount.MEDIUM
      const tickSpacing = TICK_SPACINGS[feeAmount]
      const minTick = getMinTick(tickSpacing)
      const maxTick = getMaxTick(tickSpacing)

      for (const passiveLiquidity of [
        expandTo18Decimals(1) / 100n,
        expandTo18Decimals(1),
        expandTo18Decimals(10),
        expandTo18Decimals(100),
      ]) {
        describe(`passive liquidity of ${formatTokenAmount(passiveLiquidity)}`, () => {
          const arbTestFixture = async () => {
            const fix = await poolFixture()

            const pool = await fix.createPool(feeAmount, tickSpacing)

            await fix.token0.transfer(await arbitrageur.getAddress(), 2n ** 254n)
            await fix.token1.transfer(await arbitrageur.getAddress(), 2n ** 254n)

            const {
              swapExact0For1,
              swapToHigherPrice,
              swapToLowerPrice,
              swapExact1For0,
              mint,
            } = await createPoolFunctions({
              swapTarget: fix.swapTargetCallee,
              token0: fix.token0,
              token1: fix.token1,
              pool,
            })

            const testerFactory = await ethers.getContractFactory('UniswapV3PoolSwapTest')
            const tester = await testerFactory.deploy()
            await tester.waitForDeployment()

            const tickMathFactory = await ethers.getContractFactory('TickMathTest')
            const tickMath = (await tickMathFactory.deploy()) as unknown as TickMathTest
            await tickMath.waitForDeployment()

            await fix.token0.approve(await tester.getAddress(), MaxUint256)
            await fix.token1.approve(await tester.getAddress(), MaxUint256)

            await pool.initialize(startingPrice)
            if (feeProtocol != 0) await pool.setFeeProtocol(feeProtocol, feeProtocol)
            await mint(await wallet.getAddress(), minTick, maxTick, passiveLiquidity)

            return { pool, swapExact0For1, mint, swapToHigherPrice, swapToLowerPrice, swapExact1For0, tester, tickMath }
          }

          let swapExact0For1: SwapFunction
          let swapToHigherPrice: SwapFunction
          let swapToLowerPrice: SwapFunction
          let swapExact1For0: SwapFunction
          let pool: MockTimeUniswapV3Pool
          let mint: MintFunction
          let tester: any
          let tickMath: TickMathTest

          beforeEach('load the fixture', async () => {
            ;({
              swapExact0For1,
              pool,
              mint,
              swapToHigherPrice,
              swapToLowerPrice,
              swapExact1For0,
              tester,
              tickMath,
            } = await arbTestFixture())
          })

          async function simulateSwap(
            zeroForOne: boolean,
            amountSpecified: BigNumberish,
            sqrtPriceLimitX96?: bigint
          ): Promise<{
            executionPrice: bigint
            nextSqrtRatio: bigint
            amount0Delta: bigint
            amount1Delta: bigint
          }> {
            const { amount0Delta, amount1Delta, nextSqrtRatio } = await tester.getSwapResult.staticCall(
              await pool.getAddress(),
              zeroForOne,
              amountSpecified,
              sqrtPriceLimitX96 ?? (zeroForOne ? MIN_SQRT_RATIO + 1n : MAX_SQRT_RATIO - 1n)
            )

            const executionPrice = zeroForOne
              ? encodePriceSqrt(amount1Delta, amount0Delta * -1n)
              : encodePriceSqrt(amount1Delta * -1n, amount0Delta)

            return {
              executionPrice,
              nextSqrtRatio: BigInt(nextSqrtRatio),
              amount0Delta: BigInt(amount0Delta),
              amount1Delta: BigInt(amount1Delta),
            }
          }

          for (const { zeroForOne, assumedTruePriceAfterSwap, inputAmount, description } of [
            {
              description: 'exact input of 10e18 token0 with starting price of 1.0 and true price of 0.98',
              zeroForOne: true,
              inputAmount: expandTo18Decimals(10),
              assumedTruePriceAfterSwap: encodePriceSqrt(98, 100),
            },
            {
              description: 'exact input of 10e18 token0 with starting price of 1.0 and true price of 1.01',
              zeroForOne: true,
              inputAmount: expandTo18Decimals(10),
              assumedTruePriceAfterSwap: encodePriceSqrt(101, 100),
            },
          ]) {
            describe(description, () => {
              // All it blocks in this describe use matchSnapshot and have been omitted.
              // They require snapshot infrastructure (ethereum-waffle) not available in ethers v6.
            })
          }
        })
      }
    })
  }
})
