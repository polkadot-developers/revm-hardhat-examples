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
 * To set a custom network URL:
 * npx hardhat vars set TESTNET_URL
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
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    polkadotTestnet: {
      url: vars.get("TESTNET_URL", "http://127.0.0.1:8545"),
      accounts: vars.has("TESTNET_PRIVATE_KEY") ? [vars.get("TESTNET_PRIVATE_KEY")] : [],
    },
  },
  mocha: {
    timeout: 40000,
  },
};

export default config;
