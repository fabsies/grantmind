import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { grantRegistryAbi } from '@/lib/abis/GrantRegistry';

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

type Proposal = {
  applicant: `0x${string}`;
  title: string;
  description: string;
  requestedAmount: bigint;
  recipientWallet: `0x${string}`;
  referenceLinks: string[];
  exists: boolean;
  aiReviewed: boolean;
  aiScore: number;
  aiSummary: string;
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
  }) as unknown as Proposal;

  if (!proposal || !proposal.exists) {
    throw new Error('PROPOSAL_NOT_FOUND');
  }

  if (proposal.aiReviewed === true) {
    throw new Error('PROPOSAL_ALREADY_SCORED');
  }

  const txHash = await walletClient.writeContract({
    account,
    address: process.env.GRANT_REGISTRY_ADDRESS as `0x${string}`,
    abi: grantRegistryAbi,
    functionName: 'fulfillAIReview',
    args: [proposalId, score, summary]
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  return {
    txHash: receipt.transactionHash,
    blockNumber: receipt.blockNumber
  };
}