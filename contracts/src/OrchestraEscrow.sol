// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title OrchestraEscrow — per-DAG-task micro-escrow (X Layer mainnet, self-funded mirror)
/// @notice Unaudited. Holds ONLY Orchestra's own treasury micro-funds (cap ~0.1 USD/task).
/// @notice Customer funds NEVER enter this contract pre-audit; they settle on OKX rails.
contract OrchestraEscrow {
    error NotMaster(); error TaskExists(); error TaskClosed(); error ZeroBudget(); error PayFailed();

    address public immutable master;     // Orchestra's verified agent wallet
    address public immutable treasury;   // fee sink
    uint16  public constant GC_FEE_BPS = 1000; // 10%
    uint16  public constant ROUTE_FEE_BPS = 200; // 2%

    enum Status { None, Locked, Settled, Refunded }
    struct T { address client; address agent; uint96 budget; Status status; }
    mapping(bytes32 => T) public tasks;

    event Locked(bytes32 indexed id, address indexed agent, uint96 budget);
    event Settled(bytes32 indexed id, address indexed agent, uint96 payout, uint96 fees);
    event Refunded(bytes32 indexed id, address indexed client, uint96 amount);

    modifier onlyMaster() { if (msg.sender != master) revert NotMaster(); _; }

    constructor(address _treasury) { master = msg.sender; treasury = _treasury; }

    function lock(bytes32 id, address client, address agent) external payable onlyMaster {
        if (msg.value == 0) revert ZeroBudget();
        if (tasks[id].status != Status.None) revert TaskExists();
        tasks[id] = T(client, agent, uint96(msg.value), Status.Locked);
        emit Locked(id, agent, uint96(msg.value));
    }

    function settle(bytes32 id) external onlyMaster {
        T storage t = tasks[id];
        if (t.status != Status.Locked) revert TaskClosed();
        t.status = Status.Settled;                              // effects before interactions
        uint96 fees = uint96((uint256(t.budget) * (GC_FEE_BPS + ROUTE_FEE_BPS)) / 10_000);
        uint96 payout = t.budget - fees;
        (bool a,) = t.agent.call{value: payout}("");            // call, not transfer
        (bool b,) = treasury.call{value: fees}("");
        if (!a || !b) revert PayFailed();
        emit Settled(id, t.agent, payout, fees);
    }

    function refund(bytes32 id) external onlyMaster {
        T storage t = tasks[id];
        if (t.status != Status.Locked) revert TaskClosed();
        t.status = Status.Refunded;
        (bool ok,) = t.client.call{value: t.budget}("");
        if (!ok) revert PayFailed();
        emit Refunded(id, t.client, t.budget);
    }
}
