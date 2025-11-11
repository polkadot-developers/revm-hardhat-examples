# ERC-20 Token Hardhat Example

A complete ERC-20 token implementation using Hardhat v2, featuring modern development tools and best practices for deploying to the Polkadot testnet.

## Overview

This project demonstrates how to create, deploy, and test an ERC-20 token contract using Hardhat. The token implementation includes standard ERC-20 functionality plus minting capabilities and owner controls.

## Token Features

The `MyToken` contract implements:

- **ERC-20 Standard**: Full compliance with the ERC-20 token standard
- **Minting**: Owner can mint new tokens to any address
- **ERC-20 Permit**: Gasless approvals using cryptographic signatures
- **Ownable**: Access control with owner-only functions
- **OpenZeppelin**: Built using audited, battle-tested contracts

### Token Details

- **Name**: MyToken
- **Symbol**: MTK
- **Decimals**: 18 (standard)
- **Total Supply**: Controlled by owner (no initial supply, mint as needed)

## Project Structure

```
erc20-hardhat/
├── contracts/
│   └── MyToken.sol          # Main ERC-20 token contract
├── test/
│   └── MyToken.test.ts      # Mocha/Chai tests
├── ignition/
│   └── modules/
│       └── MyToken.ts       # Deployment configuration
├── artifacts/               # Compiled contracts (auto-generated)
├── cache/                   # Hardhat cache (auto-generated)
├── typechain-types/         # TypeScript types (auto-generated)
├── hardhat.config.ts        # Hardhat configuration
├── package.json             # Project dependencies
├── tsconfig.json            # TypeScript configuration
└── README.md               # This file
```

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Compile Contracts

```bash
npx hardhat compile
```

### 3. Run Tests

Run tests against the Polkadot testnet:

```bash
npm run test:polkadot
```

Or run tests on the default Hardhat network:

```bash
npm test
```

### 4. Deploy Locally

Deploy to Hardhat's built-in network:

```bash
npx hardhat ignition deploy ignition/modules/MyToken.ts
```

## Deployment

### Local Development

The project is configured to work with Hardhat's built-in network by default. Simply run:

```bash
npx hardhat ignition deploy ignition/modules/MyToken.ts
```

This will:
1. Deploy the MyToken contract
2. Set the first account as the owner
3. Mint 5 MTK tokens to the owner address

### Polkadot Testnet

To deploy to the Polkadot testnet, you need an account with funds to send the transaction. The Hardhat configuration uses Configuration Variables for secure private key management.

#### Setup Configuration Variables

1. **Set your private key**:
   ```bash
   npx hardhat vars set TESTNET_PRIVATE_KEY
   ```
   
   You'll be prompted to enter your private key securely. The value is encrypted and stored locally.

2. **(Optional) Set a custom network URL**:
   ```bash
   npx hardhat vars set TESTNET_URL
   ```
   
   If not set, defaults to `http://127.0.0.1:8545`

3. **Verify your configuration**:
   ```bash
   npx hardhat vars list
   ```

#### Deploy to Testnet

```bash
npx hardhat ignition deploy ignition/modules/MyToken.ts --network polkadotTestnet
```

**Note**: If you get an error about pending transactions, wait a minute for previous transactions to be confirmed (they need 5 confirmations), then try again.

## Configuration

### Configuration Variables

Hardhat Configuration Variables provide secure, encrypted storage for sensitive data:

- `TESTNET_PRIVATE_KEY`: Your private key for deployment (required)
- `TESTNET_URL`: Custom RPC endpoint (optional, defaults to `http://127.0.0.1:8545`)

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
- **polkadotTestnet**: Local Polkadot testnet node at `http://127.0.0.1:8545`

## Contract Interaction Examples

### Using Hardhat Console

```bash
npx hardhat console --network localhost
```

```javascript
// Get the deployed contract
const MyToken = await ethers.getContractFactory("MyToken");
const token = await MyToken.attach("DEPLOYED_CONTRACT_ADDRESS");

// Check token details
await token.name();        // "MyToken"
await token.symbol();      // "MTK"
await token.decimals();    // 18

// Mint tokens (only owner)
await token.mint("0x...", ethers.parseEther("100"));

// Check balance
await token.balanceOf("0x...");
```

## Development Features

This project uses modern Ethereum development practices:

- **Hardhat v2**: Stable, production-ready development environment
- **TypeScript**: Full type safety throughout the project
- **Ethers v6**: Modern Ethereum library for contract interactions
- **Mocha + Chai**: Robust testing framework
- **TypeChain**: Auto-generated TypeScript types for contracts
- **OpenZeppelin**: Industry-standard smart contract libraries
- **Hardhat Ignition**: Declarative deployment system
- **Configuration Variables**: Secure, encrypted key management

## Testing

The project includes comprehensive TypeScript tests using Mocha and Chai:

- **Test File**: `test/MyToken.test.ts`
- **Framework**: Mocha with Chai assertions
- **Features Tested**:
  - Contract deployment
  - Token name, symbol, and decimals
  - Owner assignment
  - Minting functionality
  - Balance tracking
  - Total supply updates

Run tests:

```bash
# Against Polkadot testnet
npm run test:polkadot

# On Hardhat network
npm test
```

## Security Considerations

- The contract uses OpenZeppelin's audited implementations
- Owner privileges are clearly defined and limited to minting
- ERC-20 Permit reduces gas costs and improves UX for approvals
- All standard ERC-20 security patterns are implemented

## Learn More

- [Hardhat Documentation](https://hardhat.org/hardhat-runner/docs/getting-started)
- [Hardhat Configuration Variables](https://hardhat.org/hardhat-runner/docs/guides/configuration-variables)
- [OpenZeppelin ERC-20 Documentation](https://docs.openzeppelin.com/contracts/5.x/erc20)
- [ERC-20 Permit Explanation](https://eips.ethereum.org/EIPS/eip-2612)
- [Ethers.js Documentation](https://docs.ethers.org/v6/)

## Contributing

Contributions are welcome! Please ensure:

1. All tests pass
2. Code follows the existing style
3. New features include appropriate tests
4. Documentation is updated as needed

## License

This project is licensed under the MIT License.
