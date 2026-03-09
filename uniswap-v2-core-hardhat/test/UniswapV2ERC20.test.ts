import { expect } from "chai";
import { ethers } from "hardhat";
import { keccak256, AbiCoder, toUtf8Bytes, MaxUint256, Wallet, Signature } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ERC20 } from "../typechain-types/test/ERC20";
import { expandTo18Decimals } from "./shared/utilities";

const TOTAL_SUPPLY = expandTo18Decimals(10000);
const TEST_AMOUNT = expandTo18Decimals(10);

describe("UniswapV2ERC20", function () {
  let token: ERC20;
  let wallet: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  beforeEach(async function () {
    const ERC20 = await ethers.getContractFactory("ERC20");
    token = await ERC20.deploy(TOTAL_SUPPLY);
    await token.waitForDeployment();
    [wallet, other] = await ethers.getSigners();
  });

  it("name, symbol, decimals, totalSupply, balanceOf, DOMAIN_SEPARATOR, PERMIT_TYPEHASH", async () => {
    const [deployer] = await ethers.getSigners();
    const abiCoder = new AbiCoder();
    const name = await token.name();
    expect(name).to.equal("Uniswap V2");
    expect(await token.symbol()).to.equal("UNI-V2");
    expect(await token.decimals()).to.equal(18);
    expect(await token.totalSupply()).to.equal(TOTAL_SUPPLY);
    expect(await token.balanceOf(deployer.address)).to.equal(TOTAL_SUPPLY);

    const tokenAddress = await token.getAddress();
    const chainId = (await ethers.provider.getNetwork()).chainId;
    expect(await token.DOMAIN_SEPARATOR()).to.equal(
      keccak256(
        abiCoder.encode(
          ["bytes32", "bytes32", "bytes32", "uint256", "address"],
          [
            keccak256(
              toUtf8Bytes(
                "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
              )
            ),
            keccak256(toUtf8Bytes(name)),
            keccak256(toUtf8Bytes("1")),
            chainId,
            tokenAddress,
          ]
        )
      )
    );
    expect(await token.PERMIT_TYPEHASH()).to.equal(
      keccak256(
        toUtf8Bytes(
          "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
        )
      )
    );
  });

  it("approve", async () => {
    const walletAddress = await wallet.getAddress();
    await expect(token.approve(other.address, TEST_AMOUNT))
      .to.emit(token, "Approval")
      .withArgs(walletAddress, other.getAddress(), TEST_AMOUNT);
    expect(await token.allowance(walletAddress, other.address)).to.equal(
      TEST_AMOUNT
    );
  });

  it("transfer", async () => {
    await expect(token.transfer(other.address, TEST_AMOUNT))
      .to.emit(token, "Transfer")
      .withArgs(wallet.address, other.address, TEST_AMOUNT);
    expect(await token.balanceOf(wallet.address)).to.equal(
      TOTAL_SUPPLY - TEST_AMOUNT
    );
    expect(await token.balanceOf(other.address)).to.equal(TEST_AMOUNT);
  });

  it("transfer:fail", async () => {
    await expect(token.transfer(other.address, TOTAL_SUPPLY + 1n)).to.be
      .reverted;
    await expect(token.connect(other).transfer(wallet.address, 1)).to.be
      .reverted;
  });

  it("transferFrom", async () => {
    await token.approve(other.address, TEST_AMOUNT);
    expect(await token.allowance(wallet.address, other.address)).to.equal(
      TEST_AMOUNT
    );
    await expect(
      token
        .connect(other)
        .transferFrom(wallet.address, other.address, TEST_AMOUNT)
    )
      .to.emit(token, "Transfer")
      .withArgs(wallet.address, other.address, TEST_AMOUNT);
    expect(await token.allowance(wallet.address, other.address)).to.equal(0);
    expect(await token.balanceOf(wallet.address)).to.equal(
      TOTAL_SUPPLY - TEST_AMOUNT
    );
    expect(await token.balanceOf(other.address)).to.equal(TEST_AMOUNT);
  });

  it("transferFrom:max", async () => {
    await token.approve(other.address, ethers.MaxUint256);
    await expect(
      token
        .connect(other)
        .transferFrom(wallet.address, other.address, TEST_AMOUNT)
    )
      .to.emit(token, "Transfer")
      .withArgs(wallet.address, other.address, TEST_AMOUNT);
    expect(await token.allowance(wallet.address, other.address)).to.equal(
      MaxUint256
    );
    expect(await token.balanceOf(wallet.address)).to.equal(
      TOTAL_SUPPLY - TEST_AMOUNT
    );
    expect(await token.balanceOf(other.address)).to.equal(TEST_AMOUNT);
  });

  it("permit", async () => {
    // Local wallet with known private key — signTypedData runs locally, no RPC needed
    const permitSigner = Wallet.createRandom().connect(ethers.provider);

    const nonce = await token.nonces(permitSigner.address);
    const deadline = MaxUint256;
    const tokenAddress = await token.getAddress();
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const name = await token.name();

    const domain = {
      name,
      version: "1",
      chainId,
      verifyingContract: tokenAddress,
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
      spender: other.address,
      value: TEST_AMOUNT,
      nonce,
      deadline,
    };

    const sig = await permitSigner.signTypedData(domain, types, message);
    const { v, r, s } = Signature.from(sig);

    // Anyone can submit the permit on-chain (wallet pays gas, permitSigner doesn't need ETH)
    await expect(
      token.permit(permitSigner.address, other.address, TEST_AMOUNT, deadline, v, r, s)
    )
      .to.emit(token, "Approval")
      .withArgs(permitSigner.address, other.address, TEST_AMOUNT);
    expect(await token.allowance(permitSigner.address, other.address)).to.equal(
      TEST_AMOUNT
    );
    expect(await token.nonces(permitSigner.address)).to.equal(1);
  });
});
