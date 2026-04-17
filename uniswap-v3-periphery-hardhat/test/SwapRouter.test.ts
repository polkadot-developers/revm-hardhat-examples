import { ethers } from "hardhat";
import { expect } from "chai";
import { MaxUint256 } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { MockTimeSwapRouter, UniswapV3Factory, WETH9 } from "../typechain-types";
import { swapRouterFixture, Tokens } from "./shared/fixtures";
import {
  FeeAmount,
  encodePriceSqrt,
  expandTo18Decimals,
  deadlineFromNow,
} from "./shared/utilities";

/**
 * SwapRouter Test Suite
 *
 * Covers the full routing API surface across four entry-points:
 *   exactInputSingle, exactInput (multi-hop), exactOutputSingle, exactOutput (multi-hop)
 *
 * For each entry-point the suite verifies:
 *   - Happy-path token flow (balances, amounts)
 *   - Slippage-protection revert
 *   - V3-specific mechanics (sqrtPriceLimitX96, multi-hop path encoding)
 *
 * Additionally verifies:
 *   - Contract immutables (factory, WETH9)
 *   - On-chain pool-state changes (sqrtPriceX96 moves after each swap type)
 *   - Recipient routing (output arrives at specified address, not caller)
 *
 * Note: loadFixture (hardhat-network-helpers) relies on evm_snapshot which is
 * unavailable on external nodes. Each describe block calls the fixture directly
 * in beforeEach so the suite runs unchanged on localNode and polkadotTestnet.
 */
