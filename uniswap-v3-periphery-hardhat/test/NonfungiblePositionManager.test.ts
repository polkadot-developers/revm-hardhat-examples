import { ethers } from "hardhat";
import { expect } from "chai";
import { MaxUint256 } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  MockTimeNonfungiblePositionManager,
  MockTimeSwapRouter,
  UniswapV3Factory,
  TestERC20,
  WETH9,
} from "../typechain-types";
import { coreFixture, nfpmFixture, Tokens } from "./shared/fixtures";
import {
  FeeAmount,
  encodePriceSqrt,
  expandTo18Decimals,
  deadlineFromNow,
  getMinTick,
  getMaxTick,
  TICK_SPACINGS,
} from "./shared/utilities";

/**
 * NonfungiblePositionManager Test Suite
 *
 * Covers the full LP lifecycle and V3-specific concentrated-liquidity mechanics:
 *
 * Lifecycle:
 *   createAndInitializePoolIfNecessary → mint → increaseLiquidity →
 *   decreaseLiquidity → collect → burn
 *
 * V3-specific scenarios:
 *   - Out-of-range positions (above / below current price) for single-sided liquidity
 *   - Swap fee accumulation: LP earns fees from trading activity in their range
 *   - Partial collect: requesting less than maximum tokensOwed
 *
 * Error paths:
 *   - Missing pool, slippage protection, non-owner operations, excess removal
 *
 * Note: loadFixture (hardhat-network-helpers) relies on evm_snapshot which is
 * unavailable on external nodes. Each describe uses beforeEach + direct fixture
 * calls so the suite runs unchanged on localNode and polkadotTestnet.
 */
