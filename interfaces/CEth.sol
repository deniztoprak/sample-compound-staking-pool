// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface CEth {
    function mint() external payable;

    function redeemUnderlying(uint256) external returns (uint256);
}
