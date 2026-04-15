import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const UniswapV3FactoryModule = buildModule("UniswapV3FactoryModule", (m) => {
  const factory = m.contract("UniswapV3Factory");

  return { factory };
});

export default UniswapV3FactoryModule;
