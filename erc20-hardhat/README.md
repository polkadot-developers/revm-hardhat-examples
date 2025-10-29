# ERC-20 Token Hardhat Example

A complete ERC-20 token implementation using Hardhat 3 Beta, featuring modern development tools including the native Node.js test runner (`node:test`) and the `viem` library for Ethereum interactions.

## Overview

This project demonstrates how to create, deploy, and interact with an ERC-20 token contract using industry best practices. The token implementation includes standard ERC-20 functionality plus additional features like minting and permit functionality.

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
│   ├── MyToken.sol          # Main ERC-20 token contract
│   └── MyToken.t.sol        # Foundry-style Solidity tests
├── ignition/
│   └── modules/
│       └── MyToken.ts       # Deployment configuration
├── artifacts/               # Compiled contracts (auto-generated)
├── cache/                   # Hardhat cache (auto-generated)
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

Run all tests (both Solidity and TypeScript):

```bash
npx hardhat test
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

To deploy to the Polkadot testnet:

1. **Set up environment variables**:
   Create a `.env` file in the project root:
   ```
   PRIVATE_KEY=your_private_key_here
   ```

2. **Deploy to testnet**:
   ```bash
   npx hardhat ignition deploy ignition/modules/MyToken.ts --network polkadotTestnet
   ```

## Configuration

### Environment Variables

- `PRIVATE_KEY`: The private key of the account you want to use for deployment (required for testnet deployment)

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

This project showcases modern Ethereum development practices:

- **Hardhat 3 Beta**: Latest features and improvements
- **TypeScript**: Full type safety throughout the project
- **Viem**: Modern, performant Ethereum library
- **Node.js Test Runner**: Native `node:test` for fast testing
- **Foundry Compatibility**: Solidity tests that work with both Hardhat and Foundry
- **OpenZeppelin**: Industry-standard smart contract libraries
- **Ignition**: Declarative deployment system

## Testing

The project includes comprehensive tests:

- **Solidity Tests**: `contracts/MyToken.t.sol` - Foundry-style tests
- **TypeScript Tests**: Integration tests using `node:test` and `viem`

Run specific test types:

```bash
# All tests
npx hardhat test

# Only Solidity tests
npx hardhat test --grep "\.t\.sol"
```

## Security Considerations

- The contract uses OpenZeppelin's audited implementations
- Owner privileges are clearly defined and limited to minting
- ERC-20 Permit reduces gas costs and improves UX for approvals
- All standard ERC-20 security patterns are implemented

## Learn More

- [Hardhat 3 Beta Documentation](https://hardhat.org/docs/getting-started#getting-started-with-hardhat-3)
- [OpenZeppelin ERC-20 Documentation](https://docs.openzeppelin.com/contracts/4.x/erc20)
- [ERC-20 Permit Explanation](https://eips.ethereum.org/EIPS/eip-2612)
- [Viem Documentation](https://viem.sh/)

## Contributing

Contributions are welcome! Please ensure:

1. All tests pass
2. Code follows the existing style
3. New features include appropriate tests
4. Documentation is updated as needed

## License

This project is licensed under the MIT License.
