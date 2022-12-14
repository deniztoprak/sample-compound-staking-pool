//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "../interfaces/CEth.sol";

/**
 * @title Price Aggregator Contract
 * @author Deniz Toprak
 * @notice A dummy price aggregator
 */
contract DevPriceAggregator is AggregatorV3Interface {
    function decimals() external view returns (uint8) {}

    function description() external view returns (string memory) {}

    function version() external view returns (uint256) {}

    function getRoundData(uint80 _roundId)
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {}

    function latestRoundData()
        external
        pure
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (0, 2, 0, 0, 0);
    }
}
