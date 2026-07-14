// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {OrchestraEscrow} from "../src/OrchestraEscrow.sol";

/// @notice Deploys OrchestraEscrow to X Layer mainnet (chainId 196).
/// Run with:
///   forge script script/Deploy.s.sol:Deploy \
///     --rpc-url https://rpc.xlayer.tech \
///     --private-key $DEPLOYER_PRIVATE_KEY \
///     --broadcast
contract Deploy is Script {
    function run() external returns (OrchestraEscrow escrow) {
        address treasury = vm.envAddress("ORCHESTRA_AGENTIC_WALLET");

        vm.startBroadcast();
        escrow = new OrchestraEscrow(treasury);
        vm.stopBroadcast();

        console.log("OrchestraEscrow deployed at:", address(escrow));
        console.log("Treasury (fee sink):", treasury);
    }
}
