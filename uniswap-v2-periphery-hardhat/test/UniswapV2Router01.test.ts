import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Wallet, Signature } from "ethers";
import { MaxUint256, ZeroAddress } from "ethers";
import {
  expandTo18Decimals,
  MINIMUM_LIQUIDITY,
} from "./shared/utilities";
import { v2Fixture } from "./shared/fixtures";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

enum RouterVersion {
  UniswapV2Router01 = "UniswapV2Router01",
  UniswapV2Router02 = "UniswapV2Router02",
}

describe("UniswapV2Router{01,02}", () => {
  for (const routerVersion of Object.keys(RouterVersion)) {
    let token0: Contract;
    let token1: Contract;
    let WETH: Contract;
    let WETHPartner: Contract;
    let factory: Contract;
    let router: Contract;
    let pair: Contract;
    let WETHPair: Contract;
    let routerEventEmitter: Contract;
    let wallet: HardhatEthersSigner;

    beforeEach(async function () {
      wallet = (await ethers.getSigners())[0];
      const fixture = await v2Fixture();
      token0 = fixture.token0;
      token1 = fixture.token1;
      WETH = fixture.WETH;
      WETHPartner = fixture.WETHPartner;
      factory = fixture.factoryV2;
      router = {
        [RouterVersion.UniswapV2Router01]: fixture.router01,
        [RouterVersion.UniswapV2Router02]: fixture.router02,
      }[routerVersion as RouterVersion];
      pair = fixture.pair;
      WETHPair = fixture.WETHPair;
      routerEventEmitter = fixture.routerEventEmitter;
    });

    afterEach(async function () {
      expect(
        await wallet.provider!.getBalance(await router.getAddress())
      ).to.eq(0n);
    });

    describe(routerVersion, () => {
      it("factory, WETH", async () => {
        expect(await router.factory()).to.eq(await factory.getAddress());
        expect(await router.WETH()).to.eq(await WETH.getAddress());
      });

      it("addLiquidity", async () => {
        const token0Amount = expandTo18Decimals(1);
        const token1Amount = expandTo18Decimals(4);

        const expectedLiquidity = expandTo18Decimals(2);
        await token0.approve(await router.getAddress(), MaxUint256);
        await token1.approve(await router.getAddress(), MaxUint256);
        await expect(
          router.addLiquidity(
            await token0.getAddress(),
            await token1.getAddress(),
            token0Amount,
            token1Amount,
            0,
            0,
            wallet.address,
            MaxUint256
          )
        )
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
          .withArgs(await router.getAddress(), token0Amount, token1Amount);

        expect(await pair.balanceOf(wallet.address)).to.eq(
          expectedLiquidity - MINIMUM_LIQUIDITY
        );
      });

      it("addLiquidityETH", async () => {
        const WETHPartnerAmount = expandTo18Decimals(1);
        const ETHAmount = expandTo18Decimals(4);

        const expectedLiquidity = expandTo18Decimals(2);
        const WETHPairToken0 = await WETHPair.token0();
        await WETHPartner.approve(await router.getAddress(), MaxUint256);
        await expect(
          router.addLiquidityETH(
            await WETHPartner.getAddress(),
            WETHPartnerAmount,
            WETHPartnerAmount,
            ETHAmount,
            wallet.address,
            MaxUint256,
            { value: ETHAmount }
          )
        )
          .to.emit(WETHPair, "Transfer")
          .withArgs(ZeroAddress, ZeroAddress, MINIMUM_LIQUIDITY)
          .to.emit(WETHPair, "Transfer")
          .withArgs(
            ZeroAddress,
            wallet.address,
            expectedLiquidity - MINIMUM_LIQUIDITY
          )
          .to.emit(WETHPair, "Sync")
          .withArgs(
            WETHPairToken0 === (await WETHPartner.getAddress())
              ? WETHPartnerAmount
              : ETHAmount,
            WETHPairToken0 === (await WETHPartner.getAddress())
              ? ETHAmount
              : WETHPartnerAmount
          )
          .to.emit(WETHPair, "Mint")
          .withArgs(
            await router.getAddress(),
            WETHPairToken0 === (await WETHPartner.getAddress())
              ? WETHPartnerAmount
              : ETHAmount,
            WETHPairToken0 === (await WETHPartner.getAddress())
              ? ETHAmount
              : WETHPartnerAmount
          );

        expect(await WETHPair.balanceOf(wallet.address)).to.eq(
          expectedLiquidity - MINIMUM_LIQUIDITY
        );
      });

      async function addLiquidity(
        token0Amount: bigint,
        token1Amount: bigint
      ) {
        await token0.transfer(await pair.getAddress(), token0Amount);
        await token1.transfer(await pair.getAddress(), token1Amount);
        await pair.mint(wallet.address);
      }

      it("removeLiquidity", async () => {
        const token0Amount = expandTo18Decimals(1);
        const token1Amount = expandTo18Decimals(4);
        await addLiquidity(token0Amount, token1Amount);

        const expectedLiquidity = expandTo18Decimals(2);
        await pair.approve(await router.getAddress(), MaxUint256);
        await expect(
          router.removeLiquidity(
            await token0.getAddress(),
            await token1.getAddress(),
            expectedLiquidity - MINIMUM_LIQUIDITY,
            0,
            0,
            wallet.address,
            MaxUint256
          )
        )
          .to.emit(pair, "Transfer")
          .withArgs(
            wallet.address,
            await pair.getAddress(),
            expectedLiquidity - MINIMUM_LIQUIDITY
          )
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
            token0Amount - 500n
          )
          .to.emit(token1, "Transfer")
          .withArgs(
            await pair.getAddress(),
            wallet.address,
            token1Amount - 2000n
          )
          .to.emit(pair, "Sync")
          .withArgs(500n, 2000n)
          .to.emit(pair, "Burn")
          .withArgs(
            await router.getAddress(),
            token0Amount - 500n,
            token1Amount - 2000n,
            wallet.address
          );

        expect(await pair.balanceOf(wallet.address)).to.eq(0);
        const totalSupplyToken0 = await token0.totalSupply();
        const totalSupplyToken1 = await token1.totalSupply();
        expect(await token0.balanceOf(wallet.address)).to.eq(
          totalSupplyToken0 - 500n
        );
        expect(await token1.balanceOf(wallet.address)).to.eq(
          totalSupplyToken1 - 2000n
        );
      });

      it("removeLiquidityETH", async () => {
        const WETHPartnerAmount = expandTo18Decimals(1);
        const ETHAmount = expandTo18Decimals(4);
        await WETHPartner.transfer(
          await WETHPair.getAddress(),
          WETHPartnerAmount
        );
        await WETH.deposit({ value: ETHAmount });
        await WETH.transfer(await WETHPair.getAddress(), ETHAmount);
        await WETHPair.mint(wallet.address);

        const expectedLiquidity = expandTo18Decimals(2);
        const WETHPairToken0 = await WETHPair.token0();
        await WETHPair.approve(await router.getAddress(), MaxUint256);
        await expect(
          router.removeLiquidityETH(
            await WETHPartner.getAddress(),
            expectedLiquidity - MINIMUM_LIQUIDITY,
            0,
            0,
            wallet.address,
            MaxUint256
          )
        )
          .to.emit(WETHPair, "Transfer")
          .withArgs(
            wallet.address,
            await WETHPair.getAddress(),
            expectedLiquidity - MINIMUM_LIQUIDITY
          )
          .to.emit(WETHPair, "Transfer")
          .withArgs(
            await WETHPair.getAddress(),
            ZeroAddress,
            expectedLiquidity - MINIMUM_LIQUIDITY
          )
          .to.emit(WETH, "Transfer")
          .withArgs(
            await WETHPair.getAddress(),
            await router.getAddress(),
            ETHAmount - 2000n
          )
          .to.emit(WETHPartner, "Transfer")
          .withArgs(
            await WETHPair.getAddress(),
            await router.getAddress(),
            WETHPartnerAmount - 500n
          )
          .to.emit(WETHPartner, "Transfer")
          .withArgs(
            await router.getAddress(),
            wallet.address,
            WETHPartnerAmount - 500n
          );

        expect(await WETHPair.balanceOf(wallet.address)).to.eq(0);
        const totalSupplyWETHPartner = await WETHPartner.totalSupply();
        const totalSupplyWETH = await WETH.totalSupply();
        expect(await WETHPartner.balanceOf(wallet.address)).to.eq(
          totalSupplyWETHPartner - 500n
        );
        expect(await WETH.balanceOf(wallet.address)).to.eq(
          totalSupplyWETH - 2000n
        );
      });

      it("removeLiquidityWithPermit", async () => {
        const token0Amount = expandTo18Decimals(1);
        const token1Amount = expandTo18Decimals(4);
        await addLiquidity(token0Amount, token1Amount);

        const expectedLiquidity = expandTo18Decimals(2);
        const liquidity = expectedLiquidity - MINIMUM_LIQUIDITY;

        // Create a local wallet with known private key for permit signing
        const permitSigner = Wallet.createRandom().connect(ethers.provider);
        // Fund the permit signer
        await wallet.sendTransaction({
          to: permitSigner.address,
          value: expandTo18Decimals(10),
        });
        // Transfer LP tokens to the permit signer
        await pair.transfer(permitSigner.address, liquidity);

        const pairAddress = await pair.getAddress();
        const routerAddress = await router.getAddress();
        const nonce = await pair.nonces(permitSigner.address);
        const name = await pair.name();
        const chainId = (await ethers.provider.getNetwork()).chainId;

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

        await router.connect(permitSigner).removeLiquidityWithPermit(
          await token0.getAddress(),
          await token1.getAddress(),
          liquidity,
          0,
          0,
          permitSigner.address,
          MaxUint256,
          false,
          v,
          r,
          s
        );
      });

      it("removeLiquidityETHWithPermit", async () => {
        const WETHPartnerAmount = expandTo18Decimals(1);
        const ETHAmount = expandTo18Decimals(4);
        await WETHPartner.transfer(
          await WETHPair.getAddress(),
          WETHPartnerAmount
        );
        await WETH.deposit({ value: ETHAmount });
        await WETH.transfer(await WETHPair.getAddress(), ETHAmount);
        await WETHPair.mint(wallet.address);

        const expectedLiquidity = expandTo18Decimals(2);
        const liquidity = expectedLiquidity - MINIMUM_LIQUIDITY;

        // Create a local wallet with known private key for permit signing
        const permitSigner = Wallet.createRandom().connect(ethers.provider);
        await wallet.sendTransaction({
          to: permitSigner.address,
          value: expandTo18Decimals(10),
        });
        await WETHPair.transfer(permitSigner.address, liquidity);

        const wethPairAddress = await WETHPair.getAddress();
        const routerAddress = await router.getAddress();
        const nonce = await WETHPair.nonces(permitSigner.address);
        const name = await WETHPair.name();
        const chainId = (await ethers.provider.getNetwork()).chainId;

        const domain = {
          name,
          version: "1",
          chainId,
          verifyingContract: wethPairAddress,
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

        await router.connect(permitSigner).removeLiquidityETHWithPermit(
          await WETHPartner.getAddress(),
          liquidity,
          0,
          0,
          permitSigner.address,
          MaxUint256,
          false,
          v,
          r,
          s
        );
      });

      describe("swapExactTokensForTokens", () => {
        const token0Amount = expandTo18Decimals(5);
        const token1Amount = expandTo18Decimals(10);
        const swapAmount = expandTo18Decimals(1);
        const expectedOutputAmount = 1662497915624478906n;

        beforeEach(async () => {
          await addLiquidity(token0Amount, token1Amount);
          await token0.approve(await router.getAddress(), MaxUint256);
        });

        it("happy path", async () => {
          await expect(
            router.swapExactTokensForTokens(
              swapAmount,
              0,
              [await token0.getAddress(), await token1.getAddress()],
              wallet.address,
              MaxUint256
            )
          )
            .to.emit(token0, "Transfer")
            .withArgs(wallet.address, await pair.getAddress(), swapAmount)
            .to.emit(token1, "Transfer")
            .withArgs(
              await pair.getAddress(),
              wallet.address,
              expectedOutputAmount
            )
            .to.emit(pair, "Sync")
            .withArgs(
              token0Amount + swapAmount,
              token1Amount - expectedOutputAmount
            )
            .to.emit(pair, "Swap")
            .withArgs(
              await router.getAddress(),
              swapAmount,
              0,
              0,
              expectedOutputAmount,
              wallet.address
            );
        });

        it("amounts", async () => {
          await token0.approve(
            await routerEventEmitter.getAddress(),
            MaxUint256
          );
          await expect(
            routerEventEmitter.swapExactTokensForTokens(
              await router.getAddress(),
              swapAmount,
              0,
              [await token0.getAddress(), await token1.getAddress()],
              wallet.address,
              MaxUint256
            )
          )
            .to.emit(routerEventEmitter, "Amounts")
            .withArgs([swapAmount, expectedOutputAmount]);
        });
      });

      describe("swapTokensForExactTokens", () => {
        const token0Amount = expandTo18Decimals(5);
        const token1Amount = expandTo18Decimals(10);
        const expectedSwapAmount = 557227237267357629n;
        const outputAmount = expandTo18Decimals(1);

        beforeEach(async () => {
          await addLiquidity(token0Amount, token1Amount);
        });

        it("happy path", async () => {
          await token0.approve(await router.getAddress(), MaxUint256);
          await expect(
            router.swapTokensForExactTokens(
              outputAmount,
              MaxUint256,
              [await token0.getAddress(), await token1.getAddress()],
              wallet.address,
              MaxUint256
            )
          )
            .to.emit(token0, "Transfer")
            .withArgs(
              wallet.address,
              await pair.getAddress(),
              expectedSwapAmount
            )
            .to.emit(token1, "Transfer")
            .withArgs(
              await pair.getAddress(),
              wallet.address,
              outputAmount
            )
            .to.emit(pair, "Sync")
            .withArgs(
              token0Amount + expectedSwapAmount,
              token1Amount - outputAmount
            )
            .to.emit(pair, "Swap")
            .withArgs(
              await router.getAddress(),
              expectedSwapAmount,
              0,
              0,
              outputAmount,
              wallet.address
            );
        });

        it("amounts", async () => {
          await token0.approve(
            await routerEventEmitter.getAddress(),
            MaxUint256
          );
          await expect(
            routerEventEmitter.swapTokensForExactTokens(
              await router.getAddress(),
              outputAmount,
              MaxUint256,
              [await token0.getAddress(), await token1.getAddress()],
              wallet.address,
              MaxUint256
            )
          )
            .to.emit(routerEventEmitter, "Amounts")
            .withArgs([expectedSwapAmount, outputAmount]);
        });
      });

      describe("swapExactETHForTokens", () => {
        const WETHPartnerAmount = expandTo18Decimals(10);
        const ETHAmount = expandTo18Decimals(5);
        const swapAmount = expandTo18Decimals(1);
        const expectedOutputAmount = 1662497915624478906n;

        beforeEach(async () => {
          await WETHPartner.transfer(
            await WETHPair.getAddress(),
            WETHPartnerAmount
          );
          await WETH.deposit({ value: ETHAmount });
          await WETH.transfer(await WETHPair.getAddress(), ETHAmount);
          await WETHPair.mint(wallet.address);

          await token0.approve(await router.getAddress(), MaxUint256);
        });

        it("happy path", async () => {
          const WETHPairToken0 = await WETHPair.token0();
          await expect(
            router.swapExactETHForTokens(
              0,
              [await WETH.getAddress(), await WETHPartner.getAddress()],
              wallet.address,
              MaxUint256,
              { value: swapAmount }
            )
          )
            .to.emit(WETH, "Transfer")
            .withArgs(
              await router.getAddress(),
              await WETHPair.getAddress(),
              swapAmount
            )
            .to.emit(WETHPartner, "Transfer")
            .withArgs(
              await WETHPair.getAddress(),
              wallet.address,
              expectedOutputAmount
            );
        });

        it("amounts", async () => {
          await expect(
            routerEventEmitter.swapExactETHForTokens(
              await router.getAddress(),
              0,
              [await WETH.getAddress(), await WETHPartner.getAddress()],
              wallet.address,
              MaxUint256,
              { value: swapAmount }
            )
          )
            .to.emit(routerEventEmitter, "Amounts")
            .withArgs([swapAmount, expectedOutputAmount]);
        });
      });

      describe("swapTokensForExactETH", () => {
        const WETHPartnerAmount = expandTo18Decimals(5);
        const ETHAmount = expandTo18Decimals(10);
        const expectedSwapAmount = 557227237267357629n;
        const outputAmount = expandTo18Decimals(1);

        beforeEach(async () => {
          await WETHPartner.transfer(
            await WETHPair.getAddress(),
            WETHPartnerAmount
          );
          await WETH.deposit({ value: ETHAmount });
          await WETH.transfer(await WETHPair.getAddress(), ETHAmount);
          await WETHPair.mint(wallet.address);
        });

        it("happy path", async () => {
          await WETHPartner.approve(await router.getAddress(), MaxUint256);
          const WETHPairToken0 = await WETHPair.token0();
          await expect(
            router.swapTokensForExactETH(
              outputAmount,
              MaxUint256,
              [await WETHPartner.getAddress(), await WETH.getAddress()],
              wallet.address,
              MaxUint256
            )
          )
            .to.emit(WETHPartner, "Transfer")
            .withArgs(
              wallet.address,
              await WETHPair.getAddress(),
              expectedSwapAmount
            )
            .to.emit(WETH, "Transfer")
            .withArgs(
              await WETHPair.getAddress(),
              await router.getAddress(),
              outputAmount
            );
        });

        it("amounts", async () => {
          await WETHPartner.approve(
            await routerEventEmitter.getAddress(),
            MaxUint256
          );
          await expect(
            routerEventEmitter.swapTokensForExactETH(
              await router.getAddress(),
              outputAmount,
              MaxUint256,
              [await WETHPartner.getAddress(), await WETH.getAddress()],
              wallet.address,
              MaxUint256
            )
          )
            .to.emit(routerEventEmitter, "Amounts")
            .withArgs([expectedSwapAmount, outputAmount]);
        });
      });

      describe("swapExactTokensForETH", () => {
        const WETHPartnerAmount = expandTo18Decimals(5);
        const ETHAmount = expandTo18Decimals(10);
        const swapAmount = expandTo18Decimals(1);
        const expectedOutputAmount = 1662497915624478906n;

        beforeEach(async () => {
          await WETHPartner.transfer(
            await WETHPair.getAddress(),
            WETHPartnerAmount
          );
          await WETH.deposit({ value: ETHAmount });
          await WETH.transfer(await WETHPair.getAddress(), ETHAmount);
          await WETHPair.mint(wallet.address);
        });

        it("happy path", async () => {
          await WETHPartner.approve(await router.getAddress(), MaxUint256);
          const WETHPairToken0 = await WETHPair.token0();
          await expect(
            router.swapExactTokensForETH(
              swapAmount,
              0,
              [await WETHPartner.getAddress(), await WETH.getAddress()],
              wallet.address,
              MaxUint256
            )
          )
            .to.emit(WETHPartner, "Transfer")
            .withArgs(
              wallet.address,
              await WETHPair.getAddress(),
              swapAmount
            )
            .to.emit(WETH, "Transfer")
            .withArgs(
              await WETHPair.getAddress(),
              await router.getAddress(),
              expectedOutputAmount
            );
        });

        it("amounts", async () => {
          await WETHPartner.approve(
            await routerEventEmitter.getAddress(),
            MaxUint256
          );
          await expect(
            routerEventEmitter.swapExactTokensForETH(
              await router.getAddress(),
              swapAmount,
              0,
              [await WETHPartner.getAddress(), await WETH.getAddress()],
              wallet.address,
              MaxUint256
            )
          )
            .to.emit(routerEventEmitter, "Amounts")
            .withArgs([swapAmount, expectedOutputAmount]);
        });
      });

      describe("swapETHForExactTokens", () => {
        const WETHPartnerAmount = expandTo18Decimals(10);
        const ETHAmount = expandTo18Decimals(5);
        const expectedSwapAmount = 557227237267357629n;
        const outputAmount = expandTo18Decimals(1);

        beforeEach(async () => {
          await WETHPartner.transfer(
            await WETHPair.getAddress(),
            WETHPartnerAmount
          );
          await WETH.deposit({ value: ETHAmount });
          await WETH.transfer(await WETHPair.getAddress(), ETHAmount);
          await WETHPair.mint(wallet.address);
        });

        it("happy path", async () => {
          const WETHPairToken0 = await WETHPair.token0();
          await expect(
            router.swapETHForExactTokens(
              outputAmount,
              [await WETH.getAddress(), await WETHPartner.getAddress()],
              wallet.address,
              MaxUint256,
              { value: expectedSwapAmount }
            )
          )
            .to.emit(WETH, "Transfer")
            .withArgs(
              await router.getAddress(),
              await WETHPair.getAddress(),
              expectedSwapAmount
            )
            .to.emit(WETHPartner, "Transfer")
            .withArgs(
              await WETHPair.getAddress(),
              wallet.address,
              outputAmount
            );
        });

        it("amounts", async () => {
          await expect(
            routerEventEmitter.swapETHForExactTokens(
              await router.getAddress(),
              outputAmount,
              [await WETH.getAddress(), await WETHPartner.getAddress()],
              wallet.address,
              MaxUint256,
              { value: expectedSwapAmount }
            )
          )
            .to.emit(routerEventEmitter, "Amounts")
            .withArgs([expectedSwapAmount, outputAmount]);
        });
      });
    });
  }
});
