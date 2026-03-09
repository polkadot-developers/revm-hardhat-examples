# Uniswap V2 Core Hardhat Example

A complete Uniswap V2 core protocol implementation using Hardhat v2, demonstrating how to deploy and test a decentralized exchange (DEX) on the Polkadot testnet.

## Overview

This project demonstrates how to deploy and test the Uniswap V2 core contracts using Hardhat. The implementation includes the factory, pair, and ERC-20 base contracts that form the foundation of the Uniswap V2 protocol.

## Contracts

The project includes the following core contracts:

- **UniswapV2Factory**: Creates and manages trading pairs
- **UniswapV2Pair**: Automated market maker (AMM) for token pairs with constant product formula
- **UniswapV2ERC20**: Base ERC-20 token with EIP-2612 permit support

### Supporting Contracts

- **Interfaces**: `IERC20`, `IUniswapV2Factory`, `IUniswapV2Pair`, `IUniswapV2ERC20`, `IUniswapV2Callee`
- **Libraries**: `Math`, `SafeMath`, `UQ112x112`
- **Test Helpers**: `ERC20` (test token with minting)

## Prerequisites

- [Node.js](https://nodejs.org/) v22 or later
- A Polkadot testnet account with funds (for testnet deployment). You can get testnet tokens from the [Polkadot Faucet](https://faucet.polkadot.io/)

### Versions

| Component | Version |
|-----------|---------|
| Hardhat | 2.22.x |
| Solidity | 0.5.16 |
| Node.js | >= 22 |

## Project Structure

```
uniswap-v2-core-hardhat/
├── contracts/
│   ├── UniswapV2ERC20.sol            # Base ERC-20 with permit
│   ├── UniswapV2Factory.sol          # Pair factory
│   ├── UniswapV2Pair.sol             # AMM pair contract
│   ├── interfaces/                   # Contract interfaces
│   ├── libraries/                    # Math and utility libraries
│   └── test/
│       └── ERC20.sol                 # Test token
├── test/
│   ├── UniswapV2ERC20.test.ts        # ERC-20 tests
│   ├── UniswapV2Factory.test.ts      # Factory tests
│   ├── UniswapV2Pair.test.ts         # Pair tests (mint, burn, swap, fees)
│   └── shared/
│       └── utilities.ts              # Test helpers
├── scripts/
│   └── deploy.ts                     # Deployment script
├── ignition/
│   └── modules/
│       └── UniswapV2Factory.ts       # Ignition deployment module
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

Deploy using the script (deploys factory, two test tokens, and creates a pair):

```bash
npm run deploy
```

Or deploy only the factory using Hardhat Ignition:

```bash
npx hardhat ignition deploy ignition/modules/UniswapV2Factory.ts
```

## Deployment

### Local Development

```bash
npm run deploy
```

This will:
1. Deploy the UniswapV2Factory contract
2. Deploy two test ERC-20 tokens
3. Create a trading pair for the two tokens

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

   Or deploy only the factory via Ignition:
   ```bash
   npx hardhat ignition deploy ignition/modules/UniswapV2Factory.ts --network polkadotTestnet
   ```

**Note**: If you get an error about pending transactions, wait a minute for previous transactions to be confirmed (they need 5 confirmations), then try again.

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

- **hardhat**: Built-in Hardhat network (default)
- **localNode**: Local pallet-revive dev node at `http://127.0.0.1:8545`
- **polkadotTestnet**: Polkadot testnet at `https://services.polkadothub-rpc.com/testnet`

## Testing

The project includes 29 comprehensive tests covering:

- **UniswapV2ERC20** (7 tests): name, symbol, decimals, totalSupply, approve, transfer, transferFrom, permit
- **UniswapV2Factory** (5 tests): feeTo, feeToSetter, createPair, setFeeTo, setFeeToSetter
- **UniswapV2Pair** (17 tests): mint, burn, swap, getInputPrice, optimistic swaps, fee toggle

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
- **Configuration Variables**: Secure, encrypted key management

## Security Considerations

- The contracts are based on the original Uniswap V2 core implementation
- UniswapV2Pair uses a constant product formula (`x * y = k`) for AMM pricing
- Factory access control restricts `feeTo` and `feeToSetter` changes
- ERC-20 Permit (EIP-2612) enables gasless approvals using cryptographic signatures

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
