import { expect } from 'chai'
import { ethers } from 'hardhat'
import { LiquidityMathTest } from '../typechain-types/test/LiquidityMathTest'

describe('LiquidityMath', () => {
  let liquidityMath: LiquidityMathTest

  beforeEach('deploy LiquidityMathTest', async () => {
    liquidityMath = await ethers.deployContract('LiquidityMathTest') as unknown as LiquidityMathTest
    await liquidityMath.waitForDeployment()
  })

  describe('#addDelta', () => {
    it('1 + 0', async () => {
      expect(await liquidityMath.addDelta(1, 0)).to.eq(1)
    })
    it('1 + -1', async () => {
      expect(await liquidityMath.addDelta(1, -1)).to.eq(0)
    })
    it('1 + 1', async () => {
      expect(await liquidityMath.addDelta(1, 1)).to.eq(2)
    })
    it('2**128-15 + 15 overflows', async () => {
      await expect(liquidityMath.addDelta(2n ** 128n - 15n, 15)).to.be.reverted
    })
    it('0 + -1 underflows', async () => {
      await expect(liquidityMath.addDelta(0, -1)).to.be.reverted
    })
    it('3 + -4 underflows', async () => {
      await expect(liquidityMath.addDelta(3, -4)).to.be.reverted
    })
  })
})
