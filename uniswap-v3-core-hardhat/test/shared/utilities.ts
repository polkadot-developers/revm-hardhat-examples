import bn from 'bignumber.js'
import { AbiCoder, BigNumberish, ContractTransactionResponse, getAddress, keccak256, MaxUint256, solidityPacked } from 'ethers'
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'
import { MockTimeUniswapV3Pool, TestERC20, TestUniswapV3Callee, TestUniswapV3Router } from '../../typechain-types'

export const MaxUint128 = 2n ** 128n - 1n

export const getMinTick = (tickSpacing: number) => Math.ceil(-887272 / tickSpacing) * tickSpacing
export const getMaxTick = (tickSpacing: number) => Math.floor(887272 / tickSpacing) * tickSpacing
export const getMaxLiquidityPerTick = (tickSpacing: number) =>
  (2n ** 128n - 1n) / BigInt((getMaxTick(tickSpacing) - getMinTick(tickSpacing)) / tickSpacing + 1)

export const MIN_SQRT_RATIO = 4295128739n
export const MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342n

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

export function expandTo18Decimals(n: number): bigint {
  return BigInt(n) * 10n ** 18n
}

export function getCreate2Address(
  factoryAddress: string,
  [tokenA, tokenB]: [string, string],
  fee: number,
  bytecode: string
): string {
  const [token0, token1] = tokenA.toLowerCase() < tokenB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA]
  const constructorArgumentsEncoded = AbiCoder.defaultAbiCoder().encode(
    ['address', 'address', 'uint24'],
    [token0, token1, fee]
  )
  const create2Inputs = [
    '0xff',
    factoryAddress,
    keccak256(constructorArgumentsEncoded),
    keccak256(bytecode),
  ]
  const sanitizedInputs = `0x${create2Inputs.map((i) => i.slice(2)).join('')}`
  return getAddress(`0x${keccak256(sanitizedInputs).slice(-40)}`)
}

bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 })

// returns the sqrt price as a 64x96
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

export function getPositionKey(address: string, lowerTick: number, upperTick: number): string {
  return keccak256(solidityPacked(['address', 'int24', 'int24'], [address, lowerTick, upperTick]))
}

export type SwapFunction = (
  amount: BigNumberish,
  to: HardhatEthersSigner | string,
  sqrtPriceLimitX96?: BigNumberish
) => Promise<ContractTransactionResponse>
export type SwapToPriceFunction = (
  sqrtPriceX96: BigNumberish,
  to: HardhatEthersSigner | string
) => Promise<ContractTransactionResponse>
export type FlashFunction = (
  amount0: BigNumberish,
  amount1: BigNumberish,
  to: HardhatEthersSigner | string,
  pay0?: BigNumberish,
  pay1?: BigNumberish
) => Promise<ContractTransactionResponse>
export type MintFunction = (
  recipient: string,
  tickLower: BigNumberish,
  tickUpper: BigNumberish,
  liquidity: BigNumberish
) => Promise<ContractTransactionResponse>
export interface PoolFunctions {
  swapToLowerPrice: SwapToPriceFunction
  swapToHigherPrice: SwapToPriceFunction
  swapExact0For1: SwapFunction
  swap0ForExact1: SwapFunction
  swapExact1For0: SwapFunction
  swap1ForExact0: SwapFunction
  flash: FlashFunction
  mint: MintFunction
}

