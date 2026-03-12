export const grantRegistryAbi = [
  {
    name: "setScore",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "proposalId", type: "uint256" },
      { name: "score", type: "uint8" },
      { name: "summary", type: "string" }
    ],
    outputs: []
  },
  {
    name: "getProposal",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "proposalId", type: "uint256" }
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "proposer", type: "address" },
          { name: "title", type: "string" },
          { name: "description", type: "string" },
          { name: "requestedAmount", type: "uint256" },
          { name: "recipient", type: "address" },
          { name: "score", type: "uint8" },
          { name: "summary", type: "string" },
          { name: "scored", type: "bool" },
          { name: "state", type: "uint8" }
        ]
      }
    ]
  }
] as const;