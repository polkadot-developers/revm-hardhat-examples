import { ethers } from 'hardhat'
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'
import { NoDelegateCallTest } from '../typechain-types/test/NoDelegateCallTest'
import { expect } from 'chai'

describe('NoDelegateCall', () => {
  let wallet: HardhatEthersSigner
  let other: HardhatEthersSigner

  before('get signers', async () => {
    ;[wallet, other] = await ethers.getSigners()
  })

  let base: NoDelegateCallTest
  let proxy: NoDelegateCallTest

  beforeEach('deploy test contracts', async () => {
    const noDelegateCallTestFactory = await ethers.getContractFactory('NoDelegateCallTest')
    const noDelegateCallTest = (await noDelegateCallTestFactory.deploy()) as unknown as NoDelegateCallTest
    await noDelegateCallTest.waitForDeployment()

    const minimalProxyFactory = new ethers.ContractFactory(
      noDelegateCallTestFactory.interface,
      `3d602d80600a3d3981f3363d3d373d3d3d363d73${(await noDelegateCallTest.getAddress()).slice(2)}5af43d82803e903d91602b57fd5bf3`,
      wallet
    )
    proxy = (await minimalProxyFactory.deploy()) as unknown as NoDelegateCallTest
    await proxy.waitForDeployment()

    base = noDelegateCallTest
  })

  it('proxy can call the method without the modifier', async () => {
    await proxy.canBeDelegateCalled()
  })
  it('proxy cannot call the method with the modifier', async () => {
    await expect(proxy.cannotBeDelegateCalled()).to.be.reverted
  })

  it('can call the method that calls into a private method with the modifier', async () => {
    await base.callsIntoNoDelegateCallFunction()
  })
  it('proxy cannot call the method that calls a private method with the modifier', async () => {
    await expect(proxy.callsIntoNoDelegateCallFunction()).to.be.reverted
  })
})