export function createPoolFunctions({
  swapTarget,
  token0,
  token1,
  pool,
}: {
  swapTarget: TestUniswapV3Callee
  token0: TestERC20
  token1: TestERC20
  pool: MockTimeUniswapV3Pool
}): PoolFunctions {
  async function swapToSqrtPrice(
    inputToken: TestERC20,
    targetPrice: BigNumberish,
    to: HardhatEthersSigner | string
  ): Promise<ContractTransactionResponse> {
    const method = inputToken === token0 ? swapTarget.swapToLowerSqrtPrice : swapTarget.swapToHigherSqrtPrice
    await inputToken.approve(await swapTarget.getAddress(), MaxUint256)
    const toAddress = typeof to === 'string' ? to : await to.getAddress()
    return method(await pool.getAddress(), targetPrice, toAddress)
  }

  async function swap(
    inputToken: TestERC20,
    [amountIn, amountOut]: [BigNumberish, BigNumberish],
    to: HardhatEthersSigner | string,
    sqrtPriceLimitX96?: BigNumberish
  ): Promise<ContractTransactionResponse> {
    const exactInput = amountOut === 0

    const method =
      inputToken === token0
        ? exactInput
          ? swapTarget.swapExact0For1
          : swapTarget.swap0ForExact1
        : exactInput
        ? swapTarget.swapExact1For0
        : swapTarget.swap1ForExact0

    if (typeof sqrtPriceLimitX96 === 'undefined') {
      if (inputToken === token0) {
        sqrtPriceLimitX96 = MIN_SQRT_RATIO + 1n
      } else {
        sqrtPriceLimitX96 = MAX_SQRT_RATIO - 1n
      }
    }
    await inputToken.approve(await swapTarget.getAddress(), MaxUint256)

    const toAddress = typeof to === 'string' ? to : await to.getAddress()
    return method(await pool.getAddress(), exactInput ? amountIn : amountOut, toAddress, sqrtPriceLimitX96)
  }

  const swapToLowerPrice: SwapToPriceFunction = (sqrtPriceX96, to) => swapToSqrtPrice(token0, sqrtPriceX96, to)
  const swapToHigherPrice: SwapToPriceFunction = (sqrtPriceX96, to) => swapToSqrtPrice(token1, sqrtPriceX96, to)
  const swapExact0For1: SwapFunction = (amount, to, sqrtPriceLimitX96) =>
    swap(token0, [amount, 0], to, sqrtPriceLimitX96)
  const swap0ForExact1: SwapFunction = (amount, to, sqrtPriceLimitX96) =>
    swap(token0, [0, amount], to, sqrtPriceLimitX96)
  const swapExact1For0: SwapFunction = (amount, to, sqrtPriceLimitX96) =>
    swap(token1, [amount, 0], to, sqrtPriceLimitX96)
  const swap1ForExact0: SwapFunction = (amount, to, sqrtPriceLimitX96) =>
    swap(token1, [0, amount], to, sqrtPriceLimitX96)

  const mint: MintFunction = async (recipient, tickLower, tickUpper, liquidity) => {
    await token0.approve(await swapTarget.getAddress(), MaxUint256)
    await token1.approve(await swapTarget.getAddress(), MaxUint256)
    return swapTarget.mint(await pool.getAddress(), recipient, tickLower, tickUpper, liquidity)
  }

  const flash: FlashFunction = async (amount0, amount1, to, pay0?: BigNumberish, pay1?: BigNumberish) => {
    const fee = await pool.fee()
    if (typeof pay0 === 'undefined') {
      pay0 = (BigInt(amount0) * BigInt(fee) + BigInt(1e6 - 1)) / 1000000n + BigInt(amount0)
    }
    if (typeof pay1 === 'undefined') {
      pay1 = (BigInt(amount1) * BigInt(fee) + BigInt(1e6 - 1)) / 1000000n + BigInt(amount1)
    }
    return swapTarget.flash(
      await pool.getAddress(),
      typeof to === 'string' ? to : await to.getAddress(),
      amount0,
      amount1,
      pay0,
      pay1
    )
  }

  return {
    swapToLowerPrice,
    swapToHigherPrice,
    swapExact0For1,
    swap0ForExact1,
    swapExact1For0,
    swap1ForExact0,
    mint,
    flash,
  }
}

export interface MultiPoolFunctions {
  swapForExact0Multi: SwapFunction
  swapForExact1Multi: SwapFunction
}

export function createMultiPoolFunctions({
  inputToken,
  swapTarget,
  poolInput,
  poolOutput,
}: {
  inputToken: TestERC20
  swapTarget: TestUniswapV3Router
  poolInput: MockTimeUniswapV3Pool
  poolOutput: MockTimeUniswapV3Pool
}): MultiPoolFunctions {
  async function swapForExact0Multi(
    amountOut: BigNumberish,
    to: HardhatEthersSigner | string
  ): Promise<ContractTransactionResponse> {
    await inputToken.approve(await swapTarget.getAddress(), MaxUint256)
    const toAddress = typeof to === 'string' ? to : await to.getAddress()
    return swapTarget.swapForExact0Multi(toAddress, await poolInput.getAddress(), await poolOutput.getAddress(), amountOut)
  }

  async function swapForExact1Multi(
    amountOut: BigNumberish,
    to: HardhatEthersSigner | string
  ): Promise<ContractTransactionResponse> {
    await inputToken.approve(await swapTarget.getAddress(), MaxUint256)
    const toAddress = typeof to === 'string' ? to : await to.getAddress()
    return swapTarget.swapForExact1Multi(toAddress, await poolInput.getAddress(), await poolOutput.getAddress(), amountOut)
  }

  return { swapForExact0Multi, swapForExact1Multi }
}
