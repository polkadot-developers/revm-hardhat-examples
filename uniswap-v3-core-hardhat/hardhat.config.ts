import { HardhatUserConfig, vars } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

/**
 * SECURITY NOTE:
 * This config uses Hardhat's configuration variables for secure private key management.
 *
 * To securely set your private key:
 * 1. Run: npx hardhat vars set TESTNET_PRIVATE_KEY
 * 2. Enter your private key when prompted
 * 3. The value is stored securely (run 'npx hardhat vars path' to see location)
 *
 * Other useful commands:
 * - List all variables: npx hardhat vars list
 * - View a variable: npx hardhat vars get TESTNET_PRIVATE_KEY
 * - Delete a variable: npx hardhat vars delete TESTNET_PRIVATE_KEY
 *
 * NEVER commit private keys or expose them in code/logs.
 */

const config: HardhatUserConfig = {
  solidity: {
    version: "0.7.6",
    settings: {
      optimizer: {
        enabled: true,
        runs: 800,
      },
      metadata: {
        // Exclude metadata hash to keep contract size deterministic and under EIP-170 limit
        // This matches the original Uniswap V3 Core deployment configuration
        bytecodeHash: "none",
      },
    },
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
    },
    localNode: {
      url: "http://127.0.0.1:8545",
      gasPrice: 50_000_000_000, // 50 gwei — matches Polkadot local node reported gas price
    },
    polkadotTestnet: {
      url: "https://services.polkadothub-rpc.com/testnet",
      accounts: vars.has("TESTNET_PRIVATE_KEY")
        ? [vars.get("TESTNET_PRIVATE_KEY")]
        : [],
    },
  },
  ignition: {
    requiredConfirmations: 1,
  },
  mocha: {
    timeout: 120000,
    // On localNode, skip the 256-RPC-loop BitMath tests (all powers of 2).
    // These fire 256 consecutive eth_call requests which overwhelms the Polkadot
    // local node's TCP connection limit, causing ECONNRESET. Their correctness is
    // already covered by the hardhat network run. All other 693 tests pass on localNode.
    ...(process.env.HARDHAT_NETWORK === "localNode"
      ? { grep: "all powers of 2", invert: true }
      : {}),
  },
};

export default config;
