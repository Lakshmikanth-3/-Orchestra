// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {OrchestraEscrow} from "../src/OrchestraEscrow.sol";

/// @notice Deploys OrchestraEscrow to X Layer mainnet (chainId 196).
///
/// Deploy only:
///   forge script script/Deploy.s.sol:Deploy \
///     --rpc-url https://rpc.xlayer.tech \
///     --private-key $DEPLOYER_PRIVATE_KEY \
///     --broadcast
///
/// Deploy + verify on OKLink in one step (real, confirmed against the
/// installed Foundry version — `oklink` is a built-in --verifier choice):
///   forge script script/Deploy.s.sol:Deploy \
///     --rpc-url https://rpc.xlayer.tech \
///     --private-key $DEPLOYER_PRIVATE_KEY \
///     --broadcast --verify \
///     --verifier oklink \
///     --verifier-url https://www.oklink.com/api/v5/explorer/contract/verify-source-code-plugin/XLAYER \
///     --verifier-api-key $OKLINK_API_KEY
///
/// OKLINK_API_KEY: apply at https://www.oklink.com/docs/en/#quickstart-guide-getting-started
///
/// To verify an already-deployed contract separately:
///   forge verify-contract <address> src/OrchestraEscrow.sol:OrchestraEscrow \
///     --verifier oklink \
///     --verifier-url https://www.oklink.com/api/v5/explorer/contract/verify-source-code-plugin/XLAYER \
///     --verifier-api-key $OKLINK_API_KEY \
///     --constructor-args $(cast abi-encode "constructor(address)" $ORCHESTRA_AGENTIC_WALLET)
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
