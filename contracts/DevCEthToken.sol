//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "../interfaces/CEth.sol";

/**
 * @title devCEth Token Contract
 * @author Deniz Toprak
 * @notice A dummy cEth token
 */
contract DevCEthToken is CEth {
    function mint() external payable {}

    function redeemUnderlying(uint256 redeemAmount) external returns (uint256) {
        (bool success, ) = msg.sender.call{ value: redeemAmount }("");

        return success ? 0 : 1;
    }
}
