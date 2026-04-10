# Uniswap V3 Core Hardhat Example

A Uniswap V3 core protocol implementation using Hardhat, demonstrating how to deploy and test a concentrated-liquidity DEX on the Polkadot testnet.

## Overview

This project demonstrates how to deploy and test the Uniswap V3 core contracts using Hardhat. The implementation includes the factory, pool deployer, and pool contracts that form the foundation of the Uniswap V3 protocol, which introduces concentrated liquidity for more capital-efficient trading.

## Contracts

The project includes the following core contracts:

- **UniswapV3Factory**: Creates and manages V3 pools; controls protocol fees
- **UniswapV3Pool**: Concentrated-liquidity AMM; handles mint, burn, swap, and flash operations
- **UniswapV3PoolDeployer**: Internal helper used by the factory to deploy pools with `CREATE2`
- **NoDelegateCall**: Base contract that prevents delegate calls to protected functions

### Libraries

- **TickMath**: Price ↔ tick conversions using `sqrt(1.0001)^tick`
- **SqrtPriceMath**: Token amount calculations from `sqrtPriceX96` values
- **SwapMath**: Per-step swap computation across a single tick range
- **LiquidityMath**: Liquidity delta arithmetic
- **FullMath**: 512-bit multiplication with 256-bit result (`mulDiv`)
- **BitMath**: Bit manipulation for tick bitmap operations
- **TickBitmap**: Packed tick-initialized map for O(1) next-initialized-tick lookup
- **Tick**: Per-tick state and fee accumulator management
- **Oracle**: Time-weighted average price (TWAP) observations
- **Position**: Per-position liquidity and fee tracking
- **Others**: `FixedPoint96`, `FixedPoint128`, `LowGasSafeMath`, `SafeCast`, `TransferHelper`, `UnsafeMath`

### Interfaces

- `IUniswapV3Factory`, `IUniswapV3Pool`, `IUniswapV3PoolDeployer`
- Pool state partitioned into: `IUniswapV3PoolImmutables`, `IUniswapV3PoolState`, `IUniswapV3PoolDerivedState`, `IUniswapV3PoolActions`, `IUniswapV3PoolOwnerActions`, `IUniswapV3PoolEvents`
- Callbacks: `IUniswapV3MintCallback`, `IUniswapV3SwapCallback`, `IUniswapV3FlashCallback`

## Prerequisites

