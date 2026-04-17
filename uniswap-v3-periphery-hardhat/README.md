# Uniswap V3 Periphery Hardhat Example

A Uniswap V3 periphery protocol implementation using Hardhat, demonstrating how to deploy and interact with a concentrated-liquidity DEX router and position manager on the Polkadot testnet.

## Overview

This project demonstrates how to deploy and test the Uniswap V3 periphery contracts using Hardhat. The periphery layer sits on top of the V3 core (factory + pool) and provides user-facing interfaces for swapping tokens and managing liquidity positions as ERC721 NFTs.

## Contracts

### Main contracts

- **SwapRouter**: Routes token swaps through one or more V3 pools; supports exact-input and exact-output modes for both single-hop and multi-hop paths
- **NonfungiblePositionManager**: Manages concentrated-liquidity positions as ERC721 NFTs; handles mint, increase/decrease liquidity, fee collection, and burn

### Base contracts

- **PeripheryImmutableState**: Stores immutable factory and WETH9 addresses
- **PeripheryPayments** / **PeripheryPaymentsWithFee**: ETH ↔ WETH9 wrapping/unwrapping helpers and fee-on-transfer support
- **LiquidityManagement**: Core callback and liquidity arithmetic shared by NFPM
- **ERC721Permit**: ERC721 with permit (EIP-712 signature-based approval)
- **PoolInitializer**: `createAndInitializePoolIfNecessary` helper
- **Multicall**: Batches multiple calls into a single transaction
- **SelfPermit**: Permits on behalf of the caller using EIP-2612

### Libraries

- **PoolAddress**: Deterministic CREATE2 pool address computation
- **CallbackValidation**: Verifies that mint/swap callbacks originate from a valid V3 pool
- **Path**: Encodes and decodes multi-hop swap paths (`tokenA ++ fee ++ tokenB ++ ...`)
- **BytesLib**: Low-level byte-slice utilities
- **LiquidityAmounts**: Converts token amounts to liquidity units and vice versa
- **PositionKey**: Derives the storage key for a (owner, tickLower, tickUpper) position

### Test helpers (not deployed in production)

- **MockTimeNonfungiblePositionManager**: NFPM with controllable `block.timestamp`
- **MockTimeSwapRouter**: SwapRouter with controllable `block.timestamp`
- **TestERC20**: Mintable ERC20 with permit support
- **WETH9**: Minimal Wrapped Ether implementation for local testing
- **CoreContracts**: Import shim that forces Hardhat to compile `UniswapV3Factory` and `UniswapV3Pool` from `@uniswap/v3-core` so their artifacts are available in tests

## Prerequisites

