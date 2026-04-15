import { ethers } from 'hardhat'
import { expect } from 'chai'
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'
import { UniswapV3Factory } from '../typechain-types'
import { FeeAmount, getCreate2Address, TICK_SPACINGS } from './shared/utilities'

const TEST_ADDRESSES: [string, string] = [
  '0x1000000000000000000000000000000000000000',
  '0x2000000000000000000000000000000000000000',
]

describe('UniswapV3Factory', () => {
  let wallet: HardhatEthersSigner
  let other: HardhatEthersSigner

  let factory: UniswapV3Factory
  let poolBytecode: string

  before('load pool bytecode', async () => {
    ;[wallet, other] = await ethers.getSigners()
    poolBytecode = (await ethers.getContractFactory('UniswapV3Pool')).bytecode
  })

  beforeEach('deploy factory', async () => {
    factory = await ethers.deployContract('UniswapV3Factory') as unknown as UniswapV3Factory
    await factory.waitForDeployment()
  })

  it('owner is deployer', async () => {
    expect(await factory.owner()).to.eq(await wallet.getAddress())
  })

  it('initial enabled fee amounts', async () => {
    expect(await factory.feeAmountTickSpacing(FeeAmount.LOW)).to.eq(TICK_SPACINGS[FeeAmount.LOW])
    expect(await factory.feeAmountTickSpacing(FeeAmount.MEDIUM)).to.eq(TICK_SPACINGS[FeeAmount.MEDIUM])
    expect(await factory.feeAmountTickSpacing(FeeAmount.HIGH)).to.eq(TICK_SPACINGS[FeeAmount.HIGH])
  })

  async function createAndCheckPool(
    tokens: [string, string],
    feeAmount: FeeAmount,
    tickSpacing: number = TICK_SPACINGS[feeAmount]
  ) {
    const factoryAddress = await factory.getAddress()
    const create2Address = getCreate2Address(factoryAddress, tokens, feeAmount, poolBytecode)
    const create = factory.createPool(tokens[0], tokens[1], feeAmount)

    await expect(create)
      .to.emit(factory, 'PoolCreated')
      .withArgs(TEST_ADDRESSES[0], TEST_ADDRESSES[1], feeAmount, tickSpacing, create2Address)

    await expect(factory.createPool(tokens[0], tokens[1], feeAmount)).to.be.reverted
    await expect(factory.createPool(tokens[1], tokens[0], feeAmount)).to.be.reverted
    expect(await factory.getPool(tokens[0], tokens[1], feeAmount), 'getPool in order').to.eq(create2Address)
    expect(await factory.getPool(tokens[1], tokens[0], feeAmount), 'getPool in reverse').to.eq(create2Address)

    const pool = (await ethers.getContractFactory('UniswapV3Pool')).attach(create2Address)
    expect(await pool.factory(), 'pool factory address').to.eq(factoryAddress)
    expect(await pool.token0(), 'pool token0').to.eq(TEST_ADDRESSES[0])
    expect(await pool.token1(), 'pool token1').to.eq(TEST_ADDRESSES[1])
    expect(await pool.fee(), 'pool fee').to.eq(feeAmount)
    expect(await pool.tickSpacing(), 'pool tick spacing').to.eq(tickSpacing)
  }

  describe('#createPool', () => {
    it('succeeds for low fee pool', async () => {
      await createAndCheckPool(TEST_ADDRESSES, FeeAmount.LOW)
    })

    it('succeeds for medium fee pool', async () => {
      await createAndCheckPool(TEST_ADDRESSES, FeeAmount.MEDIUM)
    })

    it('succeeds for high fee pool', async () => {
      await createAndCheckPool(TEST_ADDRESSES, FeeAmount.HIGH)
    })

    it('succeeds if tokens are passed in reverse', async () => {
      await createAndCheckPool([TEST_ADDRESSES[1], TEST_ADDRESSES[0]], FeeAmount.MEDIUM)
    })

    it('fails if token a == token b', async () => {
      await expect(factory.createPool(TEST_ADDRESSES[0], TEST_ADDRESSES[0], FeeAmount.LOW)).to.be.reverted
    })

    it('fails if token a is 0 or token b is 0', async () => {
      await expect(factory.createPool(TEST_ADDRESSES[0], ethers.ZeroAddress, FeeAmount.LOW)).to.be.reverted
      await expect(factory.createPool(ethers.ZeroAddress, TEST_ADDRESSES[0], FeeAmount.LOW)).to.be.reverted
      await expect(factory.createPool(ethers.ZeroAddress, ethers.ZeroAddress, FeeAmount.LOW)).to.be.reverted
    })

    it('fails if fee amount is not enabled', async () => {
      await expect(factory.createPool(TEST_ADDRESSES[0], TEST_ADDRESSES[1], 250)).to.be.reverted
    })
  })

  describe('#setOwner', () => {
    it('fails if caller is not owner', async () => {
      await expect(factory.connect(other).setOwner(await wallet.getAddress())).to.be.reverted
    })

    it('updates owner', async () => {
      await factory.setOwner(await other.getAddress())
      expect(await factory.owner()).to.eq(await other.getAddress())
    })

    it('emits event', async () => {
      await expect(factory.setOwner(await other.getAddress()))
        .to.emit(factory, 'OwnerChanged')
        .withArgs(await wallet.getAddress(), await other.getAddress())
    })

    it('cannot be called by original owner', async () => {
      await factory.setOwner(await other.getAddress())
      await expect(factory.setOwner(await wallet.getAddress())).to.be.reverted
    })
  })

  describe('#enableFeeAmount', () => {
    it('fails if caller is not owner', async () => {
      await expect(factory.connect(other).enableFeeAmount(100, 2)).to.be.reverted
    })
    it('fails if fee is too great', async () => {
      await expect(factory.enableFeeAmount(1000000, 10)).to.be.reverted
    })
    it('fails if tick spacing is too small', async () => {
      await expect(factory.enableFeeAmount(500, 0)).to.be.reverted
    })
    it('fails if tick spacing is too large', async () => {
      await expect(factory.enableFeeAmount(500, 16834)).to.be.reverted
    })
    it('fails if already initialized', async () => {
      await factory.enableFeeAmount(100, 5)
      await expect(factory.enableFeeAmount(100, 10)).to.be.reverted
    })
    it('sets the fee amount in the mapping', async () => {
      await factory.enableFeeAmount(100, 5)
      expect(await factory.feeAmountTickSpacing(100)).to.eq(5)
    })
    it('emits an event', async () => {
      await expect(factory.enableFeeAmount(100, 5))
        .to.emit(factory, 'FeeAmountEnabled')
        .withArgs(100, 5)
    })
    it('enables pool creation', async () => {
      await factory.enableFeeAmount(250, 15)
      await createAndCheckPool([TEST_ADDRESSES[0], TEST_ADDRESSES[1]], 250, 15)
    })
  })
})
