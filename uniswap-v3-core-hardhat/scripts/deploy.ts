import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Deploy UniswapV3Factory
  const factory = await ethers.deployContract("UniswapV3Factory");
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("UniswapV3Factory deployed to:", factoryAddress);

  // Deploy two test ERC20 tokens (2^255 supply each)
  const supply = 2n ** 255n;
  const tokenA = await ethers.deployContract("TestERC20", [supply]);
  await tokenA.waitForDeployment();
  const tokenAAddress = await tokenA.getAddress();
  console.log("TokenA deployed to:", tokenAAddress);

  const tokenB = await ethers.deployContract("TestERC20", [supply]);
  await tokenB.waitForDeployment();
  const tokenBAddress = await tokenB.getAddress();
  console.log("TokenB deployed to:", tokenBAddress);

  // Sort tokens (Uniswap V3 requires token0 < token1)
  const [token0Address, token1Address] =
    tokenAAddress.toLowerCase() < tokenBAddress.toLowerCase()
      ? [tokenAAddress, tokenBAddress]
      : [tokenBAddress, tokenAAddress];

  // Create a 0.3% fee pool
  const FEE_MEDIUM = 3000;
  const tx = await factory.createPool(token0Address, token1Address, FEE_MEDIUM);
  await tx.wait();
  const poolAddress = await factory.getPool(token0Address, token1Address, FEE_MEDIUM);
  console.log("UniswapV3Pool (0.3% fee) created at:", poolAddress);

  console.log("\nDeployment summary:");
  console.log("  Factory:   ", factoryAddress);
  console.log("  Token0:    ", token0Address);
  console.log("  Token1:    ", token1Address);
  console.log("  Pool (0.3%):", poolAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
