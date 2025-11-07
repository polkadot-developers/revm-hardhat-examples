import type { HardhatUserConfig, configVariable } from "hardhat/config";

import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import 'dotenv/config';

const config: HardhatUserConfig = {
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    polkadotTestnet: {
      type: "http",
      url: 'http://127.0.0.1:8545',
      accounts: [process.env.PRIVATE_KEY || ''],
    },
  },
};

export default config;
