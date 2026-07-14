// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {OrchestraEscrow} from "../src/OrchestraEscrow.sol";

contract OrchestraEscrowTest is Test {
    OrchestraEscrow escrow;
    address treasury = makeAddr("treasury");
    address client = makeAddr("client");
    address agent = makeAddr("agent");

    function setUp() public {
        escrow = new OrchestraEscrow(treasury);
    }

    function test_lockSettlePaysAgentAndTreasury() public {
        bytes32 id = keccak256("task-1");
        escrow.lock{value: 1 ether}(id, client, agent);

        (address c, address a, uint96 budget, OrchestraEscrow.Status status) = escrow.tasks(id);
        assertEq(c, client);
        assertEq(a, agent);
        assertEq(budget, 1 ether);
        assertEq(uint8(status), uint8(OrchestraEscrow.Status.Locked));

        uint256 agentBefore = agent.balance;
        uint256 treasuryBefore = treasury.balance;

        escrow.settle(id);

        uint256 fees = (uint256(1 ether) * 1200) / 10_000; // 10% + 2%
        uint256 payout = 1 ether - fees;

        assertEq(agent.balance - agentBefore, payout);
        assertEq(treasury.balance - treasuryBefore, fees);

        (, , , OrchestraEscrow.Status finalStatus) = escrow.tasks(id);
        assertEq(uint8(finalStatus), uint8(OrchestraEscrow.Status.Settled));
    }

    function test_refundReturnsFundsToClient() public {
        bytes32 id = keccak256("task-2");
        escrow.lock{value: 0.5 ether}(id, client, agent);

        uint256 clientBefore = client.balance;
        escrow.refund(id);
        assertEq(client.balance - clientBefore, 0.5 ether);

        (, , , OrchestraEscrow.Status finalStatus) = escrow.tasks(id);
        assertEq(uint8(finalStatus), uint8(OrchestraEscrow.Status.Refunded));
    }

    function test_cannotSettleTwice() public {
        bytes32 id = keccak256("task-3");
        escrow.lock{value: 1 ether}(id, client, agent);
        escrow.settle(id);

        vm.expectRevert(OrchestraEscrow.TaskClosed.selector);
        escrow.settle(id);
    }

    function test_cannotLockZeroBudget() public {
        bytes32 id = keccak256("task-4");
        vm.expectRevert(OrchestraEscrow.ZeroBudget.selector);
        escrow.lock{value: 0}(id, client, agent);
    }

    function test_cannotLockDuplicateId() public {
        bytes32 id = keccak256("task-5");
        escrow.lock{value: 1 ether}(id, client, agent);

        vm.expectRevert(OrchestraEscrow.TaskExists.selector);
        escrow.lock{value: 1 ether}(id, client, agent);
    }

    function test_onlyMasterCanLock() public {
        bytes32 id = keccak256("task-6");
        address badActor = makeAddr("bad-actor");
        vm.deal(badActor, 1 ether);

        vm.prank(badActor);
        (bool ok, bytes memory data) = address(escrow).call{value: 1 ether}(
            abi.encodeWithSelector(escrow.lock.selector, id, client, agent)
        );
        assertFalse(ok);
        assertEq(bytes4(data), OrchestraEscrow.NotMaster.selector);
    }
}
