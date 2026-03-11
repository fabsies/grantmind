// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {GrantDAO} from "../src/GrantDAO.sol";

contract DeployGrantDAO is Script {
    function run() external {
        address govToken = vm.envAddress("GOVERNANCE_TOKEN_ADDRESS");
        address grantRegistry = vm.envAddress("GRANT_REGISTRY_ADDRESS");
        uint256 quorumNumerator = vm.envUint("QUORUM_NUMERATOR");

        vm.startBroadcast();
        new GrantDAO(govToken, grantRegistry, quorumNumerator);
        vm.stopBroadcast();
    }
}



