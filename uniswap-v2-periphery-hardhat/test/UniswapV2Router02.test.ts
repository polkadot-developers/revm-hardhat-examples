import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Wallet, Signature } from "ethers";
import { MaxUint256 } from "ethers";
import {
  expandTo18Decimals,
  MINIMUM_LIQUIDITY,
} from "./shared/utilities";
import { v2Fixture } from "./shared/fixtures";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("UniswapV2Router02", () => {
  let token0: Contract;
  let token1: Contract;
  let router: Contract;
  let wallet: HardhatEthersSigner;

  beforeEach(async function () {
    wallet = (await ethers.getSigners())[0];
    const fixture = await v2Fixture();
    token0 = fixture.token0;
    token1 = fixture.token1;
    router = fixture.router02;
  });

  it("quote", async () => {
    expect(await router.quote(1, 100, 200)).to.eq(2);
    expect(await router.quote(2, 200, 100)).to.eq(1);
    await expect(router.quote(0, 100, 200)).to.be.revertedWith(
      "UniswapV2Library: INSUFFICIENT_AMOUNT"
    );
    await expect(router.quote(1, 0, 200)).to.be.revertedWith(
      "UniswapV2Library: INSUFFICIENT_LIQUIDITY"
    );
    await expect(router.quote(1, 100, 0)).to.be.revertedWith(
      "UniswapV2Library: INSUFFICIENT_LIQUIDITY"
    );
  });

  it("getAmountOut", async () => {
    expect(await router.getAmountOut(2, 100, 100)).to.eq(1);
    await expect(router.getAmountOut(0, 100, 100)).to.be.revertedWith(
      "UniswapV2Library: INSUFFICIENT_INPUT_AMOUNT"
    );
    await expect(router.getAmountOut(2, 0, 100)).to.be.revertedWith(
      "UniswapV2Library: INSUFFICIENT_LIQUIDITY"
    );
    await expect(router.getAmountOut(2, 100, 0)).to.be.revertedWith(
      "UniswapV2Library: INSUFFICIENT_LIQUIDITY"
    );
  });

  it("getAmountIn", async () => {
    expect(await router.getAmountIn(1, 100, 100)).to.eq(2);
    await expect(router.getAmountIn(0, 100, 100)).to.be.revertedWith(
      "UniswapV2Library: INSUFFICIENT_OUTPUT_AMOUNT"
    );
    await expect(router.getAmountIn(1, 0, 100)).to.be.revertedWith(
      "UniswapV2Library: INSUFFICIENT_LIQUIDITY"
    );
    await expect(router.getAmountIn(1, 100, 0)).to.be.revertedWith(
      "UniswapV2Library: INSUFFICIENT_LIQUIDITY"
    );
  });

  it("getAmountsOut", async () => {
    await token0.approve(await router.getAddress(), MaxUint256);
    await token1.approve(await router.getAddress(), MaxUint256);
    await router.addLiquidity(
      await token0.getAddress(),
      await token1.getAddress(),
      10000,
      10000,
      0,
      0,
      wallet.address,
      MaxUint256
    );
    await expect(
      router.getAmountsOut(2, [await token0.getAddress()])
    ).to.be.revertedWith("UniswapV2Library: INVALID_PATH");
    const path = [await token0.getAddress(), await token1.getAddress()];
    expect(await router.getAmountsOut(2, path)).to.deep.eq([2n, 1n]);
  });

  it("getAmountsIn", async () => {
    await token0.approve(await router.getAddress(), MaxUint256);
    await token1.approve(await router.getAddress(), MaxUint256);
    await router.addLiquidity(
      await token0.getAddress(),
      await token1.getAddress(),
      10000,
      10000,
      0,
      0,
      wallet.address,
      MaxUint256
    );
    await expect(
      router.getAmountsIn(1, [await token0.getAddress()])
    ).to.be.revertedWith("UniswapV2Library: INVALID_PATH");
    const path = [await token0.getAddress(), await token1.getAddress()];
    expect(await router.getAmountsIn(1, path)).to.deep.eq([2n, 1n]);
  });
});

