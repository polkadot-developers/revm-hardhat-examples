import { expect } from "chai";
import { ethers } from "hardhat";
import {
  ZeroAddress,
  keccak256,
  solidityPacked,
  getCreate2Address,
} from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ERC20 } from "../typechain-types/test/ERC20";
import { UniswapV2Factory } from "../typechain-types/UniswapV2Factory";
import { UniswapV2Pair } from "../typechain-types/UniswapV2Pair";
import { expandTo18Decimals } from "./shared/utilities";

const TOTAL_SUPPLY = expandTo18Decimals(10000);
const MINIMUM_LIQUIDITY = BigInt("1000");

describe("UniswapV2Pair", function () {
  let factory: UniswapV2Factory;
  let token0: ERC20;
  let token1: ERC20;
  let pair: UniswapV2Pair;

  let wallet: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  beforeEach(async function () {
    [wallet, other] = await ethers.getSigners();

    const UniswapV2Pair = await ethers.getContractFactory("UniswapV2Pair");

    const ERC20 = await ethers.getContractFactory("ERC20");
    token0 = await ERC20.deploy(TOTAL_SUPPLY);
    await token0.waitForDeployment();

    token1 = await ERC20.deploy(TOTAL_SUPPLY);
    await token1.waitForDeployment();

    const UniswapV2Factory = await ethers.getContractFactory(
      "UniswapV2Factory",
      wallet
    );
    factory = await UniswapV2Factory.deploy(wallet.address);
    await factory.waitForDeployment();

    const token0Address = await token0.getAddress();
    const token1Address = await token1.getAddress();

    [token0, token1] =
      BigInt(token0Address) < BigInt(token1Address)
        ? [token0, token1]
        : [token1, token0];

    const first = await token0.getAddress();
    const second = await token1.getAddress();

    const bytecode = UniswapV2Pair.bytecode;
    const initCodeHash = keccak256(bytecode);
    const salt = keccak256(
      solidityPacked(["address", "address"], [first, second])
    );
    const create2Address = getCreate2Address(
      await factory.getAddress(),
      salt,
      initCodeHash
    );

    await expect(factory.createPair(token0Address, token1Address))
      .to.emit(factory, "PairCreated")
      .withArgs(first, second, create2Address, 1n);

    pair = await ethers.getContractAt("UniswapV2Pair", create2Address);
    expect(await pair.token0()).to.equal(first);
    expect(await pair.token1()).to.equal(second);
  });

  it("mint", async function () {
    const token0Amount = expandTo18Decimals(1);
    const pairAddress = await pair.getAddress();
    const token1Amount = expandTo18Decimals(4);
    await token0.transfer(pairAddress, token0Amount);
    await token1.transfer(pairAddress, token1Amount);

    const expectedLiquidity = expandTo18Decimals(2);

    await expect(pair.mint(wallet.address))
      .to.emit(pair, "Transfer")
      .withArgs(ZeroAddress, ZeroAddress, MINIMUM_LIQUIDITY)
      .to.emit(pair, "Transfer")
      .withArgs(
        ZeroAddress,
        wallet.address,
        expectedLiquidity - MINIMUM_LIQUIDITY
      )
      .to.emit(pair, "Sync")
      .withArgs(token0Amount, token1Amount)
      .to.emit(pair, "Mint")
      .withArgs(wallet.address, token0Amount, token1Amount);

    expect(await pair.totalSupply()).to.equal(expectedLiquidity);
    expect(await pair.balanceOf(wallet.address)).to.equal(
      expectedLiquidity - MINIMUM_LIQUIDITY
    );
    expect(await token0.balanceOf(await pair.getAddress())).to.equal(
      token0Amount
    );
    expect(await token1.balanceOf(await pair.getAddress())).to.equal(
      token1Amount
    );
    const reserves = await pair.getReserves();
    expect(reserves[0]).to.equal(token0Amount);
    expect(reserves[1]).to.equal(token1Amount);
  });

  async function addLiquidity(token0Amount: bigint, token1Amount: bigint) {
    await token0.transfer(await pair.getAddress(), token0Amount);
    await token1.transfer(await pair.getAddress(), token1Amount);
    await pair.mint(wallet.address);
  }

  const swapTestCases = [
    [1, 5, 10, "1662497915624478906"],
    [1, 10, 5, "453305446940074565"],
    [2, 5, 10, "2851015155847869602"],
    [2, 10, 5, "831248957812239453"],
    [1, 10, 10, "906610893880149131"],
    [1, 100, 100, "987158034397061298"],
    [1, 1000, 1000, "996006981039903216"],
  ].map((a) =>
    a.map((n) =>
      typeof n === "string" ? BigInt(n) : expandTo18Decimals(n as number)
    )
  );

  swapTestCases.forEach((swapTestCase, i) => {
    it(`getInputPrice:${i}`, async function () {
      const [swapAmount, token0Amount, token1Amount, expectedOutputAmount] =
        swapTestCase;
      await addLiquidity(token0Amount, token1Amount);
      await token0.transfer(await pair.getAddress(), swapAmount);
      await expect(
        pair.swap(0, expectedOutputAmount + 1n, wallet.address, "0x")
      ).to.be.revertedWith("UniswapV2: K");
      await pair.swap(0, expectedOutputAmount, wallet.address, "0x");
    });
  });

  const optimisticTestCases = [
    ["997000000000000000", 5, 10, 1],
    ["997000000000000000", 10, 5, 1],
    ["997000000000000000", 5, 5, 1],
    [1, 5, 5, "1003009027081243732"],
  ].map((a) =>
    a.map((n) =>
      typeof n === "string" ? BigInt(n) : expandTo18Decimals(n as number)
    )
  );

  optimisticTestCases.forEach((optimisticTestCase, i) => {
    it(`optimistic:${i}`, async function () {
      const [outputAmount, token0Amount, token1Amount, inputAmount] =
        optimisticTestCase;
      await addLiquidity(token0Amount, token1Amount);
      await token0.transfer(await pair.getAddress(), inputAmount);
      await expect(
        pair.swap(outputAmount + 1n, 0, wallet.address, "0x")
      ).to.be.revertedWith("UniswapV2: K");
      await pair.swap(outputAmount, 0, wallet.address, "0x");
    });
  });

  it("swap:token0", async function () {
    const token0Amount = expandTo18Decimals(5);
    const token1Amount = expandTo18Decimals(10);
    await addLiquidity(token0Amount, token1Amount);

    const swapAmount = expandTo18Decimals(1);
    const expectedOutputAmount = BigInt("1662497915624478906");
    await token0.transfer(await pair.getAddress(), swapAmount);

    await expect(pair.swap(0, expectedOutputAmount, wallet.address, "0x"))
      .to.emit(token1, "Transfer")
      .withArgs(await pair.getAddress(), wallet.address, expectedOutputAmount)
      .to.emit(pair, "Sync")
      .withArgs(token0Amount + swapAmount, token1Amount - expectedOutputAmount)
      .to.emit(pair, "Swap")
      .withArgs(
        wallet.address,
        swapAmount,
        0,
        0,
        expectedOutputAmount,
        wallet.address
      );
    const reserves = await pair.getReserves();
    expect(reserves[0]).to.equal(token0Amount + swapAmount);
    expect(reserves[1]).to.equal(token1Amount - expectedOutputAmount);
    expect(await token0.balanceOf(await pair.getAddress())).to.equal(
      token0Amount + swapAmount
    );
    expect(await token1.balanceOf(await pair.getAddress())).to.equal(
      token1Amount - expectedOutputAmount
    );
    const totalSupplyToken0 = await token0.totalSupply();
    const totalSupplyToken1 = await token1.totalSupply();
    expect(await token0.balanceOf(wallet.address)).to.equal(
      totalSupplyToken0 - token0Amount - swapAmount
    );
    expect(await token1.balanceOf(wallet.address)).to.equal(
      totalSupplyToken1 - token1Amount + expectedOutputAmount
    );
  });

  it("swap:token1", async function () {
    const token0Amount = expandTo18Decimals(5);
    const token1Amount = expandTo18Decimals(10);
    await addLiquidity(token0Amount, token1Amount);

    const swapAmount = expandTo18Decimals(1);
    const expectedOutputAmount = BigInt("453305446940074565");
    await token1.transfer(await pair.getAddress(), swapAmount);
    await expect(pair.swap(expectedOutputAmount, 0, wallet.address, "0x"))
      .to.emit(token0, "Transfer")
      .withArgs(await pair.getAddress(), wallet.address, expectedOutputAmount)
      .to.emit(pair, "Sync")
      .withArgs(token0Amount - expectedOutputAmount, token1Amount + swapAmount)
      .to.emit(pair, "Swap")
      .withArgs(
        wallet.address,
        0,
        swapAmount,
        expectedOutputAmount,
        0,
        wallet.address
      );

    const reserves = await pair.getReserves();
    expect(reserves[0]).to.equal(token0Amount - expectedOutputAmount);
    expect(reserves[1]).to.equal(token1Amount + swapAmount);
    expect(await token0.balanceOf(await pair.getAddress())).to.equal(
      token0Amount - expectedOutputAmount
    );
    expect(await token1.balanceOf(await pair.getAddress())).to.equal(
      token1Amount + swapAmount
    );
    const totalSupplyToken0 = await token0.totalSupply();
    const totalSupplyToken1 = await token1.totalSupply();
    expect(await token0.balanceOf(wallet.address)).to.equal(
      totalSupplyToken0 - token0Amount + expectedOutputAmount
    );
    expect(await token1.balanceOf(wallet.address)).to.equal(
      totalSupplyToken1 - token1Amount - swapAmount
    );
  });

  it("burn", async function () {
    const token0Amount = expandTo18Decimals(3);
    const token1Amount = expandTo18Decimals(3);
    await addLiquidity(token0Amount, token1Amount);

    const expectedLiquidity = expandTo18Decimals(3);
    await pair.transfer(
      await pair.getAddress(),
      expectedLiquidity - MINIMUM_LIQUIDITY
    );
    await expect(pair.burn(wallet.address))
      .to.emit(pair, "Transfer")
      .withArgs(
        await pair.getAddress(),
        ZeroAddress,
        expectedLiquidity - MINIMUM_LIQUIDITY
      )
      .to.emit(token0, "Transfer")
      .withArgs(
        await pair.getAddress(),
        wallet.address,
        token0Amount - BigInt(1000)
      )
      .to.emit(token1, "Transfer")
      .withArgs(
        await pair.getAddress(),
        wallet.address,
        token1Amount - BigInt(1000)
      )
      .to.emit(pair, "Sync")
      .withArgs(1000, 1000)
      .to.emit(pair, "Burn")
      .withArgs(
        wallet.address,
        token0Amount - BigInt(1000),
        token1Amount - BigInt(1000),
        wallet.address
      );

    expect(await pair.balanceOf(wallet.address)).to.equal(0);
    expect(await pair.totalSupply()).to.equal(MINIMUM_LIQUIDITY);
    expect(await token0.balanceOf(await pair.getAddress())).to.equal(1000);
    expect(await token1.balanceOf(await pair.getAddress())).to.equal(1000);
    const totalSupplyToken0 = await token0.totalSupply();
    const totalSupplyToken1 = await token1.totalSupply();
    expect(await token0.balanceOf(wallet.address)).to.equal(
      totalSupplyToken0 - BigInt(1000)
    );
    expect(await token1.balanceOf(wallet.address)).to.equal(
      totalSupplyToken1 - BigInt(1000)
    );
  });

  it("feeTo:off", async function () {
    const token0Amount = expandTo18Decimals(1000);
    const token1Amount = expandTo18Decimals(1000);
    await addLiquidity(token0Amount, token1Amount);

    const swapAmount = expandTo18Decimals(1);
    const expectedOutputAmount = BigInt("996006981039903216");
    await token1.transfer(await pair.getAddress(), swapAmount);
    await pair.swap(expectedOutputAmount, 0, wallet.address, "0x");

    const expectedLiquidity = expandTo18Decimals(1000);
    await pair.transfer(
      await pair.getAddress(),
      expectedLiquidity - MINIMUM_LIQUIDITY
    );
    await pair.burn(wallet.address);
    expect(await pair.totalSupply()).to.equal(MINIMUM_LIQUIDITY);
  });

  it("feeTo:on", async function () {
    await factory.setFeeTo(other.address);

    const token0Amount = expandTo18Decimals(1000);
    const token1Amount = expandTo18Decimals(1000);
    await addLiquidity(token0Amount, token1Amount);

    const swapAmount = expandTo18Decimals(1);
    const expectedOutputAmount = BigInt("996006981039903216");
    await token1.transfer(await pair.getAddress(), swapAmount);
    await pair.swap(expectedOutputAmount, 0, wallet.address, "0x");

    const expectedLiquidity = expandTo18Decimals(1000);
    await pair.transfer(
      await pair.getAddress(),
      expectedLiquidity - MINIMUM_LIQUIDITY
    );
    await pair.burn(wallet.address);

    expect(await pair.totalSupply()).to.equal(
      MINIMUM_LIQUIDITY + BigInt("249750499251388")
    );
    expect(await pair.balanceOf(other.address)).to.equal(
      BigInt("249750499251388")
    );

    expect(await token0.balanceOf(await pair.getAddress())).to.equal(
      BigInt(1000) + BigInt("249501683697445")
    );
    expect(await token1.balanceOf(await pair.getAddress())).to.equal(
      BigInt(1000) + BigInt("250000187312969")
    );
  });
});