- [Node.js](https://nodejs.org/) v22 or later
- A Polkadot testnet account with funds (for testnet deployment). You can get testnet tokens from the [Polkadot Faucet](https://faucet.polkadot.io/)
- **This project depends on `uniswap-v3-core-hardhat`** (the sibling directory). Make sure it exists at `../uniswap-v3-core-hardhat`.

### Versions

| Component | Version |
|-----------|---------|
| Hardhat | 2.22.x |
| Solidity | 0.7.6 |
| Node.js | >= 22 |

## Project Structure

```
uniswap-v3-periphery-hardhat/
├── contracts/
│   ├── SwapRouter.sol                      # Swap router (single-hop + multi-hop)
│   ├── NonfungiblePositionManager.sol      # LP position NFT manager
│   ├── NonfungibleTokenPositionDescriptor.sol # On-chain NFT SVG metadata
│   ├── base/                               # Abstract base contracts
│   │   ├── PeripheryImmutableState.sol
│   │   ├── PeripheryPayments.sol
│   │   ├── LiquidityManagement.sol
│   │   ├── ERC721Permit.sol
│   │   ├── PoolInitializer.sol
│   │   └── ...
│   ├── libraries/                          # Pure utility libraries
│   │   ├── PoolAddress.sol
│   │   ├── Path.sol
│   │   ├── LiquidityAmounts.sol
│   │   └── ...
│   ├── interfaces/                         # Contract interfaces
│   │   ├── ISwapRouter.sol
│   │   ├── INonfungiblePositionManager.sol
│   │   └── ...
│   └── test/                              # Test helper contracts
│       ├── WETH9.sol
│       ├── TestERC20.sol
│       ├── MockTimeSwapRouter.sol
│       ├── MockTimeNonfungiblePositionManager.sol
│       └── CoreContracts.sol
├── test/
│   ├── SwapRouter.test.ts                 # Router tests (14 tests)
│   ├── NonfungiblePositionManager.test.ts # NFPM tests (25 tests)
│   └── shared/
│       ├── fixtures.ts                    # Deployment fixtures
│       └── utilities.ts                   # Shared helpers and constants
├── scripts/
│   └── deploy.ts                          # Deployment script
├── ignition/
│   └── modules/
│       └── UniswapV3Periphery.ts          # Hardhat Ignition deployment module
├── hardhat.config.ts                      # Hardhat configuration
├── package.json
├── tsconfig.json
└── README.md
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

Deploy using the deployment script:

```bash
npm run deploy
```

Or deploy using Hardhat Ignition:

```bash
npx hardhat ignition deploy ignition/modules/UniswapV3Periphery.ts
```

## Deployment

### Local Development

```bash
npm run deploy
```

### Polkadot Testnet

To deploy to the Polkadot testnet, you need an account with funds.

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
   npx hardhat ignition deploy ignition/modules/UniswapV3Periphery.ts --network polkadotTestnet
   ```

## Configuration

### Configuration Variables

- `TESTNET_PRIVATE_KEY`: Your private key for deployment (required for testnet)

### Network Configuration

- **hardhat**: Built-in Hardhat network (default, `allowUnlimitedContractSize: true`)
- **localNode**: Local pallet-revive dev node at `http://127.0.0.1:8545`
- **polkadotTestnet**: Polkadot testnet at `https://services.polkadothub-rpc.com/testnet`

### Compiler Settings

Solidity 0.7.6 is compiled with optimizer enabled (`runs: 800`) and `bytecodeHash: "none"`. The metadata hash exclusion is required so the compiled `UniswapV3Pool` bytecode matches the hardcoded `POOL_INIT_CODE_HASH` constant in `PoolAddress.sol`, which the periphery contracts use to compute pool addresses via CREATE2.

## Testing

The test suite covers 39 tests across two files:

### Test case selection rationale

**SwapRouter (14 tests)** — covers the complete swap API surface plus immutables and pool-state impact:

| Test | Why included |
|------|-------------|
| constructor immutables | Confirms factory and WETH9 are wired correctly at deploy time |
| `exactInputSingle` — swap exact in via single pool | Most common real-world swap; verifies token approval → router call → balance change |
| `exactInputSingle` — with `sqrtPriceLimitX96` | Verifies V3's per-swap price limit (partial fill) — a key concentrated-liquidity feature |
| `exactInputSingle` — output to specified recipient | Confirms `recipient` parameter routes tokens to a third address, not the caller |
| `exactInputSingle` — reverts on tight amountOutMinimum | Verifies slippage protection is enforced |
| `exactInput` multi-hop — success | Exercises ABI-encoded path routing through two pools |
| `exactInput` multi-hop — reverts on tight minimum | Multi-hop slippage protection |
| `exactOutputSingle` — buy exact amount | Verifies reverse-routing logic and that exactly `amountOut` is received |
| `exactOutputSingle` — spends less than maximum | Confirms the router refunds unused input in a liquid pool |
| `exactOutputSingle` — reverts when limit exceeded | Verifies amountInMaximum is enforced |
| `exactOutput` multi-hop — success | Confirms reversed path encoding and exact-output multi-hop routing |
| `exactOutput` multi-hop — reverts when limit exceeded | Multi-hop amountInMaximum enforcement |
| `exactInputSingle` moves sqrtPriceX96 | Verifies on-chain pool state changes after a swap |
| `exactOutputSingle` moves sqrtPriceX96 | Verifies pool state changes for reverse-direction swaps |

**NonfungiblePositionManager (25 tests)** — covers the full LP lifecycle and V3-specific mechanics:

| Test | Why included |
|------|-------------|
| constructor immutables | Confirms factory and WETH9 are correct |
| `createAndInitializePoolIfNecessary` — creates pool | End-to-end pool creation and price initialization |
| `createAndInitializePoolIfNecessary` — no-op if exists | Guards against double-initialization reverts |
| `mint` — fails without pool | Guards against silent failures when pool is missing |
| `mint` in-range — mints one NFT | Core LP entry-point; verifies NFT issuance |
| `mint` in-range — decreases token balances | Confirms tokens transfer into the pool |
| `mint` in-range — records position data | Verifies `positions()` returns correct ticks, fee, liquidity |
| `mint` in-range — emits IncreaseLiquidity | Event emission for off-chain indexers |
| `mint` in-range — reverts on impossible slippage | Slippage floor enforcement |
| `mint` above current price — only token0 consumed | V3 concentrated liquidity: out-of-range positions are single-sided |
| `mint` below current price — only token1 consumed | Symmetric single-sided liquidity below the price range |
| `increaseLiquidity` — increases liquidity | Verifies growing an existing position without a new NFT |
| `increaseLiquidity` — emits event | Event emission for indexers |
| `decreaseLiquidity` — stages tokens in tokensOwed | Principal stays in pool until `collect()`; verifies two-step withdrawal |
| `decreaseLiquidity` — removes all liquidity | Verifies full removal sets `liquidity = 0` |
| `decreaseLiquidity` — emits DecreaseLiquidity | Event emission |
| `decreaseLiquidity` — reverts for non-owner | Access control |
| `decreaseLiquidity` — reverts when exceeding position | Overflow guard |
| `collect` — transfers tokensOwed to owner | Final withdrawal step; tokens flow back |
| `collect` — emits Collect | Event emission |
| `collect` — partial collect leaves remainder | Verifies `amount0Max`/`amount1Max` caps work correctly |
| `collect` — LP earns swap fees | Core V3 value proposition: mint → swap through pool → collect (principal + fees) |
| `burn` — destroys NFT after full exit | Verifies three-step cleanup: decreaseLiquidity → collect → burn |
| `burn` — reverts with active liquidity | Cannot burn a live position |
| `burn` — reverts with uncollected tokensOwed | Cannot burn before `collect()` |

**Omitted:**
- ETH-specific swap tests — wrap/unwrap via WETH9 is standard Solidity, not REVM-specific
- NonfungibleTokenPositionDescriptor tests — SVG/metadata generation only, no on-chain state
- QuoterV2 tests — read-only (view-only), no state changes to verify
- TickLens tests — read-only utility, not a core deployment concern
- ERC721 permit tests — standard OpenZeppelin guarantees tested upstream

## Development Features

- **Hardhat v2**: Stable, production-ready development environment
- **TypeScript**: Full type safety throughout the project
- **Ethers v6**: Modern Ethereum library for contract interactions
- **Mocha + Chai**: Robust testing framework
- **TypeChain**: Auto-generated TypeScript types for contracts
- **Hardhat Ignition**: Declarative deployment system
- **Configuration Variables**: Secure, encrypted key management

## Security Considerations

- The contracts are the original unmodified Uniswap V3 periphery implementation
- The `POOL_INIT_CODE_HASH` in `PoolAddress.sol` must match the compiled `UniswapV3Pool` bytecode; a mismatch causes every LP operation to silently call a wrong address
- `NonfungibleTokenPositionDescriptor` address can be `address(0)` for local testing; `tokenURI()` will revert but LP operations work normally
- Flash loans and callback validation (`CallbackValidation.sol`) prevent unauthorized callers from manipulating pool state via callbacks

## Learn More

- [Uniswap V3 Core Whitepaper](https://uniswap.org/whitepaper-v3.pdf)
- [Uniswap V3 Periphery](https://github.com/Uniswap/v3-periphery)
- [Hardhat Documentation](https://hardhat.org/hardhat-runner/docs/getting-started)
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

The contracts in `contracts/` carry a mix of GPL-2.0-or-later and MIT licenses (see individual SPDX identifiers). All other files in this project are MIT licensed.