describe("fee-on-transfer tokens", () => {
  let wallet: HardhatEthersSigner;
  let DTT: Contract;
  let WETH: Contract;
  let router: Contract;
  let pair: Contract;

  beforeEach(async function () {
    wallet = (await ethers.getSigners())[0];
    const fixture = await v2Fixture();
    WETH = fixture.WETH;
    router = fixture.router02;
    const DeflatingERC20 =
      await ethers.getContractFactory("DeflatingERC20");
    DTT = await DeflatingERC20.deploy(expandTo18Decimals(10000));
    await DTT.waitForDeployment();
    await fixture.factoryV2.createPair(
      await DTT.getAddress(),
      await WETH.getAddress()
    );
    const pairAddress = await fixture.factoryV2.getPair(
      await DTT.getAddress(),
      await WETH.getAddress()
    );
    pair = await ethers.getContractAt("IUniswapV2Pair", pairAddress);
  });

  afterEach(async function () {
    expect(
      await wallet.provider.getBalance(await router.getAddress())
    ).to.eq(0n);
  });

  async function addLiquidity(DTTAmount: bigint, WETHAmount: bigint) {
    await DTT.approve(await router.getAddress(), MaxUint256);
    await router.addLiquidityETH(
      await DTT.getAddress(),
      DTTAmount,
      DTTAmount,
      WETHAmount,
      wallet.address,
      MaxUint256,
      { value: WETHAmount }
    );
  }

  it("removeLiquidityETHSupportingFeeOnTransferTokens", async () => {
    const DTTAmount = expandTo18Decimals(1);
    const ETHAmount = expandTo18Decimals(4);
    await addLiquidity(DTTAmount, ETHAmount);
    const DTTInPair = await DTT.balanceOf(await pair.getAddress());
    const WETHInPair = await WETH.balanceOf(await pair.getAddress());
    const liquidity = await pair.balanceOf(wallet.address);
    const totalSupply = await pair.totalSupply();
    const NaiveDTTExpected = (DTTInPair * liquidity) / totalSupply;
    const WETHExpected = (WETHInPair * liquidity) / totalSupply;
    await pair.approve(await router.getAddress(), MaxUint256);
    await router.removeLiquidityETHSupportingFeeOnTransferTokens(
      await DTT.getAddress(),
      liquidity,
      NaiveDTTExpected,
      WETHExpected,
      wallet.address,
      MaxUint256
    );
  });

  it("removeLiquidityETHWithPermitSupportingFeeOnTransferTokens", async () => {
    const DTTAmount = (expandTo18Decimals(1) * 100n) / 99n;
    const ETHAmount = expandTo18Decimals(4);
    await addLiquidity(DTTAmount, ETHAmount);

    const liquidity = await pair.balanceOf(wallet.address);

    // Create a local wallet with known private key for permit signing
    const permitSigner = Wallet.createRandom().connect(ethers.provider);
    await wallet.sendTransaction({
      to: permitSigner.address,
      value: expandTo18Decimals(10),
    });
    await pair.transfer(permitSigner.address, liquidity);

    const pairAddress = await pair.getAddress();
    const routerAddress = await router.getAddress();
    const nonce = await pair.nonces(permitSigner.address);
    const name = await pair.name();
    const chainId = (await ethers.provider.getNetwork()).chainId;

    const DTTInPair = await DTT.balanceOf(pairAddress);
    const WETHInPair = await WETH.balanceOf(pairAddress);
    const totalSupply = await pair.totalSupply();
    const NaiveDTTExpected = (DTTInPair * liquidity) / totalSupply;
    const WETHExpected = (WETHInPair * liquidity) / totalSupply;

    const domain = {
      name,
      version: "1",
      chainId,
      verifyingContract: pairAddress,
    };
    const types = {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };
    const message = {
      owner: permitSigner.address,
      spender: routerAddress,
      value: liquidity,
      nonce,
      deadline: MaxUint256,
    };

    const sig = await permitSigner.signTypedData(domain, types, message);
    const { v, r, s } = Signature.from(sig);

    await router.connect(permitSigner).removeLiquidityETHWithPermitSupportingFeeOnTransferTokens(
      await DTT.getAddress(),
      liquidity,
      NaiveDTTExpected,
      WETHExpected,
      permitSigner.address,
      MaxUint256,
      false,
      v,
      r,
      s
    );
  });

  describe("swapExactTokensForTokensSupportingFeeOnTransferTokens", () => {
    const DTTAmount = (expandTo18Decimals(5) * 100n) / 99n;
    const ETHAmount = expandTo18Decimals(10);
    const amountIn = expandTo18Decimals(1);
    beforeEach(async () => {
      await addLiquidity(DTTAmount, ETHAmount);
    });
    it("DTT -> WETH", async () => {
      await DTT.approve(await router.getAddress(), MaxUint256);
      await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
        amountIn,
        0,
        [await DTT.getAddress(), await WETH.getAddress()],
        wallet.address,
        MaxUint256
      );
    });
    it("WETH -> DTT", async () => {
      await WETH.deposit({ value: amountIn });
      await WETH.approve(await router.getAddress(), MaxUint256);
      await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
        amountIn,
        0,
        [await WETH.getAddress(), await DTT.getAddress()],
        wallet.address,
        MaxUint256
      );
    });
  });

  it("swapExactETHForTokensSupportingFeeOnTransferTokens", async () => {
    const DTTAmount = (expandTo18Decimals(10) * 100n) / 99n;
    const ETHAmount = expandTo18Decimals(5);
    const swapAmount = expandTo18Decimals(1);
    await addLiquidity(DTTAmount, ETHAmount);
    await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
      0,
      [await WETH.getAddress(), await DTT.getAddress()],
      wallet.address,
      MaxUint256,
      { value: swapAmount }
    );
  });

  it("swapExactTokensForETHSupportingFeeOnTransferTokens", async () => {
    const DTTAmount = (expandTo18Decimals(5) * 100n) / 99n;
    const ETHAmount = expandTo18Decimals(10);
    const swapAmount = expandTo18Decimals(1);
    await addLiquidity(DTTAmount, ETHAmount);
    await DTT.approve(await router.getAddress(), MaxUint256);
    await router.swapExactTokensForETHSupportingFeeOnTransferTokens(
      swapAmount,
      0,
      [await DTT.getAddress(), await WETH.getAddress()],
      wallet.address,
      MaxUint256
    );
  });
});

