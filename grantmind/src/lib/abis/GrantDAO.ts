export const grantDaoAbi = [
  // ── Functions ──────────────────────────────────────────────────
  {
    name: "startVoting",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_proposalId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "castVote",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_proposalId", type: "uint256" },
      { name: "support", type: "uint8" },
    ],
    outputs: [],
  },
  {
    name: "execute",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_proposalId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "state",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_proposalId", type: "uint256" }],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "proposalVotes",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "againstVotes", type: "uint256" },
      { name: "forVotes", type: "uint256" },
      { name: "startTime", type: "uint256" },
      { name: "endTime", type: "uint256" },
      { name: "snapShotBlock", type: "uint256" },
      { name: "executed", type: "bool" },
      { name: "isActive", type: "bool" },
    ],
  },
  {
    name: "hasVoted",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "quorumNumerator",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "updateQuorumNumerator",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "newNumerator", type: "uint256" }],
    outputs: [],
  },
  {
    name: "emergencyWithdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },

  // ── Events ─────────────────────────────────────────────────────
  {
    name: "VoteCast",
    type: "event",
    inputs: [
      { name: "voter", type: "address", indexed: true },
      { name: "proposalId", type: "uint256", indexed: true },
      { name: "support", type: "uint8", indexed: false },
      { name: "weight", type: "uint256", indexed: false },
    ],
  },
  {
    name: "VotingStarted",
    type: "event",
    inputs: [
      { name: "proposalId", type: "uint256", indexed: true },
      { name: "endTime", type: "uint256", indexed: false },
    ],
  },
  {
    name: "ProposalExecuted",
    type: "event",
    inputs: [{ name: "proposalId", type: "uint256", indexed: true }],
  },
  {
    name: "TreasuryDeposited",
    type: "event",
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    name: "EmergencyWithdrawal",
    type: "event",
    inputs: [
      { name: "to", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    name: "QuorumNumeratorUpdated",
    type: "event",
    inputs: [
      { name: "oldNumerator", type: "uint256", indexed: false },
      { name: "newNumerator", type: "uint256", indexed: false },
    ],
  },

  // ── Errors ─────────────────────────────────────────────────────
  {
    name: "AlreadyVoted",
    type: "error",
    inputs: [{ name: "voter", type: "address" }],
  },
  {
    name: "ProposalNotActive",
    type: "error",
    inputs: [{ name: "proposalId", type: "uint256" }],
  },
  {
    name: "ProposalNotSucceeded",
    type: "error",
    inputs: [{ name: "proposalId", type: "uint256" }],
  },
  {
    name: "TreasuryEmpty",
    type: "error",
    inputs: [],
  },

  // ── Constructor ────────────────────────────────────────────────
  {
    type: "constructor",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_govToken", type: "address" },
      { name: "_registry", type: "address" },
      { name: "_quorumNumerator", type: "uint256" },
    ],
  },

  // ── Receive ────────────────────────────────────────────────────
  { type: "receive", stateMutability: "payable" },
] as const;