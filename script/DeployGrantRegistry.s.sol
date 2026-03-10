// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {GrantRegistry} from "../src/GrantRegistry.sol";

contract DeployGrantRegistry is Script {
    function run() external {
        address oracleWallet = vm.envAddress("ORACLE_WALLET_ADDRESS");
        
        vm.startBroadcast();
        new GrantRegistry(oracleWallet);
        vm.stopBroadcast();
    }
}