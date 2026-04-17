// SPDX-License-Identifier: UNLICENSED
// solhint-disable-next-line compiler-version
pragma solidity =0.7.6;

// Import V3 core concrete contracts so Hardhat produces their artifacts.
// Tests need to deploy UniswapV3Factory and attach to UniswapV3Pool.
// The bytecodeHash metadata setting must be "none" to keep deterministic
// pool addresses — this is handled by the hardhat.config.ts optimizer settings.
import '@uniswap/v3-core/contracts/UniswapV3Factory.sol';
import '@uniswap/v3-core/contracts/UniswapV3Pool.sol';
