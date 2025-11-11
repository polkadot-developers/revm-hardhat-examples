import { expect } from "chai";
import { ethers } from "hardhat";

describe("MyToken", function () {
  let myToken: any;
  let owner: any;
  let testAddr1: string;
  let testAddr2: string;

  beforeEach(async function () {
    // Get the owner from the configured private key
    const signers = await ethers.getSigners();
    owner = signers[0];
    
    // Create random addresses for testing (not actual signers, just addresses)
    testAddr1 = ethers.Wallet.createRandom().address;
    testAddr2 = ethers.Wallet.createRandom().address;
    
    const MyTokenFactory = await ethers.getContractFactory("MyToken");
    myToken = await MyTokenFactory.deploy(owner.address);
    await myToken.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should have correct name and symbol", async function () {
      expect(await myToken.name()).to.equal("MyToken");
      expect(await myToken.symbol()).to.equal("MTK");
    });

    it("Should set the right owner", async function () {
      expect(await myToken.owner()).to.equal(owner);
    });

    it("Should have zero initial supply", async function () {
      expect(await myToken.totalSupply()).to.equal(0n);
    });
  });

  describe("Minting", function () {
    it("Should allow owner to mint tokens", async function () {
      const amount = 1000n * (10n ** 18n);
      
      await myToken.mint(testAddr1, amount);
      
      expect(await myToken.balanceOf(testAddr1)).to.equal(amount);
    });

    it("Should increase total supply on mint", async function () {
      const amount = 500n * (10n ** 18n);
      
      const initialSupply = await myToken.totalSupply();
      await myToken.mint(testAddr1, amount);
      const finalSupply = await myToken.totalSupply();
      
      expect(finalSupply - initialSupply).to.equal(amount);
    });
  });

  describe("Multiple mints", function () {
    it("Should correctly track balance after multiple mints", async function () {
      const amount1 = 100n * (10n ** 18n);
      const amount2 = 200n * (10n ** 18n);
      
      await myToken.mint(testAddr1, amount1);
      await myToken.mint(testAddr1, amount2);
      
      expect(await myToken.balanceOf(testAddr1)).to.equal(amount1 + amount2);
      expect(await myToken.totalSupply()).to.equal(amount1 + amount2);
    });
  });
});
