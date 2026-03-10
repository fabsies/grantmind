// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";


// GovernanceToken.sol
// ERC-20 + ERC20Votes for weighted governance

// interface IGovernanceToken {
//     function mint(address to, uint256 amount) external;
//     function faucet() external;
//     function setFaucetAmount(uint256 amount) external;
//     function setFaucetCooldown(uint256 seconds_) external;

// }

//in case i need it, add the interface back in and have the contract implement it. for now, it's not necessary since the functions are all public and can be called directly on the contract address. 
//make sure to inherit /*IGovernanceToken */ in the contract declaration if you decide to implement the interface.

contract GovernanceToken is ERC20, ERC20Permit, ERC20Votes, Ownable {
    uint256 public faucetAmount = 100 * 10 ** decimals();
    uint256 public faucetCooldown = 1 days;
    uint256 public constant MAX_SUPPLY = 10_000_000 * 10 ** 18;
    error MaxSupplyExceeded();

    function _checkSupplyCap(uint256 amount) private view {
    if (totalSupply() + amount > MAX_SUPPLY) revert MaxSupplyExceeded();
}

    mapping(address => uint256) public lastFaucetTime;

    error FaucetCooldownNotMet(uint256 timeRemaining);

    constructor()
        ERC20("GrantMind Token", "GMT")
        ERC20Permit("GrantMind Token")
        Ownable(msg.sender)
    {
        // Mint initial supply to deployer
        _checkSupplyCap(1_000_000 * 10 ** decimals());
        _mint(msg.sender, 1_000_000 * 10 ** decimals());
    }

    /// @notice Admin can mint tokens
    function mint(address to, uint256 amount) external onlyOwner {
        _checkSupplyCap(amount);
        _mint(to, amount);
    }

    /// @notice Public faucet for hackathon testing
    function faucet() external {
        if (block.timestamp < lastFaucetTime[msg.sender] + faucetCooldown) {
            revert FaucetCooldownNotMet(
                (lastFaucetTime[msg.sender] + faucetCooldown) - block.timestamp
            );
        }

        _checkSupplyCap(faucetAmount);
        lastFaucetTime[msg.sender] = block.timestamp;
        _mint(msg.sender, faucetAmount);

        if (delegates(msg.sender) == address(0)) 
        _delegate(msg.sender, msg.sender);
    }

    /// @notice Admin can change faucet amount
    function setFaucetAmount(uint256 amount) external onlyOwner {
        faucetAmount = amount;
    }

    /// @notice Admin can change faucet cooldown
    function setFaucetCooldown(uint256 cooldownSeconds) external onlyOwner {
        faucetCooldown = cooldownSeconds;
    }

    // The following functions are overrides required by Solidity.

    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Votes) {
        super._update(from, to, value);
    }

    function nonces(address owner) public view virtual override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }
}
