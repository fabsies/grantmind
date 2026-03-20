# GrantMind

**AI-Curated DAO Grant Allocator on Polkadot Hub**

Polkadot Solidity Hackathon 2026 — EVM Smart Contract Track

**Live Application:** [https://grantmind-theta.vercel.app](https://grantmind-theta.vercel.app)

---

## Table of Contents

1. [Overview](#overview)
2. [How It Works](#how-it-works)
3. [Architecture](#architecture)
4. [Smart Contracts](#smart-contracts)
5. [Prerequisites](#prerequisites)
6. [Environment Variables](#environment-variables)
7. [Installation](#installation)
8. [Running the Application](#running-the-application)
9. [Smart Contract Deployment](#smart-contract-deployment)
10. [Deployed Contracts (Passet Hub Testnet)](#deployed-contracts-passet-hub-testnet)
11. [Wallet Configuration](#wallet-configuration)
12. [Project Structure](#project-structure)
13. [Technology Stack](#technology-stack)
14. [Hackathon Compliance](#hackathon-compliance)
15. [Roadmap](#roadmap)
16. [License](#license)

---

## Overview

GrantMind is a decentralized grant allocation platform that combines Solidity smart contracts on the Polkadot Hub EVM with the Google Gemini AI API. It enables DAO communities to receive funding proposals, evaluate them through an AI scoring layer, and govern capital distribution via on-chain token-weighted voting — all without manual administration.

The platform is deployed to the Passet Hub Testnet (Chain ID `420420417`) using the REVM execution path. All contracts are written in Solidity, compiled and tested with Foundry, and interact with a Next.js frontend via Wagmi and Viem.

---

## How It Works

GrantMind operates in three sequential stages.

**Stage 1 — Proposal Submission**
A user connects their wallet to the application and submits a grant proposal through the frontend form. The submission is written directly to the `GrantRegistry` smart contract on-chain, recording the title, description, requested funding amount, recipient wallet address, and any supporting links.

**Stage 2 — AI Scoring**
Once a proposal is on-chain, the backend API route calls the Google Gemini API with a structured prompt. Gemini evaluates the proposal across four dimensions: innovation, technical feasibility, ecosystem alignment with Polkadot and Web3, and team credibility. The AI returns a numeric score out of 100 and a plain-English summary. The backend oracle wallet then writes this score and summary back to the `GrantRegistry` contract, making the AI assessment permanently recorded on-chain.

**Stage 3 — Voting and Disbursement**
Token holders browse the AI-ranked proposal leaderboard and cast votes weighted by their governance token balance. When a proposal accumulates votes sufficient to meet the dynamic quorum threshold defined in `GrantDAO`, the contract automatically transfers the requested funds from the treasury to the proposer's wallet address. No manual intervention is required at any stage.

---

## Architecture

```
Frontend (Next.js)
    |
    |-- Wagmi / Viem --> Passet Hub Testnet (Chain ID 420420417)
    |                        |
    |                   GovernanceToken.sol
    |                   GrantRegistry.sol
    |                   GrantDAO.sol
    |
    |-- Next.js API Routes (Backend Oracle)
            |
            |-- Google Gemini API (AI Scoring)
            |
            |-- Viem Server Wallet Client --> GrantRegistry.setScore()
```

The frontend handles wallet connection and all user-facing interactions. The backend API routes act as a trusted oracle bridge: they receive proposal data, call Gemini for scoring, and write the result on-chain using a dedicated oracle wallet. The smart contracts hold all state, enforce access control, and manage treasury disbursement.

---

## Smart Contracts

### `GovernanceToken.sol`
An ERC-20 token contract built on OpenZeppelin implementing `ERC20Votes` and `ERC20Permit`. Token balance determines a wallet's voting weight within the DAO.

### `GrantRegistry.sol`
Stores all submitted proposals along with their AI-generated scores and summaries. Score writes are restricted to wallets holding the `ORACLE_ROLE` via OpenZeppelin `AccessControl`. All proposal data is publicly readable on-chain.

### `GrantDAO.sol`
Contains snapshot voting logic, a dynamic quorum mechanism, and treasury management. Voting weight is read via `getPastVotes` at the snapshot block stored when a proposal enters voting. A minimum AI score of 50 is required before a proposal can proceed to a vote. When the quorum threshold is met, the contract automatically transfers the requested funds to the proposer's wallet.

---

## Prerequisites

The following tools must be installed before proceeding.

| Tool | Purpose | Minimum Version |
|---|---|---|
| [Node.js](https://nodejs.org/) | Frontend and backend runtime | 18.x |
| [npm](https://www.npmjs.com/) | Package management | 9.x |
| [Foundry (foundry-polkadot)](https://github.com/paritytech/foundry-polkadot) | Smart contract compilation, testing, deployment | 1.3.6-dev |
| [Git](https://git-scm.com/) | Version control | Any recent version |
| [WSL2 (Ubuntu)](https://learn.microsoft.com/en-us/windows/wsl/) | Required on Windows for Foundry commands | Ubuntu 22.04+ |

You will also need:
- A [MetaMask](https://metamask.io/) browser wallet (used as the deployer, admin, and oracle wallet)
- A [SubWallet](https://www.subwallet.app/) browser wallet (used as the voter and proposer wallet)
- A Google Gemini API key ([obtain one here](https://aistudio.google.com/))
- PAS testnet tokens, which can be requested from the Passet Hub faucet

---

## Environment Variables

Two separate environment files are required. Do not commit either file to version control.

### `.env` — Foundry use only (project root)

```
DEPLOYER_PRIVATE_KEY=0xyour_deployer_private_key
```

This file is used exclusively by Foundry scripts and `cast` commands. It must not be checked into Git.

### `.env.local` — Next.js application (project root)

```
ORACLE_PRIVATE_KEY=0xyour_oracle_private_key
GEMINI_API_KEY=your_gemini_api_key
GRANT_REGISTRY_ADDRESS=0xe586C240733AeAFE73277fb1A6f8C39bbD35227C
GOVERNANCE_TOKEN_ADDRESS=0x4730aC8A9489c093c4DA1ff8B039d872213C27D5
GRANT_DAO_ADDRESS=0xAf2389F39D524dac0090c2b9a608D988536175c6
NEXT_PUBLIC_RPC_URL=https://eth-rpc-testnet.polkadot.io/
QUORUM_NUMERATOR=10
```

The `ORACLE_PRIVATE_KEY` must include the `0x` prefix. The deployer private key must only appear in `.env`, never in `.env.local`.

---

## Installation

Clone the repository and install dependencies.

```bash
git clone https://github.com/fabsies/grantmind.git
cd grantmind
npm install
```

Install Foundry submodule dependencies.

```bash
forge install OpenZeppelin/openzeppelin-contracts --no-git
forge install foundry-rs/forge-std --no-git
```

Create the two environment files described above and populate them with your values.

---

## Running the Application

Start the Next.js development server from the project root.

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

To build for production deployment:

```bash
npm run build
npm start
```

The application is configured for deployment to [Vercel](https://vercel.com/). Connect the repository to a Vercel project and add the `.env.local` variables as environment variables in the Vercel dashboard.

---

## Smart Contract Deployment

All Foundry commands must be run from within WSL2 (Ubuntu).

**Step 1.** Export your environment variables before running any Foundry command.

```bash
export $(cat .env | xargs)
```

**Step 2.** Compile the contracts.

```bash
forge build
```

**Step 3.** Run the test suite.

```bash
forge test
```

**Step 4.** Deploy using the deployment script. The `--broadcast` flag is not honoured by foundry-polkadot 1.3.6-dev; use `forge script` with `vm.startBroadcast()` as implemented in the deploy script.

```bash
forge script script/Deploy.s.sol \
  --rpc-url https://eth-rpc-testnet.polkadot.io/ \
  --private-key $DEPLOYER_PRIVATE_KEY
```

**Step 5.** Verify deployment by checking that bytecode exists at each deployed address.

```bash
cast code <CONTRACT_ADDRESS> --rpc-url https://eth-rpc-testnet.polkadot.io/
```

A non-empty response confirms the contract is live on-chain.

---

## Deployed Contracts (Passet Hub Testnet)

| Contract | Address |
|---|---|
| `GovernanceToken` | `0x4730aC8A9489c093c4DA1ff8B039d872213C27D5` |
| `GrantRegistry` | `0xe586C240733AeAFE73277fb1A6f8C39bbD35227C` |
| `GrantDAO` | `0xAf2389F39D524dac0090c2b9a608D988536175c6` |

**Network:** Passet Hub Testnet
**Chain ID:** `420420417`
**RPC URL:** `https://eth-rpc-testnet.polkadot.io/`

---

## Wallet Configuration

### Adding Passet Hub Testnet to MetaMask

Open MetaMask, navigate to Settings → Networks → Add a network, and enter the following values.

| Field | Value |
|---|---|
| Network Name | Passet Hub Testnet |
| RPC URL | `https://eth-rpc-testnet.polkadot.io/` |
| Chain ID | `420420417` |
| Currency Symbol | PAS |

> Do not use `https://testnet-passet-hub-eth-rpc.polkadot.io` — this URL fails chain ID resolution in MetaMask.

### Wallet Roles

| Wallet | Role |
|---|---|
| MetaMask | Deployer, admin, and oracle wallet. Holds `ORACLE_ROLE` on `GrantRegistry`. |
| SubWallet | Voter and proposer wallet. Used to submit proposals and cast votes. |

---

## Project Structure

```
grantmind/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── oracle/
│   │   │       └── score/
│   │   │           └── route.ts        # Oracle API route: Gemini scoring + on-chain write
│   │   └── ...                         # Next.js App Router pages
│   └── lib/
│       ├── abis/
│       │   └── GrantRegistry.ts        # ABI for GrantRegistry contract
│       ├── gemini.ts                   # Gemini client with structured JSON scoring
│       └── oracle.ts                  # Viem server-side wallet client for setScore()
├── contracts/
│   ├── GovernanceToken.sol
│   ├── GrantRegistry.sol
│   └── GrantDAO.sol
├── script/
│   └── Deploy.s.sol                    # Foundry deployment script
├── test/
│   └── ...                             # Foundry test files
├── docs/
│   └── ARCHITECTURE.md                 # Detailed architecture reference
├── foundry.toml                        # Foundry configuration
├── .env                                # Foundry secrets — never commit
├── .env.local                          # Next.js secrets — never commit
└── README.md
```

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Smart Contracts | Solidity + OpenZeppelin v5 | On-chain logic, access control, treasury |
| Contract Tooling | foundry-polkadot 1.3.6-dev | Compilation, testing, deployment scripting |
| Frontend | Next.js 14 (App Router, TypeScript) | User interface and backend API routes |
| Wallet / Chain | Wagmi + Viem | Wallet connection, contract reads and writes |
| AI Layer | Google Gemini 2.0 Flash (`@google/generative-ai`) | Proposal scoring and summarization |
| Deployment Target | Passet Hub Testnet (REVM) | EVM-compatible Polkadot parachain |
| Hosting | Vercel | Frontend and API route deployment |

---

## Hackathon Compliance

| Requirement | Status |
|---|---|
| Open-source codebase | Public repository on GitHub under an open-source license |
| Non-commercial | Public goods tool; no commercial use intended or planned |
| Original code | All contracts and application code written from scratch during the hackathon |
| EVM Smart Contract Track | All contracts are Solidity, deployed to Polkadot Hub via REVM |
| Commit history | Active commits with descriptive messages throughout development |
| On-chain identity | Polkadot wallet with on-chain identity configured prior to submission |
| Documentation | README, architecture diagram (`docs/ARCHITECTURE.md`), and local setup guide included |
| Demo | Hosted on Vercel; demo video produced for final submission |

---

## Roadmap

### Phase 2 — Post-Hackathon
- Multi-round voting: AI shortlisting followed by a final community vote
- Integration with Polkadot's native identity pallet via Polkadot-API to verify proposer identity on-chain
- Deployment to Polkadot Hub mainnet
- DAO-configurable AI scoring weights per dimension

### Phase 3 — Long-term
- Cross-chain grant disbursement via XCM to any Polkadot parachain
- Quadratic voting support to reduce concentration of voting power
- Multi-AI provider support (Gemini, GPT-4, Claude)
- Governance dashboard with historical grant data, funding analytics, and treasury health metrics

---

## License

This project is released under the MIT License. See `LICENSE` for details.

---

*GrantMind — Polkadot Solidity Hackathon 2026*