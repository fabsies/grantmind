import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  type Account
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts'; // Fix 1: correct import path
import { grantRegistryAbi } from '@/lib/abis/GrantRegistry';

// Fix 2: use defineChain so Viem can properly infer chain types
const passetHub = defineChain({
  id: 420420417,
  name: 'Polkadot Hub TestNet',
  nativeCurrency: { name: 'PAS', symbol: 'PAS', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_RPC_URL!] }
  }
});

const account = privateKeyToAccount(
  process.env.ORACLE_PRIVATE_KEY as `0x${string}`
);

const publicClient = createPublicClient({
  chain: passetHub,
  transport: http(process.env.NEXT_PUBLIC_RPC_URL!)
});

const walletClient = createWalletClient({
  account,
  chain: passetHub,
  transport: http(process.env.NEXT_PUBLIC_RPC_URL!)
});

// Fix 3: explicit return type so proposal fields are known to TypeScript
type Proposal = {
  id: bigint;
  proposer: `0x${string}`;
  title: string;
  description: string;
  requestedAmount: bigint;
  recipient: `0x${string}`;
  score: number;
  summary: string;
  scored: boolean;
  state: number;
};

type WriteScoreInput = {
  proposalId: bigint;
  score: number;
  summary: string;
};

export async function writeScore({ proposalId, score, summary }: WriteScoreInput) {
  const proposal = await publicClient.readContract({
    address: process.env.GRANT_REGISTRY_ADDRESS as `0x${string}`,
    abi: grantRegistryAbi,
    functionName: 'getProposal',
    args: [proposalId]
  }) as Proposal; // Fix 3: cast to typed Proposal so .id and .scored resolve

  // Fix 4: compare to BigInt(0) instead of 0n literal (targets below ES2020)
  if (!proposal || proposal.id === BigInt(0)) {
    throw new Error('PROPOSAL_NOT_FOUND');
  }

  if (proposal.scored === true) {
    throw new Error('PROPOSAL_ALREADY_SCORED');
  }

  // Fix 5: pass account explicitly to writeContract to satisfy Viem's type requirement
  const txHash = await walletClient.writeContract({
    account,
    address: process.env.GRANT_REGISTRY_ADDRESS as `0x${string}`,
    abi: grantRegistryAbi,
    functionName: 'setScore',
    args: [proposalId, score, summary]
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  return {
    txHash: receipt.transactionHash,
    blockNumber: receipt.blockNumber
  };
}