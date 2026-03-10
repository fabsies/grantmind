// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

// GrantRegistry.sol
// Stores all submitted proposals and allows Oracle to update them


contract GrantRegistry is AccessControl {

    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    struct Proposal {
        address applicant;
        string title;
        string description;
        uint256 requestedAmount;
        address recipientWallet;
        string[] referenceLinks;
        bool exists;
        
        // AI Review Fields
        bool aiReviewed;
        uint8 aiScore;
        string aiSummary;
    }

    uint256 public nextProposalId;
    address public oracleWallet;
    
    mapping(uint256 => Proposal) public proposals;

    event ProposalSubmitted(uint256 indexed proposalId, address indexed applicant, string title);
    event ProposalReviewedByAI(uint256 indexed proposalId, uint8 score, string summary);
    event OracleWalletUpdated(address indexed oldOracle, address indexed newOracle);

    error NotOracle(address caller);
    error ProposalDoesNotExist(uint256 proposalId);
    error ProposalAlreadyReviewed(uint256 proposalId);
    error InvalidAddress();
    error InputTooLong(string field);
    error TooManyReferenceLinks();

    constructor(address _oracleWallet) {
        if (_oracleWallet == address(0)) revert InvalidAddress();
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, _oracleWallet);
        oracleWallet = _oracleWallet;
    }

    /// @notice Allows admin to change the trusted Oracle wallet
    function setOracleWallet(address _newOracle) external onlyRole(ADMIN_ROLE) {
        if (_newOracle == address(0)) revert InvalidAddress();
        _revokeRole(ORACLE_ROLE, oracleWallet);
        emit OracleWalletUpdated(oracleWallet, _newOracle);
        oracleWallet = _newOracle;
        _grantRole(ORACLE_ROLE, _newOracle);

    }

    /// @notice Anyone can submit a proposal
    function submitProposal(
        string calldata _title,
        string calldata _description,
        uint256 _requestedAmount,
        address _recipientWallet,
        string[] calldata _referenceLinks
    ) external returns (uint256) {
        if (_recipientWallet == address(0)) revert InvalidAddress();
        if (bytes(_title).length == 0 || bytes(_title).length > 100) revert InputTooLong("title");
        if (bytes(_description).length == 0 || bytes(_description).length > 2000) revert InputTooLong("description");
        if (_referenceLinks.length > 10) revert TooManyReferenceLinks();

        uint256 proposalId = nextProposalId++;
        proposals[proposalId] = Proposal({
            applicant: msg.sender,
            title: _title,
            description: _description,
            requestedAmount: _requestedAmount,
            recipientWallet: _recipientWallet,
            referenceLinks: _referenceLinks,
            exists: true,
            aiReviewed: false,
            aiScore: 0,
            aiSummary: ""
        });

        emit ProposalSubmitted(proposalId, msg.sender, _title);
        
        return proposalId;
    }

    /// @notice Only the trusted off-chain Oracle can write AI scores
    function fulfillAIReview(uint256 _proposalId, uint8 _score, string calldata _summary) external {
        if (!hasRole(ORACLE_ROLE, msg.sender)) revert NotOracle(msg.sender);

        Proposal storage proposal = proposals[_proposalId];
        if (!proposal.exists) revert ProposalDoesNotExist(_proposalId);
        if (proposal.aiReviewed) revert ProposalAlreadyReviewed(_proposalId);

        proposal.aiReviewed = true;
        proposal.aiScore = _score;
        proposal.aiSummary = _summary;

        emit ProposalReviewedByAI(_proposalId, _score, _summary);
    }
    
    function getProposal(uint256 _proposalId) external view returns (Proposal memory) {
        if (!proposals[_proposalId].exists) revert ProposalDoesNotExist(_proposalId);
        return proposals[_proposalId];
    }
}
