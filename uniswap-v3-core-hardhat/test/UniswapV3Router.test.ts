import { ethers } from 'hardhat'
import { expect } from 'chai'
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'
import { TestERC20, UniswapV3Factory, MockTimeUniswapV3Pool, TestUniswapV3Router, TestUniswapV3Callee } from '../typechain-types'

import { poolFixture } from './shared/fixtures'

import {
  FeeAmount,
  TICK_SPACINGS,
  createPoolFunctions,
  PoolFunctions,
  createMultiPoolFunctions,
  encodePriceSqrt,
  getMinTick,
  getMaxTick,
  expandTo18Decimals,
} from './shared/utilities'

const feeAmount = FeeAmount.MEDIUM
const tickSpacing = TICK_SPACINGS[feeAmount]

type ThenArg<T> = T extends PromiseLike<infer U> ? U : T

describe('UniswapV3Pool', () => {
  let wallet: HardhatEthersSigner
  let other: HardhatEthersSigner

  let token0: TestERC20
  let token1: TestERC20
  let token2: TestERC20
  let factory: UniswapV3Factory
  let pool0: MockTimeUniswapV3Pool
  let pool1: MockTimeUniswapV3Pool

  let pool0Functions: PoolFunctions
  let pool1Functions: PoolFunctions

  let minTick: number
  let maxTick: number

  let swapTargetCallee: TestUniswapV3Callee
  let swapTargetRouter: TestUniswapV3Router

  let createPool: ThenArg<ReturnType<typeof poolFixture>>['createPool']

  before('get signers', async () => {
    ;[wallet, other] = await ethers.getSigners()
  })

  beforeEach('deploy first fixture', async () => {
    ;({ token0, token1, token2, factory, createPool, swapTargetCallee, swapTargetRouter } = await poolFixture())

    const createPoolWrapped = async (
      amount: number,
      spacing: number,
      firstToken: TestERC20,
      secondToken: TestERC20
    ): Promise<[MockTimeUniswapV3Pool, PoolFunctions]> => {
      const pool = await createPool(amount, spacing, firstToken, secondToken)
      const poolFunctions = createPoolFunctions({
        swapTarget: swapTargetCallee,
        token0: firstToken,
        token1: secondToken,
        pool,
      })
      minTick = getMinTick(spacing)
      maxTick = getMaxTick(spacing)
      return [pool, poolFunctions]
    }

    // default to the 30 bips pool
    ;[pool0, pool0Functions] = await createPoolWrapped(feeAmount, tickSpacing, token0, token1)
    ;[pool1, pool1Functions] = await createPoolWrapped(feeAmount, tickSpacing, token1, token2)
  })

  it('constructor initializes immutables', async () => {
    expect(await pool0.factory()).to.eq(await factory.getAddress())
    expect(await pool0.token0()).to.eq(await token0.getAddress())
    expect(await pool0.token1()).to.eq(await token1.getAddress())
    expect(await pool1.factory()).to.eq(await factory.getAddress())
    expect(await pool1.token0()).to.eq(await token1.getAddress())
    expect(await pool1.token1()).to.eq(await token2.getAddress())
  })

  describe('multi-swaps', () => {
    let inputToken: TestERC20
    let outputToken: TestERC20

    beforeEach('initialize both pools', async () => {
      inputToken = token0
      outputToken = token2

      await pool0.initialize(encodePriceSqrt(1, 1))
      await pool1.initialize(encodePriceSqrt(1, 1))

      await pool0Functions.mint(wallet.address, minTick, maxTick, expandTo18Decimals(1))
      await pool1Functions.mint(wallet.address, minTick, maxTick, expandTo18Decimals(1))
    })

    it('multi-swap', async () => {
      const token0OfPoolOutput = await pool1.token0()
      const ForExact0 = (await outputToken.getAddress()) === token0OfPoolOutput

      const { swapForExact0Multi, swapForExact1Multi } = createMultiPoolFunctions({
        inputToken: token0,
        swapTarget: swapTargetRouter,
        poolInput: pool0,
        poolOutput: pool1,
      })

      const method = ForExact0 ? swapForExact0Multi : swapForExact1Multi

      await expect(method(100, wallet.address))
        .to.emit(outputToken, 'Transfer')
        .withArgs(await pool1.getAddress(), wallet.address, 100)
        .to.emit(token1, 'Transfer')
        .withArgs(await pool0.getAddress(), await pool1.getAddress(), 102)
        .to.emit(inputToken, 'Transfer')
        .withArgs(wallet.address, await pool0.getAddress(), 104)
    })
  })
})
