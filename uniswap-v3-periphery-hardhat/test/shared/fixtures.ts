import { ethers } from 'hardhat'
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'
import { MaxUint256 } from 'ethers'
import {
  UniswapV3Factory,
  MockTimeNonfungiblePositionManager,
  MockTimeSwapRouter,
  TestERC20,
  WETH9,
} from '../../typechain-types'
import { encodePriceSqrt, FeeAmount, TICK_SPACINGS, getMinTick, getMaxTick } from './utilities'

// ─── Shared fixture types ─────────────────────────────────────────────────────

export interface Tokens {
  token0: TestERC20
  token1: TestERC20
  token2: TestERC20
}

export interface CoreFixture {
  factory: UniswapV3Factory
  weth9: WETH9
  tokens: Tokens
}

export interface SwapRouterFixture extends CoreFixture {
  router: MockTimeSwapRouter
}

export interface NfpmFixture extends CoreFixture {
  nfpm: MockTimeNonfungiblePositionManager
}

// ─── Core deployment fixture ──────────────────────────────────────────────────

/**
 * Deploys the V3 Factory, WETH9, and three sorted test ERC20 tokens.
 * Called once per describe-block via loadFixture.
 */
export async function coreFixture(): Promise<CoreFixture> {
  const [wallet] = await ethers.getSigners()

  // Deploy V3 factory
  const factory = (await ethers.deployContract('UniswapV3Factory')) as unknown as UniswapV3Factory
  await factory.waitForDeployment()

  // Deploy WETH9
  const weth9 = (await ethers.deployContract('WETH9')) as unknown as WETH9
  await weth9.waitForDeployment()

  // Deploy 3 test tokens with large minted supply
  const supply = expandTo18Decimals_big(1_000_000)
  const tokenA = (await ethers.deployContract('TestERC20', [supply])) as unknown as TestERC20
  const tokenB = (await ethers.deployContract('TestERC20', [supply])) as unknown as TestERC20
  const tokenC = (await ethers.deployContract('TestERC20', [supply])) as unknown as TestERC20
  await Promise.all([tokenA.waitForDeployment(), tokenB.waitForDeployment(), tokenC.waitForDeployment()])

  // Sort tokens by address (Uniswap V3 requires token0 < token1)
  const sortedPair = sortTokens(tokenA, tokenB, tokenC)

  return { factory, weth9, tokens: sortedPair }
}

// ─── SwapRouter fixture ───────────────────────────────────────────────────────

/**
 * Extends the core fixture with a MockTimeSwapRouter and a pre-initialized pool.
 * Pool: token0/token1 at 1:1 price, MEDIUM fee, with initial liquidity.
 */
