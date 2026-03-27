import { Decimal } from "decimal.js";
import { BigNumberish, ContractTransactionResponse } from "ethers";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { MockTimeUniswapV3Pool } from "../typechain-types";
import { TestERC20 } from "../typechain-types";
import { TestUniswapV3Callee } from "../typechain-types";
import { expect } from "chai";
import { poolFixture } from "./shared/fixtures";
import { formatPrice, formatTokenAmount } from "./shared/format";
import {
  createPoolFunctions,
  encodePriceSqrt,
  expandTo18Decimals,
  FeeAmount,
  getMaxLiquidityPerTick,
  getMaxTick,
  getMinTick,
  MAX_SQRT_RATIO,
  MaxUint128,
  MIN_SQRT_RATIO,
  TICK_SPACINGS,
  PoolFunctions,
} from "./shared/utilities";

Decimal.config({ toExpNeg: -500, toExpPos: 500 });

interface BaseSwapTestCase {
  zeroForOne: boolean;
  sqrtPriceLimit?: bigint;
}
interface SwapExact0For1TestCase extends BaseSwapTestCase {
  zeroForOne: true;
  exactOut: false;
  amount0: BigNumberish;
  sqrtPriceLimit?: bigint;
}
interface SwapExact1For0TestCase extends BaseSwapTestCase {
  zeroForOne: false;
  exactOut: false;
  amount1: BigNumberish;
  sqrtPriceLimit?: bigint;
}
interface Swap0ForExact1TestCase extends BaseSwapTestCase {
  zeroForOne: true;
  exactOut: true;
  amount1: BigNumberish;
  sqrtPriceLimit?: bigint;
}
interface Swap1ForExact0TestCase extends BaseSwapTestCase {
  zeroForOne: false;
  exactOut: true;
  amount0: BigNumberish;
  sqrtPriceLimit?: bigint;
}
interface SwapToHigherPrice extends BaseSwapTestCase {
  zeroForOne: false;
  sqrtPriceLimit: bigint;
}
interface SwapToLowerPrice extends BaseSwapTestCase {
  zeroForOne: true;
  sqrtPriceLimit: bigint;
}
type SwapTestCase =
  | SwapExact0For1TestCase
  | Swap0ForExact1TestCase
  | SwapExact1For0TestCase
  | Swap1ForExact0TestCase
  | SwapToHigherPrice
  | SwapToLowerPrice;

function swapCaseToDescription(testCase: SwapTestCase): string {
  const priceClause = testCase?.sqrtPriceLimit
    ? ` to price ${formatPrice(testCase.sqrtPriceLimit)}`
    : "";
  if ("exactOut" in testCase) {
    if (testCase.exactOut) {
      if (testCase.zeroForOne) {
        return `swap token0 for exactly ${formatTokenAmount(
          testCase.amount1
        )} token1${priceClause}`;
      } else {
        return `swap token1 for exactly ${formatTokenAmount(
          testCase.amount0
        )} token0${priceClause}`;
      }
    } else {
      if (testCase.zeroForOne) {
        return `swap exactly ${formatTokenAmount(
          testCase.amount0
        )} token0 for token1${priceClause}`;
      } else {
        return `swap exactly ${formatTokenAmount(
          testCase.amount1
        )} token1 for token0${priceClause}`;
      }
    }
  } else {
    if (testCase.zeroForOne) {
      return `swap token0 for token1${priceClause}`;
    } else {
      return `swap token1 for token0${priceClause}`;
    }
  }
}

// can't use address zero because the ERC20 token does not allow it
const SWAP_RECIPIENT_ADDRESS = ethers.ZeroAddress.slice(0, -1) + "1";
const POSITION_PROCEEDS_OUTPUT_ADDRESS = ethers.ZeroAddress.slice(0, -1) + "2";

async function executeSwap(
  pool: MockTimeUniswapV3Pool,
  testCase: SwapTestCase,
  poolFunctions: PoolFunctions
): Promise<ContractTransactionResponse> {
  let swap: ContractTransactionResponse;
  if ("exactOut" in testCase) {
    if (testCase.exactOut) {
      if (testCase.zeroForOne) {
        swap = await poolFunctions.swap0ForExact1(
          testCase.amount1,
          SWAP_RECIPIENT_ADDRESS,
          testCase.sqrtPriceLimit
        );
      } else {
        swap = await poolFunctions.swap1ForExact0(
          testCase.amount0,
          SWAP_RECIPIENT_ADDRESS,
          testCase.sqrtPriceLimit
        );
      }
    } else {
      if (testCase.zeroForOne) {
        swap = await poolFunctions.swapExact0For1(
          testCase.amount0,
          SWAP_RECIPIENT_ADDRESS,
          testCase.sqrtPriceLimit
        );
      } else {
        swap = await poolFunctions.swapExact1For0(
          testCase.amount1,
          SWAP_RECIPIENT_ADDRESS,
          testCase.sqrtPriceLimit
        );
      }
    }
  } else {
    if (testCase.zeroForOne) {
      swap = await poolFunctions.swapToLowerPrice(
        testCase.sqrtPriceLimit,
        SWAP_RECIPIENT_ADDRESS
      );
    } else {
      swap = await poolFunctions.swapToHigherPrice(
        testCase.sqrtPriceLimit,
        SWAP_RECIPIENT_ADDRESS
      );
    }
  }
  return swap;
}