- [Node.js](https://nodejs.org/) v22 or later
- A Polkadot testnet account with funds (for testnet deployment). You can get testnet tokens from the [Polkadot Faucet](https://faucet.polkadot.io/)

### Versions

| Component | Version |
|-----------|---------|
| Hardhat | 2.22.x |
| Solidity | 0.7.6 |
| Node.js | >= 22 |

## Project Structure

```
uniswap-v3-core-hardhat/
├── contracts/
│   ├── UniswapV3Factory.sol          # Pool factory
│   ├── UniswapV3Pool.sol             # Concentrated-liquidity AMM pool
│   ├── UniswapV3PoolDeployer.sol     # Internal pool deployer (CREATE2)
│   ├── NoDelegateCall.sol            # Delegate-call guard
│   ├── interfaces/                   # Contract interfaces
│   │   ├── pool/                     # Pool interface partitions
│   │   └── callback/                 # Callback interfaces
│   ├── libraries/                    # Math and utility libraries
│   └── test/                         # Test helper contracts
├── test/
│   ├── UniswapV3Factory.test.ts      # Factory tests (18 tests)
│   ├── UniswapV3Pool.test.ts         # Pool tests: mint, burn, swap, flash, fees (~170 tests)
│   └── shared/
│       ├── fixtures.ts               # Test fixtures and pool setup helpers
│       ├── utilities.ts              # Test utilities
│       ├── format.ts                 # Formatting helpers
│       └── checkObservationEquals.ts # Oracle observation assertion helper
├── scripts/
│   └── deploy.ts                     # Deployment script
├── ignition/
│   └── modules/
│       └── UniswapV3Core.ts          # Ignition deployment module
├── artifacts/                        # Compiled contracts (auto-generated)
├── cache/                            # Hardhat cache (auto-generated)
├── typechain-types/                  # TypeScript types (auto-generated)
├── hardhat.config.ts                 # Hardhat configuration
├── package.json                      # Project dependencies
├── tsconfig.json                     # TypeScript configuration
└── README.md                         # This file
```

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Compile Contracts

```bash
npm run compile
```

### 3. Run Tests

Run tests on the default Hardhat network:

```bash
npm test
```

Or run tests against the Polkadot testnet:

```bash
npm run test:polkadot
```

### 4. Deploy

Deploy the factory using the deployment script:

```bash
npm run deploy
```

Or deploy using Hardhat Ignition:

```bash
npx hardhat ignition deploy ignition/modules/UniswapV3Core.ts
```

## Deployment

### Local Development

```bash
npm run deploy
```

### Polkadot Testnet

To deploy to the Polkadot testnet, you need an account with funds. The configuration uses Hardhat Configuration Variables for secure private key management.

#### Setup Configuration Variables

1. **Set your private key**:
   ```bash
   npx hardhat vars set TESTNET_PRIVATE_KEY
   ```

2. **Verify your configuration**:
   ```bash
   npx hardhat vars list
   ```

3. **Deploy**:
   ```bash
   npm run deploy:polkadot
   ```

   Or via Ignition:
   ```bash
   npx hardhat ignition deploy ignition/modules/UniswapV3Core.ts --network polkadotTestnet
   ```

## Configuration

### Configuration Variables

- `TESTNET_PRIVATE_KEY`: Your private key for deployment (required for testnet)

**Useful Commands**:
```bash
npx hardhat vars set TESTNET_PRIVATE_KEY
npx hardhat vars list
npx hardhat vars get TESTNET_PRIVATE_KEY
npx hardhat vars delete TESTNET_PRIVATE_KEY
npx hardhat vars path
```

### Network Configuration

The project includes the following networks:

- **hardhat**: Built-in Hardhat network (default, `allowUnlimitedContractSize: true`)
- **localNode**: Local pallet-revive dev node at `http://127.0.0.1:8545`
- **polkadotTestnet**: Polkadot testnet at `https://services.polkadothub-rpc.com/testnet`

> **Note**: `localNode` sets an explicit `gasPrice` of 50 gwei to match the Polkadot local node's minimum. Without this, Hardhat's automatic EIP-1559 fee estimation produces a near-zero `maxPriorityFeePerGas` on a fresh node with no fee history, causing transactions to stall in the mempool.

### Compiler Settings

Solidity 0.7.6 is compiled with the optimizer enabled (`runs: 800`) and `bytecodeHash: "none"`. The metadata hash is excluded to keep contract bytecode deterministic and within the EIP-170 24,576-byte limit — this matches the original Uniswap V3 Core deployment configuration.

## Testing

The test suite covers 187 tests in two files:

- **UniswapV3Factory** (18 tests): pool creation, fee tiers, ownership, `feeAmountTickSpacing`
- **UniswapV3Pool** (~170 tests): initialization, mint, burn, swap (exact input/output, with/without fee), flash loans, fee protocol collection, reentrancy guards, observe (TWAP)

Run tests:

```bash
# On Hardhat network
npm test

# Against Polkadot testnet
npm run test:polkadot
```

## Development Features

- **Hardhat v2**: Stable, production-ready development environment
- **TypeScript**: Full type safety throughout the project
- **Ethers v6**: Modern Ethereum library for contract interactions
- **Mocha + Chai**: Robust testing framework
- **TypeChain**: Auto-generated TypeScript types for contracts
- **Hardhat Ignition**: Declarative deployment system
- **Configuration Variables**: Secure, encrypted key management

## Security Considerations

- The contracts are based on the original Uniswap V3 Core implementation
- Concentrated liquidity positions are tracked per tick range — price outside a position's range means zero active liquidity
- `NoDelegateCall` prevents delegate calls to the factory and pool to avoid storage collision attacks
- Flash loans require the borrowed amounts to be repaid within the same transaction with fees

## Learn More

- [Uniswap V3 Core Whitepaper](https://uniswap.org/whitepaper-v3.pdf)
- [Hardhat Documentation](https://hardhat.org/hardhat-runner/docs/getting-started)
- [Hardhat Configuration Variables](https://hardhat.org/hardhat-runner/docs/guides/configuration-variables)
- [Hardhat Ignition](https://hardhat.org/ignition)
- [Ethers.js Documentation](https://docs.ethers.org/v6/)
- [Polkadot Smart Contracts Documentation](https://docs.polkadot.com/smart-contracts/)

## Contributing

Contributions are welcome! Please ensure:

1. All tests pass
2. Code follows the existing style
3. New features include appropriate tests
4. Documentation is updated as needed

## License

The contracts in `contracts/libraries/` carry a mix of GPL-2.0 and MIT licenses (see `contracts/libraries/LICENSE` and `contracts/libraries/LICENSE_MIT`). All other files in this project are MIT licensed.