export async function swapRouterFixture(): Promise<SwapRouterFixture> {
  const core = await coreFixture()
  const { factory, weth9, tokens } = core
  const { token0, token1 } = tokens
  const [wallet] = await ethers.getSigners()

  // Deploy MockTimeSwapRouter
  const router = (await ethers.deployContract('MockTimeSwapRouter', [
    await factory.getAddress(),
    await weth9.getAddress(),
  ])) as unknown as MockTimeSwapRouter
  await router.waitForDeployment()

  // Approve router to spend test tokens
  await token0.approve(await router.getAddress(), MaxUint256)
  await token1.approve(await router.getAddress(), MaxUint256)
  await tokens.token2.approve(await router.getAddress(), MaxUint256)

  // Create and initialise pool (token0/token1, MEDIUM fee, 1:1 price)
  await factory.createPool(await token0.getAddress(), await token1.getAddress(), FeeAmount.MEDIUM)
  const poolAddress = await factory.getPool(
    await token0.getAddress(),
    await token1.getAddress(),
    FeeAmount.MEDIUM
  )
  const pool = await ethers.getContractAt('IUniswapV3Pool', poolAddress)
  await pool.initialize(encodePriceSqrt(1, 1))

  // Seed the pool with liquidity using the router's mint helper (via NFPM below)
  // We seed via direct pool mint by deploying a minimal liquidity seeder
  // to avoid circular dependencies. We rely on the test ERC20 contracts
  // implementing the callback interface for simplicity.
  // Instead: we deploy NFPM to seed the pool, then run router tests.
  const nfpm = (await ethers.deployContract('MockTimeNonfungiblePositionManager', [
    await factory.getAddress(),
    await weth9.getAddress(),
    ethers.ZeroAddress, // tokenDescriptor not needed for functionality tests
  ])) as unknown as MockTimeNonfungiblePositionManager
  await nfpm.waitForDeployment()

  await token0.approve(await nfpm.getAddress(), MaxUint256)
  await token1.approve(await nfpm.getAddress(), MaxUint256)

  // Add liquidity across the full tick range so swap tests have sufficient depth
  const tickSpacing = TICK_SPACINGS[FeeAmount.MEDIUM]
  await nfpm.mint({
    token0: await token0.getAddress(),
    token1: await token1.getAddress(),
    fee: FeeAmount.MEDIUM,
    tickLower: getMinTick(tickSpacing),
    tickUpper: getMaxTick(tickSpacing),
    amount0Desired: expandTo18Decimals_big(100),
    amount1Desired: expandTo18Decimals_big(100),
    amount0Min: 0n,
    amount1Min: 0n,
    recipient: wallet.address,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
  })

  // Create and seed a second pool (token1/token2) for multi-hop tests
  await factory.createPool(await token1.getAddress(), await tokens.token2.getAddress(), FeeAmount.MEDIUM)
  const pool2Address = await factory.getPool(
    await token1.getAddress(),
    await tokens.token2.getAddress(),
    FeeAmount.MEDIUM
  )
  const pool2 = await ethers.getContractAt('IUniswapV3Pool', pool2Address)
  await pool2.initialize(encodePriceSqrt(1, 1))

  await token1.approve(await nfpm.getAddress(), MaxUint256)
  await tokens.token2.approve(await nfpm.getAddress(), MaxUint256)

  await nfpm.mint({
    token0: await token1.getAddress(),
    token1: await tokens.token2.getAddress(),
    fee: FeeAmount.MEDIUM,
    tickLower: getMinTick(tickSpacing),
    tickUpper: getMaxTick(tickSpacing),
    amount0Desired: expandTo18Decimals_big(100),
    amount1Desired: expandTo18Decimals_big(100),
    amount0Min: 0n,
    amount1Min: 0n,
    recipient: wallet.address,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
  })

  return { ...core, router }
}

// ─── NonfungiblePositionManager fixture ───────────────────────────────────────

/**
 * Extends the core fixture with a MockTimeNonfungiblePositionManager.
 * Does NOT pre-create any pools — tests handle pool lifecycle themselves.
 */
export async function nfpmFixture(): Promise<NfpmFixture> {
  const core = await coreFixture()
  const { factory, weth9, tokens } = core
  const [wallet] = await ethers.getSigners()

  const nfpm = (await ethers.deployContract('MockTimeNonfungiblePositionManager', [
    await factory.getAddress(),
    await weth9.getAddress(),
    ethers.ZeroAddress, // tokenDescriptor not needed for functionality tests
  ])) as unknown as MockTimeNonfungiblePositionManager
  await nfpm.waitForDeployment()

  // Pre-approve NFPM for all tokens
  await tokens.token0.approve(await nfpm.getAddress(), MaxUint256)
  await tokens.token1.approve(await nfpm.getAddress(), MaxUint256)

  return { ...core, nfpm }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function expandTo18Decimals_big(n: number): bigint {
  return BigInt(n) * 10n ** 18n
}

/**
 * Sorts three tokens by address ascending, returning { token0, token1, token2 }.
 */
function sortTokens(a: TestERC20, b: TestERC20, c: TestERC20): Tokens {
  const addrs = [
    { tok: a, addr: (a.target as string).toLowerCase() },
    { tok: b, addr: (b.target as string).toLowerCase() },
    { tok: c, addr: (c.target as string).toLowerCase() },
  ].sort((x, y) => (x.addr < y.addr ? -1 : 1))

  return { token0: addrs[0].tok, token1: addrs[1].tok, token2: addrs[2].tok }
}