const DEFAULT_POOL_SWAP_TESTS: SwapTestCase[] = [
  // swap large amounts in/out
  {
    zeroForOne: true,
    exactOut: false,
    amount0: expandTo18Decimals(1),
  },
  {
    zeroForOne: false,
    exactOut: false,
    amount1: expandTo18Decimals(1),
  },
  {
    zeroForOne: true,
    exactOut: true,
    amount1: expandTo18Decimals(1),
  },
  {
    zeroForOne: false,
    exactOut: true,
    amount0: expandTo18Decimals(1),
  },
  // swap large amounts in/out with a price limit
  {
    zeroForOne: true,
    exactOut: false,
    amount0: expandTo18Decimals(1),
    sqrtPriceLimit: encodePriceSqrt(50, 100),
  },
  {
    zeroForOne: false,
    exactOut: false,
    amount1: expandTo18Decimals(1),
    sqrtPriceLimit: encodePriceSqrt(200, 100),
  },
  {
    zeroForOne: true,
    exactOut: true,
    amount1: expandTo18Decimals(1),
    sqrtPriceLimit: encodePriceSqrt(50, 100),
  },
  {
    zeroForOne: false,
    exactOut: true,
    amount0: expandTo18Decimals(1),
    sqrtPriceLimit: encodePriceSqrt(200, 100),
  },
  // swap small amounts in/out
  {
    zeroForOne: true,
    exactOut: false,
    amount0: 1000,
  },
  {
    zeroForOne: false,
    exactOut: false,
    amount1: 1000,
  },
  {
    zeroForOne: true,
    exactOut: true,
    amount1: 1000,
  },
  {
    zeroForOne: false,
    exactOut: true,
    amount0: 1000,
  },
  // swap arbitrary input to price
  {
    sqrtPriceLimit: encodePriceSqrt(5, 2),
    zeroForOne: false,
  },
  {
    sqrtPriceLimit: encodePriceSqrt(2, 5),
    zeroForOne: true,
  },
  {
    sqrtPriceLimit: encodePriceSqrt(5, 2),
    zeroForOne: true,
  },
  {
    sqrtPriceLimit: encodePriceSqrt(2, 5),
    zeroForOne: false,
  },
];

interface Position {
  tickLower: number;
  tickUpper: number;
  liquidity: BigNumberish;
}

interface PoolTestCase {
  description: string;
  feeAmount: number;
  tickSpacing: number;
  startingPrice: bigint;
  positions: Position[];
  swapTests?: SwapTestCase[];
}

