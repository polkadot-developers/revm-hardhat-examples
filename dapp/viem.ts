import { createPublicClient, http, createWalletClient, custom } from 'viem'
import 'viem/window';


const transport = http('http://127.0.0.1:8545') // TODO: change to the paseo asset hub RPC URL when it's available

// Configure the Polkadot Testnet Hub chain
export const polkadotTestnet = {
  id: 420420420,
  name: 'Polkadot Testnet',
  network: 'polkadot-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'PAS',
    symbol: 'PAS',
  },
  rpcUrls: {
    default: {
      http: ['http://127.0.0.1:8545'], // TODO: change to the paseo asset hub RPC URL
    },
  },
} as const

// Create a public client for reading data
export const publicClient = createPublicClient({
  chain: polkadotTestnet,
  transport
})

// Create a wallet client for signing transactions
export const getWalletClient = async () => {
  if (typeof window !== 'undefined' && window.ethereum) {
    const [account] = await window.ethereum.request({ method: 'eth_requestAccounts' });
    return createWalletClient({
      chain: polkadotTestnet,
      transport: custom(window.ethereum),
      account,
    });
  }
  throw new Error('No Ethereum browser provider detected');
};