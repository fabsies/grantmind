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
  },
  {
    name: "nextProposalId",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "getProposal",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "proposalId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "applicant", type: "address" },
          { name: "title", type: "string" },
          { name: "description", type: "string" },
          { name: "requestedAmount", type: "uint256" },
          { name: "recipientWallet", type: "address" },
          { name: "referenceLinks", type: "string[]" },
          { name: "exists", type: "bool" },
          { name: "aiReviewed", type: "bool" },
          { name: "aiScore", type: "uint8" },
          { name: "aiSummary", type: "string" }
        ]
      }
    ]
  }
] as const;