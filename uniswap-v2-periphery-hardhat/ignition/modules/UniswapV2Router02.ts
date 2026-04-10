import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const UniswapV2Router02Module = buildModule("UniswapV2Router02Module", (m) => {
  const deployer = m.getAccount(0);

  const weth = m.contract("WETH9");
  const factory = m.contract("UniswapV2Factory", [deployer]);
  const router = m.contract("UniswapV2Router02", [factory, weth]);

  return { weth, factory, router };
});

export default UniswapV2Router02Module;