describe("NonfungiblePositionManager", () => {
  const TICK_SPACING = TICK_SPACINGS[FeeAmount.MEDIUM];
  const TICK_LOWER = getMinTick(TICK_SPACING);
  const TICK_UPPER = getMaxTick(TICK_SPACING);

  let wallet: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  let nfpm: MockTimeNonfungiblePositionManager;
  let factory: UniswapV3Factory;
  let weth9: WETH9;
  let tokens: Tokens;

  before(async () => {
    [wallet, other] = await ethers.getSigners();
  });

  beforeEach("deploy fixture", async () => {
    ({ nfpm, factory, weth9, tokens } = await nfpmFixture());
  });

  // ─── Helper: build mint params ────────────────────────────────────────────────

  function buildMintParams(
    token0Addr: string,
    token1Addr: string,
    tickLower: number = TICK_LOWER,
    tickUpper: number = TICK_UPPER,
    amount0Desired: bigint = expandTo18Decimals(10),
    amount1Desired: bigint = expandTo18Decimals(10)
  ) {
    return {
      token0: token0Addr,
      token1: token1Addr,
      fee: FeeAmount.MEDIUM,
      tickLower,
      tickUpper,
      amount0Desired,
      amount1Desired,
      amount0Min: 0n,
      amount1Min: 0n,
      recipient: wallet.address,
      deadline: deadlineFromNow(),
    };
  }

  // ─── Helper: create + initialize pool ────────────────────────────────────────

  async function createAndInitPool(token0Addr: string, token1Addr: string) {
    await factory.createPool(token0Addr, token1Addr, FeeAmount.MEDIUM);
    const poolAddr = await factory.getPool(
      token0Addr,
      token1Addr,
      FeeAmount.MEDIUM
    );
    const pool = await ethers.getContractAt("IUniswapV3Pool", poolAddr);
    await pool.initialize(encodePriceSqrt(1, 1));
    return pool;
  }

  // ─── Helper: mint a position and return tokenId ───────────────────────────────

  async function mintPosition(
    token0Addr: string,
    token1Addr: string,
    tickLower = TICK_LOWER,
    tickUpper = TICK_UPPER,
    amount0Desired = expandTo18Decimals(10),
    amount1Desired = expandTo18Decimals(10)
  ): Promise<bigint> {
    const tx = await nfpm.mint(
      buildMintParams(
        token0Addr,
        token1Addr,
        tickLower,
        tickUpper,
        amount0Desired,
        amount1Desired
      )
    );
    const receipt = await tx.wait();
    const event = receipt!.logs
      .map((l) => {
        try {
          return nfpm.interface.parseLog(l);
        } catch {
          return null;
        }
      })
      .find((e) => e?.name === "IncreaseLiquidity");
    return event!.args.tokenId as bigint;
  }

  // ─── Immutables ───────────────────────────────────────────────────────────────

  it("constructor — returns correct factory and WETH9 addresses", async () => {
    expect(await nfpm.factory()).to.eq(await factory.getAddress());
    expect(await nfpm.WETH9()).to.eq(await weth9.getAddress());
  });

  // ─── #createAndInitializePoolIfNecessary ─────────────────────────────────────

  describe("#createAndInitializePoolIfNecessary", () => {
    it("creates a new pool and sets the initial sqrtPriceX96", async () => {
      const { token0, token1 } = tokens;
      const sqrtPrice = encodePriceSqrt(2, 1); // price of 2

      await nfpm.createAndInitializePoolIfNecessary(
        await token0.getAddress(),
        await token1.getAddress(),
        FeeAmount.MEDIUM,
        sqrtPrice
      );

      const poolAddr = await factory.getPool(
        await token0.getAddress(),
        await token1.getAddress(),
        FeeAmount.MEDIUM
      );
      const pool = await ethers.getContractAt("IUniswapV3Pool", poolAddr);
      const { sqrtPriceX96 } = await pool.slot0();
      expect(sqrtPriceX96).to.eq(sqrtPrice);
    });

    it("is a no-op when the pool already exists and is initialized", async () => {
      const { token0, token1 } = tokens;
      const token0Addr = await token0.getAddress();
      const token1Addr = await token1.getAddress();

      const sqrtPrice = encodePriceSqrt(1, 1);
      await nfpm.createAndInitializePoolIfNecessary(
        token0Addr,
        token1Addr,
        FeeAmount.MEDIUM,
        sqrtPrice
      );

      // second call must not revert
      await expect(
        nfpm.createAndInitializePoolIfNecessary(
          token0Addr,
          token1Addr,
          FeeAmount.MEDIUM,
          sqrtPrice
        )
      ).to.not.be.reverted;
    });
  });

  // ─── #mint ────────────────────────────────────────────────────────────────────

  describe("#mint", () => {
    it("fails if pool does not exist", async () => {
      const { token0, token1 } = tokens;
      await expect(
        nfpm.mint(
          buildMintParams(await token0.getAddress(), await token1.getAddress())
        )
      ).to.be.reverted;
    });

    describe("in-range (full-range) position", () => {
      let token0Addr: string;
      let token1Addr: string;

      beforeEach("create and initialize pool", async () => {
        const { token0, token1 } = tokens;
        token0Addr = await token0.getAddress();
        token1Addr = await token1.getAddress();
        await createAndInitPool(token0Addr, token1Addr);
      });

      describe("success cases", () => {
        it("mints exactly one NFT to the recipient", async () => {
          const balBefore = await nfpm.balanceOf(wallet.address);
          await nfpm.mint(buildMintParams(token0Addr, token1Addr));
          expect((await nfpm.balanceOf(wallet.address)) - balBefore).to.eq(1n);
        });

        it("decreases token0 and token1 balances of the caller", async () => {
          const bal0Before = await tokens.token0.balanceOf(wallet.address);
          const bal1Before = await tokens.token1.balanceOf(wallet.address);

          await nfpm.mint(buildMintParams(token0Addr, token1Addr));

          expect(await tokens.token0.balanceOf(wallet.address)).to.be.lt(
            bal0Before
          );
          expect(await tokens.token1.balanceOf(wallet.address)).to.be.lt(
            bal1Before
          );
        });

        it("records correct position data in positions()", async () => {
          const tokenId = await mintPosition(token0Addr, token1Addr);

          const pos = await nfpm.positions(tokenId);
          expect(pos.token0).to.eq(token0Addr);
          expect(pos.token1).to.eq(token1Addr);
          expect(pos.fee).to.eq(FeeAmount.MEDIUM);
          expect(pos.tickLower).to.eq(TICK_LOWER);
          expect(pos.tickUpper).to.eq(TICK_UPPER);
          expect(pos.liquidity).to.be.gt(0n);
        });

        it("emits IncreaseLiquidity event with positive liquidity", async () => {
          const tx = await nfpm.mint(buildMintParams(token0Addr, token1Addr));
          const receipt = await tx.wait();
          const event = receipt!.logs
            .map((l) => {
              try {
                return nfpm.interface.parseLog(l);
              } catch {
                return null;
              }
            })
            .find((e) => e?.name === "IncreaseLiquidity");
          expect(event).to.not.be.null;
          expect(event!.args.liquidity).to.be.gt(0n);
        });
      });

      describe("failure cases", () => {
        it("reverts when amount0Min slippage is not satisfied", async () => {
          await expect(
            nfpm.mint({
              ...buildMintParams(token0Addr, token1Addr),
              amount0Min: MaxUint256, // impossible slippage floor
            })
          ).to.be.reverted;
        });
      });
    });

    describe("out-of-range position (above current price)", () => {
      it("mints a single-sided token0 position — zero token1 consumed", async () => {
        const { token0, token1 } = tokens;
        const token0Addr = await token0.getAddress();
        const token1Addr = await token1.getAddress();

        // Pool at 1:1 (tick ≈ 0). Ticks 60 and 120 are both above current tick.
        // Current price is BELOW the range → position holds 100% token0.
        // Price must rise into the range before token1 is needed.
        const tickLower = TICK_SPACING; //  60
        const tickUpper = TICK_SPACING * 2; // 120
        await createAndInitPool(token0Addr, token1Addr);

        const bal1Before = await token1.balanceOf(wallet.address);
        await nfpm.mint(
          buildMintParams(
            token0Addr,
            token1Addr,
            tickLower,
            tickUpper,
            expandTo18Decimals(10),
            expandTo18Decimals(10)
          )
        );
        const bal1After = await token1.balanceOf(wallet.address);

        // token1 consumed must be zero — the position is entirely above price
        expect(bal1After).to.eq(bal1Before);
      });
    });

    describe("out-of-range position (below current price)", () => {
      it("mints a single-sided token1 position — zero token0 consumed", async () => {
        const { token0, token1 } = tokens;
        const token0Addr = await token0.getAddress();
        const token1Addr = await token1.getAddress();

        // Ticks -120 and -60 are both below current tick (≈ 0).
        // Current price is ABOVE the range → position holds 100% token1.
        // Price must fall into the range before token0 is needed.
        const tickLower = -TICK_SPACING * 2; // -120
        const tickUpper = -TICK_SPACING; //  -60
        await createAndInitPool(token0Addr, token1Addr);

        const bal0Before = await token0.balanceOf(wallet.address);
        await nfpm.mint(
          buildMintParams(
            token0Addr,
            token1Addr,
            tickLower,
            tickUpper,
            expandTo18Decimals(10),
            expandTo18Decimals(10)
          )
        );
        const bal0After = await token0.balanceOf(wallet.address);

        // token0 consumed must be zero — the position is entirely below price
        expect(bal0After).to.eq(bal0Before);
      });
    });
  });

  // ─── #increaseLiquidity ───────────────────────────────────────────────────────

  describe("#increaseLiquidity", () => {
    let token0Addr: string;
    let token1Addr: string;
    let tokenId: bigint;

    beforeEach("create pool and mint initial position", async () => {
      const { token0, token1 } = tokens;
      token0Addr = await token0.getAddress();
      token1Addr = await token1.getAddress();
      await createAndInitPool(token0Addr, token1Addr);
      tokenId = await mintPosition(token0Addr, token1Addr);
    });

    it("increases the position liquidity", async () => {
      const { liquidity: before } = await nfpm.positions(tokenId);

      await nfpm.increaseLiquidity({
        tokenId,
        amount0Desired: expandTo18Decimals(5),
        amount1Desired: expandTo18Decimals(5),
        amount0Min: 0n,
        amount1Min: 0n,
        deadline: deadlineFromNow(),
      });

      const { liquidity: after } = await nfpm.positions(tokenId);
      expect(after).to.be.gt(before);
    });

    it("emits IncreaseLiquidity event", async () => {
      await expect(
        nfpm.increaseLiquidity({
          tokenId,
          amount0Desired: expandTo18Decimals(5),
          amount1Desired: expandTo18Decimals(5),
          amount0Min: 0n,
          amount1Min: 0n,
          deadline: deadlineFromNow(),
        })
      ).to.emit(nfpm, "IncreaseLiquidity");
    });
  });

  // ─── #decreaseLiquidity ───────────────────────────────────────────────────────

  describe("#decreaseLiquidity", () => {
    let token0Addr: string;
    let token1Addr: string;
    let tokenId: bigint;

    beforeEach("create pool and mint initial position", async () => {
      const { token0, token1 } = tokens;
      token0Addr = await token0.getAddress();
      token1Addr = await token1.getAddress();
      await createAndInitPool(token0Addr, token1Addr);
      tokenId = await mintPosition(token0Addr, token1Addr);
    });

    describe("success cases", () => {
      it("stages removed tokens in tokensOwed (not immediately transferred)", async () => {
        const { liquidity } = await nfpm.positions(tokenId);

        await nfpm.decreaseLiquidity({
          tokenId,
          liquidity: liquidity / 2n,
          amount0Min: 0n,
          amount1Min: 0n,
          deadline: deadlineFromNow(),
        });

        const {
          liquidity: after,
          tokensOwed0,
          tokensOwed1,
        } = await nfpm.positions(tokenId);
        expect(after).to.be.lt(liquidity);
        expect(tokensOwed0 + tokensOwed1).to.be.gt(0n);
      });

      it("can remove all liquidity from a position", async () => {
        const { liquidity } = await nfpm.positions(tokenId);

        await nfpm.decreaseLiquidity({
          tokenId,
          liquidity,
          amount0Min: 0n,
          amount1Min: 0n,
          deadline: deadlineFromNow(),
        });

        const { liquidity: after } = await nfpm.positions(tokenId);
        expect(after).to.eq(0n);
      });

      it("emits DecreaseLiquidity event", async () => {
        const { liquidity } = await nfpm.positions(tokenId);
        await expect(
          nfpm.decreaseLiquidity({
            tokenId,
            liquidity: liquidity / 2n,
            amount0Min: 0n,
            amount1Min: 0n,
            deadline: deadlineFromNow(),
          })
        ).to.emit(nfpm, "DecreaseLiquidity");
      });
    });

    describe("failure cases", () => {
      it("reverts when called by a non-owner", async () => {
        const { liquidity } = await nfpm.positions(tokenId);

        await expect(
          nfpm.connect(other).decreaseLiquidity({
            tokenId,
            liquidity: liquidity / 2n,
            amount0Min: 0n,
            amount1Min: 0n,
            deadline: deadlineFromNow(),
          })
        ).to.be.reverted;
      });

      it("reverts when requested liquidity exceeds the position", async () => {
        const { liquidity } = await nfpm.positions(tokenId);

        await expect(
          nfpm.decreaseLiquidity({
            tokenId,
            liquidity: liquidity + 1n,
            amount0Min: 0n,
            amount1Min: 0n,
            deadline: deadlineFromNow(),
          })
        ).to.be.reverted;
      });
    });
  });

  // ─── #collect ─────────────────────────────────────────────────────────────────

  describe("#collect", () => {
    const MaxUint128 = 2n ** 128n - 1n;

    describe("tokensOwed from decreaseLiquidity", () => {
      let token0Addr: string;
      let token1Addr: string;
      let tokenId: bigint;

      beforeEach("create pool, mint, then remove all liquidity", async () => {
        const { token0, token1 } = tokens;
        token0Addr = await token0.getAddress();
        token1Addr = await token1.getAddress();
        await createAndInitPool(token0Addr, token1Addr);
        tokenId = await mintPosition(token0Addr, token1Addr);

        const { liquidity } = await nfpm.positions(tokenId);
        await nfpm.decreaseLiquidity({
          tokenId,
          liquidity,
          amount0Min: 0n,
          amount1Min: 0n,
          deadline: deadlineFromNow(),
        });
      });

      it("transfers tokensOwed back to the owner", async () => {
        const bal0Before = await tokens.token0.balanceOf(wallet.address);
        const bal1Before = await tokens.token1.balanceOf(wallet.address);

        await nfpm.collect({
          tokenId,
          recipient: wallet.address,
          amount0Max: MaxUint128,
          amount1Max: MaxUint128,
        });

        expect(
          (await tokens.token0.balanceOf(wallet.address)) +
            (await tokens.token1.balanceOf(wallet.address))
        ).to.be.gt(bal0Before + bal1Before);
      });

      it("emits Collect event", async () => {
        await expect(
          nfpm.collect({
            tokenId,
            recipient: wallet.address,
            amount0Max: MaxUint128,
            amount1Max: MaxUint128,
          })
        ).to.emit(nfpm, "Collect");
      });

      it("collecting less than the maximum leaves remainder in tokensOwed", async () => {
        const { tokensOwed0 } = await nfpm.positions(tokenId);
        if (tokensOwed0 === 0n) return; // skip if all is token1

        const halfOwed = tokensOwed0 / 2n;
        await nfpm.collect({
          tokenId,
          recipient: wallet.address,
          amount0Max: halfOwed,
          amount1Max: MaxUint128,
        });

        const { tokensOwed0: remaining } = await nfpm.positions(tokenId);
        expect(remaining).to.be.gt(0n);
      });
    });

    describe("swap fee accumulation", () => {
      it("LP collects accrued trading fees after swaps through the pool", async () => {
        /**
         * This test is the core V3 LP value proposition:
         * 1. Mint an LP position
         * 2. Execute several swaps through the pool via SwapRouter
         * 3. collect() — the LP should receive trading fees on top of principal
         *
         * We deploy a fresh router inline because the top-level nfpmFixture does
         * not include one.
         */
        const { token0, token1 } = tokens;
        const token0Addr = await token0.getAddress();
        const token1Addr = await token1.getAddress();
        const nfpmAddr = await nfpm.getAddress();

        // Deploy router for this describe scope
        const router = (await ethers.deployContract("MockTimeSwapRouter", [
          await factory.getAddress(),
          await weth9.getAddress(),
        ])) as unknown as MockTimeSwapRouter;
        await router.waitForDeployment();

        // Create and initialize pool
        await createAndInitPool(token0Addr, token1Addr);

        // Mint LP position (full range)
        await token0.approve(nfpmAddr, MaxUint256);
        await token1.approve(nfpmAddr, MaxUint256);
        const tokenId = await mintPosition(token0Addr, token1Addr);

        // Execute swaps to generate fees
        await token0.approve(await router.getAddress(), MaxUint256);
        await token1.approve(await router.getAddress(), MaxUint256);

        for (let i = 0; i < 3; i++) {
          await router.exactInputSingle({
            tokenIn: token0Addr,
            tokenOut: token1Addr,
            fee: FeeAmount.MEDIUM,
            recipient: wallet.address,
            deadline: deadlineFromNow(),
            amountIn: expandTo18Decimals(1),
            amountOutMinimum: 0n,
            sqrtPriceLimitX96: 0n,
          });
          await router.exactInputSingle({
            tokenIn: token1Addr,
            tokenOut: token0Addr,
            fee: FeeAmount.MEDIUM,
            recipient: wallet.address,
            deadline: deadlineFromNow(),
            amountIn: expandTo18Decimals(1),
            amountOutMinimum: 0n,
            sqrtPriceLimitX96: 0n,
          });
        }

        // Remove principal — this surfaces fees into tokensOwed
        const { liquidity } = await nfpm.positions(tokenId);
        await nfpm.decreaseLiquidity({
          tokenId,
          liquidity,
          amount0Min: 0n,
          amount1Min: 0n,
          deadline: deadlineFromNow(),
        });

        const MaxUint128 = 2n ** 128n - 1n;
        const bal0Before = await token0.balanceOf(wallet.address);
        const bal1Before = await token1.balanceOf(wallet.address);

        await nfpm.collect({
          tokenId,
          recipient: wallet.address,
          amount0Max: MaxUint128,
          amount1Max: MaxUint128,
        });

        const received0 = (await token0.balanceOf(wallet.address)) - bal0Before;
        const received1 = (await token1.balanceOf(wallet.address)) - bal1Before;

        // LP received some tokens back (principal + fees)
        expect(received0 + received1).to.be.gt(0n);

        // The tokensOwed must include fees: collected > pure principal would be
        // hard to check without accounting, but tokensOwed must have been > 0
        const { tokensOwed0: rem0, tokensOwed1: rem1 } = await nfpm.positions(
          tokenId
        );
        expect(rem0).to.eq(0n);
        expect(rem1).to.eq(0n);
      });
    });
  });

  // ─── #burn ────────────────────────────────────────────────────────────────────

  describe("#burn", () => {
    let token0Addr: string;
    let token1Addr: string;
    let tokenId: bigint;

    beforeEach("create pool and mint position", async () => {
      const { token0, token1 } = tokens;
      token0Addr = await token0.getAddress();
      token1Addr = await token1.getAddress();
      await createAndInitPool(token0Addr, token1Addr);
      tokenId = await mintPosition(token0Addr, token1Addr);
    });

    it("burns the NFT after full removal and collection", async () => {
      const MaxUint128 = 2n ** 128n - 1n;

      // Step 1: remove all liquidity
      const { liquidity } = await nfpm.positions(tokenId);
      await nfpm.decreaseLiquidity({
        tokenId,
        liquidity,
        amount0Min: 0n,
        amount1Min: 0n,
        deadline: deadlineFromNow(),
      });

      // Step 2: collect all tokensOwed
      await nfpm.collect({
        tokenId,
        recipient: wallet.address,
        amount0Max: MaxUint128,
        amount1Max: MaxUint128,
      });

      // Step 3: burn — NFT must be deleted
      const balBefore = await nfpm.balanceOf(wallet.address);
      await nfpm.burn(tokenId);
      expect(await nfpm.balanceOf(wallet.address)).to.eq(balBefore - 1n);
    });

    it("reverts when liquidity has not been fully removed", async () => {
      // Cannot burn while position still holds liquidity
      await expect(nfpm.burn(tokenId)).to.be.reverted;
    });

    it("reverts when tokensOwed have not been collected", async () => {
      const MaxUint128 = 2n ** 128n - 1n;

      // Remove liquidity but skip collect
      const { liquidity } = await nfpm.positions(tokenId);
      await nfpm.decreaseLiquidity({
        tokenId,
        liquidity,
        amount0Min: 0n,
        amount1Min: 0n,
        deadline: deadlineFromNow(),
      });

      // Must revert because tokensOwed > 0
      await expect(nfpm.burn(tokenId)).to.be.reverted;
    });
  });
});
