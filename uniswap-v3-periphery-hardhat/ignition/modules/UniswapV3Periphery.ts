import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// address(0) — NonfungibleTokenPositionDescriptor is optional:
// tokenURI() reverts without it but all LP operations work normally.
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const UniswapV3PeripheryModule = buildModule(
  "UniswapV3PeripheryModule",
  (m) => {
    // Core prerequisite — factory must be deployed first
    const factory = m.contract("UniswapV3Factory");

    // WETH9 — required by SwapRouter and NonfungiblePositionManager
    const weth9 = m.contract("WETH9");

    // Periphery contracts that depend on factory + WETH9
    const router = m.contract("SwapRouter", [factory, weth9]);

    const nfpm = m.contract("NonfungiblePositionManager", [
      factory,
      weth9,
      ZERO_ADDRESS,
    ]);

    return { factory, weth9, router, nfpm };
  }
);

export default UniswapV3PeripheryModule;
