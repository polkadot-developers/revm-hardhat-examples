import { expect } from "chai";
import { ethers } from "hardhat";
import { keccak256, getCreate2Address, solidityPacked } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ERC20 } from "../typechain-types/test/ERC20";
import { UniswapV2Factory } from "../typechain-types/UniswapV2Factory";
import { expandTo18Decimals } from "./shared/utilities";

const TEST_ADDRESSES: [string, string] = [
  "0x1000000000000000000000000000000000000000",
  "0x2000000000000000000000000000000000000000",
];

const TOTAL_SUPPLY = expandTo18Decimals(10000);

describe("UniswapV2Factory", function () {
  let wallet: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  let token: ERC20;
  let factory: UniswapV2Factory;

  beforeEach(async function () {
    [wallet, other] = await ethers.getSigners();

    const ERC20 = await ethers.getContractFactory("ERC20");
    token = await ERC20.deploy(TOTAL_SUPPLY);
    await token.waitForDeployment();

    const UniswapV2Factory = await ethers.getContractFactory(
      "UniswapV2Factory"
    );
    factory = await UniswapV2Factory.deploy(wallet.address);
    await factory.waitForDeployment();
  });

  it("feeTo, feeToSetter, allPairsLength", async function () {
    expect(await factory.feeTo()).to.equal(ethers.ZeroAddress);
    expect(await factory.feeToSetter()).to.equal(wallet.address);
    expect(await factory.allPairsLength()).to.equal(0);
  });

  async function createPair(tokens: string[]) {
    const UniswapV2Pair = await ethers.getContractFactory("UniswapV2Pair");
    const bytecode = UniswapV2Pair.bytecode;
    const initCodeHash = keccak256(bytecode);
    const [token0, token1] =
      tokens[0] < tokens[1] ? [tokens[0], tokens[1]] : [tokens[1], tokens[0]];

    const salt = keccak256(
      solidityPacked(["address", "address"], [token0, token1])
    );
    const create2Address = getCreate2Address(
      await factory.getAddress(),
      salt,
      initCodeHash
    );

    await expect(factory.createPair(tokens[0], tokens[1]))
      .to.emit(factory, "PairCreated")
      .withArgs(TEST_ADDRESSES[0], TEST_ADDRESSES[1], create2Address, 1n);

    await expect(factory.createPair(...tokens)).to.be.reverted;
    await expect(factory.createPair(...tokens.slice().reverse())).to.be
      .reverted;
    expect(await factory.getPair(...tokens)).to.equal(create2Address);
    expect(await factory.getPair(...tokens.slice().reverse())).to.equal(
      create2Address
    );
    expect(await factory.allPairs(0)).to.equal(create2Address);
    expect(await factory.allPairsLength()).to.equal(1);

    const pair = await ethers.getContractAt("UniswapV2Pair", create2Address);
    expect(await pair.factory()).to.equal(await factory.getAddress());
    expect(await pair.token0()).to.equal(TEST_ADDRESSES[0]);
    expect(await pair.token1()).to.equal(TEST_ADDRESSES[1]);
  }

  it("createPair", async function () {
    await createPair(TEST_ADDRESSES);
  });

  it("createPair:reverse", async function () {
    await createPair(TEST_ADDRESSES.slice().reverse());
  });

  it("setFeeTo", async function () {
    await expect(
      factory.connect(other).setFeeTo(other.address)
    ).to.be.revertedWith("UniswapV2: FORBIDDEN");
    await factory.setFeeTo(wallet.address);
    expect(await factory.feeTo()).to.equal(wallet.address);
  });

  it("setFeeToSetter", async function () {
    await expect(
      factory.connect(other).setFeeToSetter(other.address)
    ).to.be.revertedWith("UniswapV2: FORBIDDEN");

    await factory.setFeeToSetter(other.address);
    expect(await factory.feeToSetter()).to.equal(other.address);
    await expect(factory.setFeeToSetter(wallet.address)).to.be.revertedWith(
      "UniswapV2: FORBIDDEN"
    );
  });
});