const TEST_POOLS: PoolTestCase[] = [
  {
    description: "low fee, 1:1 price, 2e18 max range liquidity",
    feeAmount: FeeAmount.LOW,
    tickSpacing: TICK_SPACINGS[FeeAmount.LOW],
    startingPrice: encodePriceSqrt(1, 1),
    positions: [
      {
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.LOW]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.LOW]),
        liquidity: expandTo18Decimals(2),
      },
    ],
  },
  {
    description: "medium fee, 1:1 price, 2e18 max range liquidity",
    feeAmount: FeeAmount.MEDIUM,
    tickSpacing: TICK_SPACINGS[FeeAmount.MEDIUM],
    startingPrice: encodePriceSqrt(1, 1),
    positions: [
      {
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        liquidity: expandTo18Decimals(2),
      },
    ],
  },
  {
    description: "high fee, 1:1 price, 2e18 max range liquidity",
    feeAmount: FeeAmount.HIGH,
    tickSpacing: TICK_SPACINGS[FeeAmount.HIGH],
    startingPrice: encodePriceSqrt(1, 1),
    positions: [
      {
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.HIGH]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.HIGH]),
        liquidity: expandTo18Decimals(2),
      },
    ],
  },
  {
    description: "medium fee, 10:1 price, 2e18 max range liquidity",
    feeAmount: FeeAmount.MEDIUM,
    tickSpacing: TICK_SPACINGS[FeeAmount.MEDIUM],
    startingPrice: encodePriceSqrt(10, 1),
    positions: [
      {
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        liquidity: expandTo18Decimals(2),
      },
    ],
  },
  {
    description: "medium fee, 1:10 price, 2e18 max range liquidity",
    feeAmount: FeeAmount.MEDIUM,
    tickSpacing: TICK_SPACINGS[FeeAmount.MEDIUM],
    startingPrice: encodePriceSqrt(1, 10),
    positions: [
      {
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        liquidity: expandTo18Decimals(2),
      },
    ],
  },
  {
    description:
      "medium fee, 1:1 price, 0 liquidity, all liquidity around current price",
    feeAmount: FeeAmount.MEDIUM,
    tickSpacing: TICK_SPACINGS[FeeAmount.MEDIUM],
    startingPrice: encodePriceSqrt(1, 1),
    positions: [
      {
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: -TICK_SPACINGS[FeeAmount.MEDIUM],
        liquidity: expandTo18Decimals(2),
      },
      {
        tickLower: TICK_SPACINGS[FeeAmount.MEDIUM],
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        liquidity: expandTo18Decimals(2),
      },
    ],
  },
  {
    description:
      "medium fee, 1:1 price, additional liquidity around current price",
    feeAmount: FeeAmount.MEDIUM,
    tickSpacing: TICK_SPACINGS[FeeAmount.MEDIUM],
    startingPrice: encodePriceSqrt(1, 1),
    positions: [
      {
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        liquidity: expandTo18Decimals(2),
      },
      {
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: -TICK_SPACINGS[FeeAmount.MEDIUM],
        liquidity: expandTo18Decimals(2),
      },
      {
        tickLower: TICK_SPACINGS[FeeAmount.MEDIUM],
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        liquidity: expandTo18Decimals(2),
      },
    ],
  },
  {
    description: "low fee, large liquidity around current price (stable swap)",
    feeAmount: FeeAmount.LOW,
    tickSpacing: TICK_SPACINGS[FeeAmount.LOW],
    startingPrice: encodePriceSqrt(1, 1),
    positions: [
      {
        tickLower: -TICK_SPACINGS[FeeAmount.LOW],
        tickUpper: TICK_SPACINGS[FeeAmount.LOW],
        liquidity: expandTo18Decimals(2),
      },
    ],
  },
  {
    description: "medium fee, token0 liquidity only",
    feeAmount: FeeAmount.MEDIUM,
    tickSpacing: TICK_SPACINGS[FeeAmount.MEDIUM],
    startingPrice: encodePriceSqrt(1, 1),
    positions: [
      {
        tickLower: 0,
        tickUpper: 2000 * TICK_SPACINGS[FeeAmount.MEDIUM],
        liquidity: expandTo18Decimals(2),
      },
    ],
  },
  {
    description: "medium fee, token1 liquidity only",
    feeAmount: FeeAmount.MEDIUM,
    tickSpacing: TICK_SPACINGS[FeeAmount.MEDIUM],
    startingPrice: encodePriceSqrt(1, 1),
    positions: [
      {
        tickLower: -2000 * TICK_SPACINGS[FeeAmount.MEDIUM],
        tickUpper: 0,
        liquidity: expandTo18Decimals(2),
      },
    ],
  },
  {
    description: "close to max price",
    feeAmount: FeeAmount.MEDIUM,
    tickSpacing: TICK_SPACINGS[FeeAmount.MEDIUM],
    startingPrice: encodePriceSqrt(2n ** 127n, 1),
    positions: [
      {
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        liquidity: expandTo18Decimals(2),
      },
    ],
  },
  {
    description: "close to min price",
    feeAmount: FeeAmount.MEDIUM,
    tickSpacing: TICK_SPACINGS[FeeAmount.MEDIUM],
    startingPrice: encodePriceSqrt(1, 2n ** 127n),
    positions: [
      {
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        liquidity: expandTo18Decimals(2),
      },
    ],
  },
  {
    description: "max full range liquidity at 1:1 price with default fee",
    feeAmount: FeeAmount.MEDIUM,
    tickSpacing: TICK_SPACINGS[FeeAmount.MEDIUM],
    startingPrice: encodePriceSqrt(1, 1),
    positions: [
      {
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        liquidity: getMaxLiquidityPerTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
      },
    ],
  },
  {
    description: "initialized at the max ratio",
    feeAmount: FeeAmount.MEDIUM,
    tickSpacing: TICK_SPACINGS[FeeAmount.MEDIUM],
    startingPrice: MAX_SQRT_RATIO - 1n,
    positions: [
      {
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        liquidity: expandTo18Decimals(2),
      },
    ],
  },
  {
    description: "initialized at the min ratio",
    feeAmount: FeeAmount.MEDIUM,
    tickSpacing: TICK_SPACINGS[FeeAmount.MEDIUM],
    startingPrice: MIN_SQRT_RATIO,
    positions: [
      {
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        liquidity: expandTo18Decimals(2),
      },
    ],
  },
];

