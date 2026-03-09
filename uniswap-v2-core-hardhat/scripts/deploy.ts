import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Deploy UniswapV2Factory
  const UniswapV2Factory = await ethers.getContractFactory("UniswapV2Factory");
  const factory = await UniswapV2Factory.deploy(deployer.address);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("UniswapV2Factory deployed to:", factoryAddress);

  // Deploy two test ERC20 tokens
  const ERC20 = await ethers.getContractFactory("ERC20");
  const totalSupply = ethers.parseEther("10000");

  const tokenA = await ERC20.deploy(totalSupply);
  await tokenA.waitForDeployment();
  const tokenAAddress = await tokenA.getAddress();
  console.log("TokenA deployed to:", tokenAAddress);

  const tokenB = await ERC20.deploy(totalSupply);
  await tokenB.waitForDeployment();
  const tokenBAddress = await tokenB.getAddress();
  console.log("TokenB deployed to:", tokenBAddress);

  // Create a trading pair
  const tx = await factory.createPair(tokenAAddress, tokenBAddress);
  await tx.wait();
  const pairAddress = await factory.getPair(tokenAAddress, tokenBAddress);
  console.log("Pair created at:", pairAddress);

  console.log("\nDeployment summary:");
  console.log("  Factory:", factoryAddress);
  console.log("  TokenA:", tokenAAddress);
  console.log("  TokenB:", tokenBAddress);
  console.log("  Pair:", pairAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
