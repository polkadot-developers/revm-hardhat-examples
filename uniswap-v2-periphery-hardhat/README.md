# Uniswap V2 Periphery Hardhat Example

A complete Uniswap V2 periphery protocol implementation using Hardhat v2, demonstrating how to deploy and test the Uniswap V2 router contracts on the Polkadot testnet.

## Overview

This project demonstrates how to deploy and test the Uniswap V2 periphery contracts using Hardhat. The implementation includes the router contracts that provide the user-facing interface for swapping tokens and managing liquidity, built on top of the [Uniswap V2 Core](../uniswap-v2-core-hardhat/) contracts.

## Contracts

The project includes the following periphery contracts:

- **UniswapV2Router01**: First iteration of the router with basic swap and liquidity functions
- **UniswapV2Router02**: Enhanced router with support for fee-on-transfer tokens

### Supporting Contracts

- **Interfaces**: `IUniswapV2Router01`, `IUniswapV2Router02`, `IERC20`, `IWETH`
- **Libraries**: `UniswapV2Library`, `SafeMath`
- **Test Helpers**: `WETH9`, `ERC20` (test token), `DeflatingERC20` (fee-on-transfer token), `RouterEventEmitter`, `CompileHelper`

## Prerequisites

- [Node.js](https://nodejs.org/) v22 or later
- The [Uniswap V2 Core](../uniswap-v2-core-hardhat/) project must be present at `../uniswap-v2-core-hardhat/` (referenced as a local dependency)
- A Polkadot testnet account with funds (for testnet deployment). You can get testnet tokens from the [Polkadot Faucet](https://faucet.polkadot.io/)

### Versions

| Component | Version |
|-----------|---------|
| Hardhat | 2.22.x |
| Solidity | 0.5.16 / 0.6.6 |
| Node.js | >= 22 |

## Project Structure

```
uniswap-v2-periphery-hardhat/
├── contracts/
│   ├── UniswapV2Router01.sol           # Router v1
│   ├── UniswapV2Router02.sol           # Router v2 (fee-on-transfer support)
│   ├── interfaces/                     # Contract interfaces
│   │   ├── IERC20.sol
│   │   ├── IUniswapV2Router01.sol
│   │   ├── IUniswapV2Router02.sol
│   │   └── IWETH.sol
│   ├── libraries/                      # Utility libraries
│   │   ├── SafeMath.sol
│   │   └── UniswapV2Library.sol
│   └── test/                           # Test helper contracts
│       ├── CompileHelper.sol
│       ├── DeflatingERC20.sol
│       ├── ERC20.sol
│       ├── RouterEventEmitter.sol
│       └── WETH9.sol
├── ignition/
│   └── modules/
│       └── UniswapV2Router02.ts        # Ignition deployment module
├── test/
│   ├── UniswapV2Router01.test.ts       # Router01 tests (38 tests)
│   ├── UniswapV2Router02.test.ts       # Router02 tests (12 tests)
│   └── shared/
│       ├── fixtures.ts                 # Test fixtures
│       └── utilities.ts                # Test helpers
├── scripts/
│   └── deploy.ts                       # Deployment script
├── hardhat.config.ts                   # Hardhat configuration
├── package.json                        # Project dependencies
├── tsconfig.json                       # TypeScript configuration
└── README.md                           # This file
```

## Quick Start

### 1. Install Dependencies

First, ensure the [Uniswap V2 Core](../uniswap-v2-core-hardhat/) project dependencies are installed:

```bash
cd ../uniswap-v2-core-hardhat && npm install && cd ../uniswap-v2-periphery-hardhat
```

Then install this project's dependencies:

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

Deploy using the script (deploys WETH, factory, router, two test tokens, and creates a pair):

```bash
npm run deploy
```

Or deploy only WETH, factory, and router using Hardhat Ignition:

```bash
npx hardhat ignition deploy ignition/modules/UniswapV2Router02.ts
```

## Deployment

### Local Development

```bash
npm run deploy
```

This will:
1. Deploy the WETH9 contract
2. Deploy the UniswapV2Factory contract
3. Deploy the UniswapV2Router02 contract
4. Deploy two test ERC-20 tokens
5. Create a trading pair for the two tokens

### Polkadot Testnet

To deploy to the Polkadot testnet, you need an account with funds to send the transaction. The Hardhat configuration uses Configuration Variables for secure private key management.

#### Setup Configuration Variables

1. **Set your private key**:
   ```bash
   npx hardhat vars set TESTNET_PRIVATE_KEY
   ```

   You'll be prompted to enter your private key securely. The value is encrypted and stored locally.

2. **Verify your configuration**:
   ```bash
   npx hardhat vars list
   ```

3. **Deploy**:
   ```bash
   npm run deploy:polkadot
   ```

   Or deploy only WETH, factory, and router via Ignition:
   ```bash
   npx hardhat ignition deploy ignition/modules/UniswapV2Router02.ts --network polkadotTestnet
   ```

## Configuration

### Configuration Variables

Hardhat Configuration Variables provide secure, encrypted storage for sensitive data:

- `TESTNET_PRIVATE_KEY`: Your private key for deployment (required for testnet)

**Useful Commands**:
```bash
# Set a variable (will prompt for value)
npx hardhat vars set TESTNET_PRIVATE_KEY

# List all variables
npx hardhat vars list

# View a variable
npx hardhat vars get TESTNET_PRIVATE_KEY

# Delete a variable
npx hardhat vars delete TESTNET_PRIVATE_KEY

# See storage location
npx hardhat vars path
```

### Network Configuration

The project includes the following networks:

- **hardhat**: Built-in Hardhat network (default, with `allowUnlimitedContractSize` enabled)
- **localNode**: Local pallet-revive dev node at `http://127.0.0.1:8545`
- **polkadotTestnet**: Polkadot testnet at `https://services.polkadothub-rpc.com/testnet`

## Testing

The project includes 50 comprehensive tests covering:

- **UniswapV2Router01** (38 tests): addLiquidity, addLiquidityETH, removeLiquidity, removeLiquidityETH, removeLiquidityWithPermit, removeLiquidityETHWithPermit, swapExactTokensForTokens, swapTokensForExactTokens, swapExactETHForTokens, swapTokensForExactETH, swapExactTokensForETH, swapETHForExactTokens
- **UniswapV2Router02** (12 tests): quote, getAmountOut, getAmountIn, getAmountsOut, getAmountsIn, fee-on-transfer token support (removeLiquidity, swaps with DTT, WETH, ETH)

Run tests:

```bash
# On Hardhat network
npm test

# Against Polkadot testnet
npm run test:polkadot
```

## Development Features

This project uses modern Ethereum development practices:

- **Hardhat v2**: Stable, production-ready development environment
- **TypeScript**: Full type safety throughout the project
- **Ethers v6**: Modern Ethereum library for contract interactions
- **Mocha + Chai**: Robust testing framework
- **TypeChain**: Auto-generated TypeScript types for contracts
- **Hardhat Ignition**: Declarative deployment system
- **Multi-Compiler**: Solidity 0.5.16 (v2-core) and 0.6.6 (periphery) support
- **Configuration Variables**: Secure, encrypted key management

## Security Considerations

- The contracts are based on the original Uniswap V2 periphery implementation
- UniswapV2Router02 supports fee-on-transfer tokens via dedicated swap functions
- All permit-based operations use EIP-712 typed data signatures
- WETH wrapping/unwrapping is handled transparently by the router

## Learn More

- [Uniswap V2 Core Whitepaper](https://uniswap.org/whitepaper.pdf)
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

This project is licensed under the MIT License.