describe("fee-on-transfer tokens: reloaded", () => {
  let wallet: HardhatEthersSigner;
  let DTT: Contract;
  let DTT2: Contract;
  let router: Contract;

  beforeEach(async function () {
    [wallet] = await ethers.getSigners();
    const fixture = await v2Fixture();
    router = fixture.router02;
    const DeflatingERC20 =
      await ethers.getContractFactory("DeflatingERC20");
    DTT = await DeflatingERC20.deploy(expandTo18Decimals(10000));
    await DTT.waitForDeployment();
    DTT2 = await DeflatingERC20.deploy(expandTo18Decimals(10000));
    await DTT2.waitForDeployment();
    await fixture.factoryV2.createPair(
      await DTT.getAddress(),
      await DTT2.getAddress()
    );
  });

  afterEach(async function () {
    expect(
      await wallet.provider.getBalance(await router.getAddress())
    ).to.eq(0n);
  });

  async function addLiquidity(DTTAmount: bigint, DTT2Amount: bigint) {
    await DTT.approve(await router.getAddress(), MaxUint256);
    await DTT2.approve(await router.getAddress(), MaxUint256);
    await router.addLiquidity(
      await DTT.getAddress(),
      await DTT2.getAddress(),
      DTTAmount,
      DTT2Amount,
      DTTAmount,
      DTT2Amount,
      wallet.address,
      MaxUint256
    );
  }

  describe("swapExactTokensForTokensSupportingFeeOnTransferTokens", () => {
    const DTTAmount = (expandTo18Decimals(5) * 100n) / 99n;
    const DTT2Amount = expandTo18Decimals(5);
    const amountIn = expandTo18Decimals(1);
    beforeEach(async () => {
      await addLiquidity(DTTAmount, DTT2Amount);
    });
    it("DTT -> DTT2", async () => {
      await DTT.approve(await router.getAddress(), MaxUint256);
      await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
        amountIn,
        0,
        [await DTT.getAddress(), await DTT2.getAddress()],
        wallet.address,
        MaxUint256
      );
    });
  });
});