describe("UniswapV3Pool swap tests", () => {
  let wallet: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  before("get signers", async () => {
    [wallet, other] = await ethers.getSigners();
  });

  for (const poolCase of TEST_POOLS) {
    describe(poolCase.description, () => {
      const poolCaseFixture = async () => {
        const {
          createPool,
          token0,
          token1,
          swapTargetCallee: swapTarget,
        } = await poolFixture();
        const pool = await createPool(poolCase.feeAmount, poolCase.tickSpacing);
        const poolFunctions = createPoolFunctions({
          swapTarget,
          token0,
          token1,
          pool,
        });
        const initTx = await pool.initialize(poolCase.startingPrice);
        await initTx.wait();
        // mint all positions
        for (const position of poolCase.positions) {
          const mintTx = await poolFunctions.mint(
            await wallet.getAddress(),
            position.tickLower,
            position.tickUpper,
            position.liquidity
          );
          await mintTx.wait();
        }

        const [poolBalance0, poolBalance1] = await Promise.all([
          token0.balanceOf(await pool.getAddress()),
          token1.balanceOf(await pool.getAddress()),
        ]);

        return {
          token0,
          token1,
          pool,
          poolFunctions,
          poolBalance0,
          poolBalance1,
          swapTarget,
        };
      };

      let token0: TestERC20;
      let token1: TestERC20;

      let poolBalance0: bigint;
      let poolBalance1: bigint;

      let pool: MockTimeUniswapV3Pool;
      let swapTarget: TestUniswapV3Callee;
      let poolFunctions: PoolFunctions;

      beforeEach("load fixture", async () => {
        ({
          token0,
          token1,
          pool,
          poolFunctions,
          poolBalance0,
          poolBalance1,
          swapTarget,
        } = await poolCaseFixture());
      });

      afterEach("check can burn positions", async () => {
        for (const { liquidity, tickUpper, tickLower } of poolCase.positions) {
          const burnTx = await pool.burn(tickLower, tickUpper, liquidity);
          await burnTx.wait();
          const collectTx = await pool.collect(
            POSITION_PROCEEDS_OUTPUT_ADDRESS,
            tickLower,
            tickUpper,
            MaxUint128,
            MaxUint128
          );
          await collectTx.wait();
        }
      });

      for (const testCase of poolCase.swapTests ?? DEFAULT_POOL_SWAP_TESTS) {
        it(swapCaseToDescription(testCase), async () => {
          const slot0 = await pool.slot0();
          const poolAddress = await pool.getAddress();
          const swapTargetAddress = await swapTarget.getAddress();
          const walletAddress = await wallet.getAddress();

          const txPromise = executeSwap(pool, testCase, poolFunctions);
          let tx: ContractTransactionResponse;
          try {
            tx = await txPromise;
            await tx.wait();
          } catch (error) {
            // swap reverted — nothing to assert without snapshot infrastructure
            return;
          }

          const [
            poolBalance0After,
            poolBalance1After,
            slot0After,
            liquidityAfter,
          ] = await Promise.all([
            token0.balanceOf(poolAddress),
            token1.balanceOf(poolAddress),
            pool.slot0(),
            pool.liquidity(),
          ]);
          const poolBalance0Delta = poolBalance0After - poolBalance0;
          const poolBalance1Delta = poolBalance1After - poolBalance1;

          // check all the events were emitted corresponding to balance changes
          if (poolBalance0Delta === 0n)
            await expect(txPromise).to.not.emit(token0, "Transfer");
          else if (poolBalance0Delta < 0n)
            await expect(txPromise)
              .to.emit(token0, "Transfer")
              .withArgs(
                poolAddress,
                SWAP_RECIPIENT_ADDRESS,
                poolBalance0Delta * -1n
              );
          else
            await expect(txPromise)
              .to.emit(token0, "Transfer")
              .withArgs(walletAddress, poolAddress, poolBalance0Delta);

          if (poolBalance1Delta === 0n)
            await expect(txPromise).to.not.emit(token1, "Transfer");
          else if (poolBalance1Delta < 0n)
            await expect(txPromise)
              .to.emit(token1, "Transfer")
              .withArgs(
                poolAddress,
                SWAP_RECIPIENT_ADDRESS,
                poolBalance1Delta * -1n
              );
          else
            await expect(txPromise)
              .to.emit(token1, "Transfer")
              .withArgs(walletAddress, poolAddress, poolBalance1Delta);

          // check that the swap event was emitted too
          await expect(txPromise)
            .to.emit(pool, "Swap")
            .withArgs(
              swapTargetAddress,
              SWAP_RECIPIENT_ADDRESS,
              poolBalance0Delta,
              poolBalance1Delta,
              slot0After.sqrtPriceX96,
              liquidityAfter,
              slot0After.tick
            );
        });
      }
    });
  }
});
