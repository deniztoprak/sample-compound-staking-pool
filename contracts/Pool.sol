// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// import "hardhat/console.sol";

/**
 * @title Pool contract
 * @author Deniz Toprak
 * @notice Staking pool that rewards ETH providers with fungible tokens
 */

contract Pool {
    // Use SafeERC20 to deal with non-reverting / non-standard ERC20 tokens
    using SafeERC20 for IERC20;

    IERC20 public rewardToken;
    uint8 public apr;

    constructor(address _rewardToken, uint8 _apr) {
        require(_rewardToken != address(0), "Reward token address can not be zero");
        require(_apr > 0 && _apr <= 100, "APR must be between 1 and 100");
        rewardToken = IERC20(_rewardToken);
        apr = _apr;
    }

    function createPool() public {}
}
