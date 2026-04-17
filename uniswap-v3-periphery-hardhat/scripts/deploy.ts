import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // 1. Deploy UniswapV3Factory
  const factory = await ethers.deployContract("UniswapV3Factory");
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("UniswapV3Factory deployed to:", factoryAddress);

  // 2. Deploy WETH9
  const weth9 = await ethers.deployContract("WETH9");
  await weth9.waitForDeployment();
  const weth9Address = await weth9.getAddress();
  console.log("WETH9 deployed to:", weth9Address);

  // 3. Deploy SwapRouter
  const router = await ethers.deployContract("SwapRouter", [factoryAddress, weth9Address]);
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log("SwapRouter deployed to:", routerAddress);

  // 4. Deploy NonfungiblePositionManager (no tokenDescriptor for testnet)
  const nfpm = await ethers.deployContract("NonfungiblePositionManager", [
    factoryAddress,
    weth9Address,
    ethers.ZeroAddress, // tokenDescriptor: optional for basic LP functionality
  ]);
  await nfpm.waitForDeployment();
  const nfpmAddress = await nfpm.getAddress();
  console.log("NonfungiblePositionManager deployed to:", nfpmAddress);

  console.log("\nDeployment summary:");
  console.log("  UniswapV3Factory:             ", factoryAddress);
  console.log("  WETH9:                        ", weth9Address);
  console.log("  SwapRouter:                   ", routerAddress);
  console.log("  NonfungiblePositionManager:   ", nfpmAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
