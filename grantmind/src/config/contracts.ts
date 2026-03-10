// grantmind/src/config/contracts.ts

export const CONTRACT_ADDRESSES = {
  grantRegistry: "0x...",
  grantDAO: "0x...",
  governanceToken: "0x...",
} as const;

export const WALLET_ADDRESSES = {
  deployer: "0x...",
  oracle: "0x...",
} as const;

export const CHAIN_CONFIG = {
  id: 420420417,
  rpcUrl: "https://eth-rpc-testnet.polkadot.io/",
} as const;