describe("SwapRouter", () => {
  let wallet: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  let router: MockTimeSwapRouter;
  let factory: UniswapV3Factory;
  let weth9: WETH9;
  let tokens: Tokens;

  before(async () => {
    [wallet, other] = await ethers.getSigners();
  });

  beforeEach("deploy fixture", async () => {
    ({ router, factory, weth9, tokens } = await swapRouterFixture());
  });

  // ─── Immutables ──────────────────────────────────────────────────────────────

  it("constructor — returns correct factory and WETH9 addresses", async () => {
    expect(await router.factory()).to.eq(await factory.getAddress());
    expect(await router.WETH9()).to.eq(await weth9.getAddress());
  });

  // ─── #exactInputSingle ───────────────────────────────────────────────────────

  describe("#exactInputSingle", () => {
    describe("success cases", () => {
      it("swaps token0 for token1 via a single pool", async () => {
        const { token0, token1 } = tokens;
        const bal1Before = await token1.balanceOf(wallet.address);

        await token0.approve(await router.getAddress(), MaxUint256);
        await router.exactInputSingle({
          tokenIn: await token0.getAddress(),
          tokenOut: await token1.getAddress(),
          fee: FeeAmount.MEDIUM,
          recipient: wallet.address,
          deadline: deadlineFromNow(),
          amountIn: expandTo18Decimals(1),
          amountOutMinimum: 0n,
          sqrtPriceLimitX96: 0n,
        });

        expect(await token1.balanceOf(wallet.address)).to.be.gt(bal1Before);
      });

      it("respects sqrtPriceLimitX96 and executes a partial fill", async () => {
        const { token0, token1 } = tokens;
        // zeroForOne swap: price moves DOWN; limit must be BELOW current 1:1 price
        const limitPrice = encodePriceSqrt(99, 100);
        const bal1Before = await token1.balanceOf(wallet.address);

        await token0.approve(await router.getAddress(), MaxUint256);
        await router.exactInputSingle({
          tokenIn: await token0.getAddress(),
          tokenOut: await token1.getAddress(),
          fee: FeeAmount.MEDIUM,
          recipient: wallet.address,
          deadline: deadlineFromNow(),
          amountIn: expandTo18Decimals(10),
          amountOutMinimum: 0n,
          sqrtPriceLimitX96: limitPrice,
        });

        const bal1After = await token1.balanceOf(wallet.address);
        // partial fill: received > 0 but less than an uncapped swap would give
        expect(bal1After).to.be.gte(bal1Before);
        expect(bal1After - bal1Before).to.be.lt(expandTo18Decimals(10));
      });

      it("sends output tokens to the specified recipient, not the caller", async () => {
        const { token0, token1 } = tokens;
        const bal1Other = await token1.balanceOf(other.address);

        await token0.approve(await router.getAddress(), MaxUint256);
        await router.exactInputSingle({
          tokenIn: await token0.getAddress(),
          tokenOut: await token1.getAddress(),
          fee: FeeAmount.MEDIUM,
          recipient: other.address,
          deadline: deadlineFromNow(),
          amountIn: expandTo18Decimals(1),
          amountOutMinimum: 0n,
          sqrtPriceLimitX96: 0n,
        });

        expect(await token1.balanceOf(other.address)).to.be.gt(bal1Other);
      });
    });

    describe("failure cases", () => {
      it("reverts when output is below amountOutMinimum", async () => {
        const { token0, token1 } = tokens;
        await token0.approve(await router.getAddress(), MaxUint256);

        await expect(
          router.exactInputSingle({
            tokenIn: await token0.getAddress(),
            tokenOut: await token1.getAddress(),
            fee: FeeAmount.MEDIUM,
            recipient: wallet.address,
            deadline: deadlineFromNow(),
            amountIn: expandTo18Decimals(1),
            amountOutMinimum: MaxUint256,
            sqrtPriceLimitX96: 0n,
          })
        ).to.be.reverted;
      });
    });
  });

  // ─── #exactInput (multi-hop) ─────────────────────────────────────────────────

  describe("#exactInput", () => {
    describe("success cases", () => {
      it("swaps token0 → token1 → token2 via two pools", async () => {
        const { token0, token1, token2 } = tokens;
        const bal2Before = await token2.balanceOf(wallet.address);

        await token0.approve(await router.getAddress(), MaxUint256);
        await router.exactInput({
          path: encodePath(
            [
              await token0.getAddress(),
              await token1.getAddress(),
              await token2.getAddress(),
            ],
            [FeeAmount.MEDIUM, FeeAmount.MEDIUM]
          ),
          recipient: wallet.address,
          deadline: deadlineFromNow(),
          amountIn: expandTo18Decimals(1),
          amountOutMinimum: 0n,
        });

        expect(await token2.balanceOf(wallet.address)).to.be.gt(bal2Before);
      });
    });

    describe("failure cases", () => {
      it("reverts when output is below amountOutMinimum", async () => {
        const { token0, token1, token2 } = tokens;
        await token0.approve(await router.getAddress(), MaxUint256);

        await expect(
          router.exactInput({
            path: encodePath(
              [
                await token0.getAddress(),
                await token1.getAddress(),
                await token2.getAddress(),
              ],
              [FeeAmount.MEDIUM, FeeAmount.MEDIUM]
            ),
            recipient: wallet.address,
            deadline: deadlineFromNow(),
            amountIn: expandTo18Decimals(1),
            amountOutMinimum: MaxUint256,
          })
        ).to.be.reverted;
      });
    });
  });

  // ─── #exactOutputSingle ──────────────────────────────────────────────────────

  describe("#exactOutputSingle", () => {
    describe("success cases", () => {
      it("buys an exact amount of token1 using token0", async () => {
        const { token0, token1 } = tokens;
        const amountOut = expandTo18Decimals(1);
        const amountInMax = expandTo18Decimals(2);

        const bal0Before = await token0.balanceOf(wallet.address);
        const bal1Before = await token1.balanceOf(wallet.address);

        await token0.approve(await router.getAddress(), MaxUint256);
        await router.exactOutputSingle({
          tokenIn: await token0.getAddress(),
          tokenOut: await token1.getAddress(),
          fee: FeeAmount.MEDIUM,
          recipient: wallet.address,
          deadline: deadlineFromNow(),
          amountOut,
          amountInMaximum: amountInMax,
          sqrtPriceLimitX96: 0n,
        });

        expect((await token1.balanceOf(wallet.address)) - bal1Before).to.eq(amountOut);
        expect(bal0Before - (await token0.balanceOf(wallet.address))).to.be.lte(amountInMax);
      });

      it("spends strictly less than amountInMaximum when pool has sufficient liquidity", async () => {
        const { token0 } = tokens;
        const amountInMax = expandTo18Decimals(10);
        const bal0Before = await token0.balanceOf(wallet.address);

        await token0.approve(await router.getAddress(), MaxUint256);
        await router.exactOutputSingle({
          tokenIn: await token0.getAddress(),
          tokenOut: await tokens.token1.getAddress(),
          fee: FeeAmount.MEDIUM,
          recipient: wallet.address,
          deadline: deadlineFromNow(),
          amountOut: expandTo18Decimals(1),
          amountInMaximum: amountInMax,
          sqrtPriceLimitX96: 0n,
        });

        const spent = bal0Before - (await token0.balanceOf(wallet.address));
        // In a 1:1 pool, buying 1 token1 costs ~1.003 token0 (0.3% fee)
        expect(spent).to.be.lt(amountInMax);
      });
    });

    describe("failure cases", () => {
      it("reverts when amountInMaximum is exceeded", async () => {
        const { token0, token1 } = tokens;
        await token0.approve(await router.getAddress(), MaxUint256);

        await expect(
          router.exactOutputSingle({
            tokenIn: await token0.getAddress(),
            tokenOut: await token1.getAddress(),
            fee: FeeAmount.MEDIUM,
            recipient: wallet.address,
            deadline: deadlineFromNow(),
            amountOut: expandTo18Decimals(10),
            amountInMaximum: 1n,
            sqrtPriceLimitX96: 0n,
          })
        ).to.be.reverted;
      });
    });
  });

  // ─── #exactOutput (multi-hop) ────────────────────────────────────────────────

  describe("#exactOutput", () => {
    describe("success cases", () => {
      it("buys an exact amount of token2 using token0 through two pools", async () => {
        const { token0, token1, token2 } = tokens;
        const amountOut = expandTo18Decimals(1);
        const bal2Before = await token2.balanceOf(wallet.address);

        await token0.approve(await router.getAddress(), MaxUint256);
        // path is REVERSED for exactOutput: desired token first, payment token last
        await router.exactOutput({
          path: encodePath(
            [
              await token2.getAddress(),
              await token1.getAddress(),
              await token0.getAddress(),
            ],
            [FeeAmount.MEDIUM, FeeAmount.MEDIUM]
          ),
          recipient: wallet.address,
          deadline: deadlineFromNow(),
          amountOut,
          amountInMaximum: expandTo18Decimals(4),
        });

        expect((await token2.balanceOf(wallet.address)) - bal2Before).to.eq(amountOut);
      });
    });

    describe("failure cases", () => {
      it("reverts when amountInMaximum is exceeded (multi-hop)", async () => {
        const { token0, token1, token2 } = tokens;
        await token0.approve(await router.getAddress(), MaxUint256);

        await expect(
          router.exactOutput({
            path: encodePath(
              [
                await token2.getAddress(),
                await token1.getAddress(),
                await token0.getAddress(),
              ],
              [FeeAmount.MEDIUM, FeeAmount.MEDIUM]
            ),
            recipient: wallet.address,
            deadline: deadlineFromNow(),
            amountOut: expandTo18Decimals(10),
            amountInMaximum: 1n,
          })
        ).to.be.reverted;
      });
    });
  });

  // ─── Pool-state changes ───────────────────────────────────────────────────────

  describe("pool price impact", () => {
    it("exactInputSingle moves the pool sqrtPriceX96", async () => {
      const { token0, token1 } = tokens;

      const poolAddr = await factory.getPool(
        await token0.getAddress(),
        await token1.getAddress(),
        FeeAmount.MEDIUM
      );
      const pool = await ethers.getContractAt("IUniswapV3Pool", poolAddr);
      const { sqrtPriceX96: priceBefore } = await pool.slot0();

      await token0.approve(await router.getAddress(), MaxUint256);
      await router.exactInputSingle({
        tokenIn: await token0.getAddress(),
        tokenOut: await token1.getAddress(),
        fee: FeeAmount.MEDIUM,
        recipient: wallet.address,
        deadline: deadlineFromNow(),
        amountIn: expandTo18Decimals(1),
        amountOutMinimum: 0n,
        sqrtPriceLimitX96: 0n,
      });

      const { sqrtPriceX96: priceAfter } = await pool.slot0();
      // selling token0 → price of token0 in terms of token1 falls (sqrtPrice decreases)
      expect(priceAfter).to.be.lt(priceBefore);
    });

    it("exactOutputSingle moves the pool sqrtPriceX96", async () => {
      const { token0, token1 } = tokens;

      const poolAddr = await factory.getPool(
        await token0.getAddress(),
        await token1.getAddress(),
        FeeAmount.MEDIUM
      );
      const pool = await ethers.getContractAt("IUniswapV3Pool", poolAddr);
      const { sqrtPriceX96: priceBefore } = await pool.slot0();

      await token0.approve(await router.getAddress(), MaxUint256);
      await router.exactOutputSingle({
        tokenIn: await token0.getAddress(),
        tokenOut: await token1.getAddress(),
        fee: FeeAmount.MEDIUM,
        recipient: wallet.address,
        deadline: deadlineFromNow(),
        amountOut: expandTo18Decimals(1),
        amountInMaximum: expandTo18Decimals(2),
        sqrtPriceLimitX96: 0n,
      });

      const { sqrtPriceX96: priceAfter } = await pool.slot0();
      expect(priceAfter).to.be.lt(priceBefore);
    });
  });
});

// ─── Path encoding ─────────────────────────────────────────────────────────────

/**
 * Encodes a V3 multi-hop swap path as tightly packed bytes:
 * tokenA ++ uint24(fee) ++ tokenB ++ uint24(fee) ++ tokenC ...
 */
function encodePath(tokenAddresses: string[], fees: FeeAmount[]): string {
  let path = tokenAddresses[0].slice(2).padStart(40, "0");
  for (let i = 0; i < fees.length; i++) {
    path += fees[i].toString(16).padStart(6, "0");
    path += tokenAddresses[i + 1].slice(2).padStart(40, "0");
  }
  return "0x" + path;
}
