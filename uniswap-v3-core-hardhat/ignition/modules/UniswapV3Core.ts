import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const UniswapV3CoreModule = buildModule("UniswapV3Core", (m) => {
  const factory = m.contract("UniswapV3Factory");

  return { factory };
});

export default UniswapV3CoreModule;
