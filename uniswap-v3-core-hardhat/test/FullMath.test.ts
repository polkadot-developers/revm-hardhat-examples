import { MaxUint256 } from "ethers";
import { ethers } from "hardhat";
import { expect } from "chai";
import { Decimal } from "decimal.js";
import { FullMathTest } from "../typechain-types";

const Q128 = 2n ** 128n;

Decimal.config({ toExpNeg: -500, toExpPos: 500 });

describe("FullMath", () => {
  let fullMath: FullMathTest;

  before("deploy FullMathTest", async () => {
    fullMath = (await ethers.deployContract(
      "FullMathTest"
    )) as unknown as FullMathTest;
    await fullMath.waitForDeployment();
  });

  describe("#mulDiv", () => {
    it("reverts if denominator is 0", async () => {
      await expect(fullMath.mulDiv(Q128, 5, 0)).to.be.reverted;
    });
    it("reverts if denominator is 0 and numerator overflows", async () => {
      await expect(fullMath.mulDiv(Q128, Q128, 0)).to.be.reverted;
    });
    it("reverts if output overflows uint256", async () => {
      await expect(fullMath.mulDiv(Q128, Q128, 1)).to.be.reverted;
    });
    it("reverts on overflow with all max inputs", async () => {
      await expect(fullMath.mulDiv(MaxUint256, MaxUint256, MaxUint256 - 1n)).to
        .be.reverted;
    });
    it("all max inputs", async () => {
      expect(await fullMath.mulDiv(MaxUint256, MaxUint256, MaxUint256)).to.eq(
        MaxUint256
      );
    });
    it("accurate without phantom overflow", async () => {
      const result = Q128 / 3n;
      expect(
        await fullMath.mulDiv(Q128, (50n * Q128) / 100n, (150n * Q128) / 100n)
      ).to.eq(result);
    });
    it("accurate with phantom overflow", async () => {
      // Result ≈ 4.375 * Q128; 512-bit precision may differ by a few units from integer approximation
      const approx = (4375n * Q128) / 1000n;
      const result = await fullMath.mulDiv(
        Q128,
        (35n * Q128) / 10n,
        (8n * Q128) / 10n
      );
      const diff = result >= approx ? result - approx : approx - result;
      expect(diff).to.be.lte(10n);
    });
    it("accurate with phantom overflow and repeating decimal", async () => {
      const result = (1n * Q128) / 3n;
      expect(await fullMath.mulDiv(Q128, 1000n * Q128, 3000n * Q128)).to.eq(
        result
      );
    });
  });

  describe("#mulDivRoundingUp", () => {
    it("reverts if denominator is 0", async () => {
      await expect(fullMath.mulDivRoundingUp(Q128, 5, 0)).to.be.reverted;
    });
    it("reverts if denominator is 0 and numerator overflows", async () => {
      await expect(fullMath.mulDivRoundingUp(Q128, Q128, 0)).to.be.reverted;
    });
    it("reverts if output overflows uint256", async () => {
      await expect(fullMath.mulDivRoundingUp(Q128, Q128, 1)).to.be.reverted;
    });
    it("reverts on overflow with all max inputs", async () => {
      await expect(
        fullMath.mulDivRoundingUp(MaxUint256, MaxUint256, MaxUint256 - 1n)
      ).to.be.reverted;
    });
    it("all max inputs", async () => {
      expect(
        await fullMath.mulDivRoundingUp(MaxUint256, MaxUint256, MaxUint256)
      ).to.eq(MaxUint256);
    });
    it("accurate without phantom overflow", async () => {
      const result = Q128 / 3n + 1n;
      expect(
        await fullMath.mulDivRoundingUp(
          Q128,
          (50n * Q128) / 100n,
          (150n * Q128) / 100n
        )
      ).to.eq(result);
    });
    it("accurate with phantom overflow", async () => {
      // Result ≈ 4.375 * Q128 rounded up; 512-bit precision may differ by a few units from integer approximation
      const approx = (4375n * Q128) / 1000n;
      const result = await fullMath.mulDivRoundingUp(
        Q128,
        (35n * Q128) / 10n,
        (8n * Q128) / 10n
      );
      const diff = result >= approx ? result - approx : approx - result;
      expect(diff).to.be.lte(10n);
    });
    it("accurate with phantom overflow and repeating decimal", async () => {
      const result = (1n * Q128) / 3n + 1n;
      expect(
        await fullMath.mulDivRoundingUp(Q128, 1000n * Q128, 3000n * Q128)
      ).to.eq(result);
    });
  });
});
