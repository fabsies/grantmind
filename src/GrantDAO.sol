// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {GrantRegistry} from "./GrantRegistry.sol";
import {GovernanceToken} from "./GovernanceToken.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";


// GrantDAO.sol
// Handles token-weighted voting on AI-reviewed proposals

contract GrantDAO is ReentrancyGuard, Ownable {

    GovernanceToken public immutable govToken;
    GrantRegistry public immutable registry;

    uint256 public constant VOTING_PERIOD = 7 days;
    uint256 public quorumNumerator;
    uint256 public constant QUORUM_DENOMINATOR = 10_000; // For basis points calculation
    uint256 public constant MIN_AI_SCORE = 50;


    enum ProposalState { Pending, Active, Succeeded, Defeated, Executed }

    struct ProposalVote {
        uint256 againstVotes;
        uint256 forVotes;
        uint256 startTime;
        uint256 endTime;
        uint256 snapShotBlock;
        bool executed;
        bool isActive;
    }

    mapping(uint256 => ProposalVote) public proposalVotes;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event VoteCast(address indexed voter, uint256 indexed proposalId, uint8 support, uint256 weight);
    event ProposalExecuted(uint256 indexed proposalId);
    event VotingStarted(uint256 indexed proposalId, uint256 endTime);
    event QuorumNumeratorUpdated(uint256 oldNumerator, uint256 newNumerator);
    event TreasuryDeposited(address indexed sender, uint256 amount);
    event EmergencyWithdrawal(address indexed to, uint256 amount);


    error AlreadyVoted(address voter);
    error ProposalNotActive(uint256 proposalId);
    error ProposalNotSucceeded(uint256 proposalId);
    error TreasuryEmpty();

    constructor(address _govToken, address _registry, uint256 _quorumNumerator) Ownable(msg.sender) {
        require(_quorumNumerator <= 2_000, "Quorum cannot exceed 20%");
        govToken = GovernanceToken(_govToken);
        registry = GrantRegistry(_registry);
        quorumNumerator = _quorumNumerator;
    }

    function updateQuorumNumerator(uint256 newNumerator) external onlyOwner {
        require(newNumerator <= 2_000, "Quorum cannot exceed 20%");
        emit QuorumNumeratorUpdated(quorumNumerator, newNumerator);
        quorumNumerator = newNumerator;
    }

    /// @notice Anybody can start voting for a proposal that has been AI-reviewed
    function startVoting(uint256 _proposalId) external {
        GrantRegistry.Proposal memory proposal = registry.getProposal(_proposalId);
        require(proposal.aiReviewed, "Proposal not yet reviewed by AI");
        require(proposal.aiScore >= MIN_AI_SCORE, "Proposal score below minimum threshold");
        require(!proposalVotes[_proposalId].isActive, "Voting already started");
        require(address(this).balance >= proposal.requestedAmount, "Insufficient treasury to fund proposal");


        proposalVotes[_proposalId] = ProposalVote({
            againstVotes: 0,
            forVotes: 0,
            startTime: block.timestamp,
            endTime: block.timestamp + VOTING_PERIOD,
            snapShotBlock: block.number - 1, // Snapshot voting power at the block before voting starts
            executed: false,
            isActive: true
        });

        emit VotingStarted(_proposalId, block.timestamp + VOTING_PERIOD);
    }    

    /// @notice Cast a vote on an active proposal
    /// @param support 0 = Against, 1 = For
    function castVote(uint256 _proposalId, uint8 support) external {
        ProposalVote storage pv = proposalVotes[_proposalId];
        
        if (!pv.isActive || block.timestamp > pv.endTime) revert ProposalNotActive(_proposalId);
        if (hasVoted[_proposalId][msg.sender]) revert AlreadyVoted(msg.sender);

        uint256 weight = govToken.getPastVotes(msg.sender, pv.snapShotBlock);
        require(weight > 0, "No voting power");

        hasVoted[_proposalId][msg.sender] = true;

        if (support == 0) {
            pv.againstVotes += weight;
        } else if (support == 1) {
            pv.forVotes += weight;
        } else {
            revert("Invalid support value");
        }

        emit VoteCast(msg.sender, _proposalId, support, weight);
    }

    /// @notice Execute a successful proposal
    function execute(uint256 _proposalId) external nonReentrant {
        if (state(_proposalId) != ProposalState.Succeeded) revert ProposalNotSucceeded(_proposalId);
        
        ProposalVote storage pv = proposalVotes[_proposalId];
        pv.executed = true;

        GrantRegistry.Proposal memory proposal = registry.getProposal(_proposalId);
        require(address(this).balance >= proposal.requestedAmount, "Insufficient DAO treasury");

        (bool success, ) = proposal.recipientWallet.call{value: proposal.requestedAmount}("");
        require(success, "Transfer failed");

        emit ProposalExecuted(_proposalId);
    }

    /// @notice Calculate the state of a proposal
    function state(uint256 _proposalId) public view returns (ProposalState) {
        ProposalVote memory pv = proposalVotes[_proposalId];

        if (!pv.isActive) {
            return ProposalState.Pending;
        }

        if (block.timestamp <= pv.endTime) {
            return ProposalState.Active;
        }

        if (pv.executed) {
            return ProposalState.Executed;
        }

        if (pv.forVotes > pv.againstVotes) {
            uint256 totalSupplyAtSnapshot = govToken.getPastTotalSupply(pv.snapShotBlock);
            uint256 dynamicQuorum = (totalSupplyAtSnapshot * quorumNumerator) / QUORUM_DENOMINATOR;

            if ((pv.forVotes + pv.againstVotes) >= dynamicQuorum) {
                return ProposalState.Succeeded;
            }
        }
        return ProposalState.Defeated;
    }

    /// @notice Emergency function to withdraw funds from the DAO treasury
    /// @dev Only callable by the contract owner in case of an emergency
    function emergencyWithdraw(address payable to, uint256 amount) external onlyOwner {
        if (address(this).balance == 0) revert TreasuryEmpty();
        require(to != address(0), "Invalid address");
        emit EmergencyWithdrawal(to, amount);
        (bool success, ) = to.call{value: amount}("");
        require(success, "Withdrawal failed");
    }


    /// @notice Fallback to accept native tokens into the DAO treasury
    receive() external payable {
        emit TreasuryDeposited(msg.sender, msg.value);
    }
}
