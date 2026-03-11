export const grantRegistryAbi = [
  {
    name: "fulfillAIReview",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_proposalId", type: "uint256" },
      { name: "_score", type: "uint8" },
      { name: "_summary", type: "string" }
    ],
    outputs: []
  }
] as const;