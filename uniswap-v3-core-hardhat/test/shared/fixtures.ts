import { ethers } from 'hardhat'
import {
  MockTimeUniswapV3Pool,
  MockTimeUniswapV3PoolDeployer,
  TestERC20,
  TestUniswapV3Callee,
  TestUniswapV3Router,
  UniswapV3Factory,
} from '../../typechain-types'

export interface FactoryFixture {
  factory: UniswapV3Factory
}

export async function factoryFixture(): Promise<FactoryFixture> {
  const factory = await ethers.deployContract('UniswapV3Factory')
  await factory.waitForDeployment()
  return { factory: factory as unknown as UniswapV3Factory }
}

export interface TokensFixture {
  token0: TestERC20
  token1: TestERC20
  token2: TestERC20
}

export async function tokensFixture(): Promise<TokensFixture> {
  const supply = 2n ** 255n
  const tokenA = await ethers.deployContract('TestERC20', [supply])
  const tokenB = await ethers.deployContract('TestERC20', [supply])
  const tokenC = await ethers.deployContract('TestERC20', [supply])
  await tokenA.waitForDeployment()
  await tokenB.waitForDeployment()
  await tokenC.waitForDeployment()

  const addresses = await Promise.all([tokenA.getAddress(), tokenB.getAddress(), tokenC.getAddress()])
  const sorted = [
    { contract: tokenA, address: addresses[0] },
    { contract: tokenB, address: addresses[1] },
    { contract: tokenC, address: addresses[2] },
  ].sort((a, b) => (a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1))

  return {
    token0: sorted[0].contract as unknown as TestERC20,
    token1: sorted[1].contract as unknown as TestERC20,
    token2: sorted[2].contract as unknown as TestERC20,
  }
}

export interface PoolFixture extends FactoryFixture, TokensFixture {
  swapTargetCallee: TestUniswapV3Callee
  swapTargetRouter: TestUniswapV3Router
  createPool(
    fee: number,
    tickSpacing: number,
    firstToken?: TestERC20,
    secondToken?: TestERC20
  ): Promise<MockTimeUniswapV3Pool>
}

// Monday, October 5, 2020 9:00:00 AM GMT-05:00
export const TEST_POOL_START_TIME = 1601906400

export async function poolFixture(): Promise<PoolFixture> {
  const { factory } = await factoryFixture()
  const { token0, token1, token2 } = await tokensFixture()

  const swapTargetCallee = await ethers.deployContract('TestUniswapV3Callee')
  const swapTargetRouter = await ethers.deployContract('TestUniswapV3Router')
  await swapTargetCallee.waitForDeployment()
  await swapTargetRouter.waitForDeployment()

  return {
    token0,
    token1,
    token2,
    factory,
    swapTargetCallee: swapTargetCallee as unknown as TestUniswapV3Callee,
    swapTargetRouter: swapTargetRouter as unknown as TestUniswapV3Router,
    createPool: async (fee, tickSpacing, firstToken = token0, secondToken = token1) => {
      const mockTimePoolDeployer = (await ethers.deployContract(
        'MockTimeUniswapV3PoolDeployer'
      )) as unknown as MockTimeUniswapV3PoolDeployer
      await mockTimePoolDeployer.waitForDeployment()

      const tx = await mockTimePoolDeployer.deploy(
        await factory.getAddress(),
        await firstToken.getAddress(),
        await secondToken.getAddress(),
        fee,
        tickSpacing
      )
      const receipt = await tx.wait()

      // Parse PoolDeployed event to get pool address
      const iface = mockTimePoolDeployer.interface
      const poolDeployedTopic = iface.getEvent('PoolDeployed')?.topicHash
      const log = receipt?.logs.find((l) => l.topics[0] === poolDeployedTopic)
      if (!log) throw new Error('PoolDeployed event not found')
      const poolAddress = iface.decodeEventLog('PoolDeployed', log.data, log.topics).pool as string

      const MockTimeUniswapV3PoolFactory = await ethers.getContractFactory('MockTimeUniswapV3Pool')
      return MockTimeUniswapV3PoolFactory.attach(poolAddress) as unknown as MockTimeUniswapV3Pool
    },
  }
}
