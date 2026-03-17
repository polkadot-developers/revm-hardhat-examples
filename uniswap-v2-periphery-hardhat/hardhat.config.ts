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
    compilers: [
      {
        version: "0.5.16",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.6.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
    },
    localNode: {
      url: "http://127.0.0.1:8545",
    },
    polkadotTestnet: {
      url: "https://services.polkadothub-rpc.com/testnet",
      accounts: vars.has("TESTNET_PRIVATE_KEY")
        ? [vars.get("TESTNET_PRIVATE_KEY")]
        : [],
    },
  },
  mocha: {
    timeout: 120000,
  },
};

export default config;
