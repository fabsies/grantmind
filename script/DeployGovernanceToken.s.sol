// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {GovernanceToken} from "../src/GovernanceToken.sol";

contract DeployGovernanceToken is Script {
    function run() external {
        vm.startBroadcast();
        new GovernanceToken();
        vm.stopBroadcast();
    }
}