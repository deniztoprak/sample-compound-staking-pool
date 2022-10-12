// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "hardhat/console.sol";

/**
 * @title Pool contract
 * @author Deniz Toprak
 * @notice Staking pool that rewards ETH providers with fungible tokens
 */

contract Pool {
    // Use SafeERC20 to deal with non-reverting / non-standard ERC20 tokens
    using SafeERC20 for IERC20;

    // Events
    event Staked(address indexed account, uint256 amount);

    // State variables

    IERC20 public rewardToken;
    uint8 public apr;

    struct Stake {
        uint256 balance;
        uint256 lastStakeTime;
        uint256 dueReward;
    }

    uint256 private _totalSupply;
    mapping(address => Stake) private _stakes;

    /**
     * @dev Reward token address is injected in constuctor to prevent tight coupling with reward implementation
     * (provides modularity and saves gas)
     */

    constructor(address _rewardToken, uint8 _apr) {
        require(_rewardToken != address(0), "Reward token address can not be zero");
        require(_apr > 0 && _apr <= 100, "APR must be between 1 and 100");
        rewardToken = IERC20(_rewardToken);
        apr = _apr;
    }

    // View functions

    /**
     * @notice Returns total liquidity supply of the contract
     */
    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    /**
     * @notice Returns the balance of an account
     */
    function balanceOf(address account) external view returns (uint256) {
        return _stakes[account].balance;
    }

    /**
     * @notice Returns the reward of an account
     * @dev View functions don't cost gas when called externally
     */
    function rewardOf(address account) external view returns (uint256) {
        return _stakes[account].dueReward + calculateReward(account);
    }

    /**
     * @notice Returns the due reward
     */
    function calculateReward(address account) internal view returns (uint256) {
        uint256 yearlyInterest = (_stakes[account].balance * apr) / 100;
        uint256 stakedDay = (block.timestamp - _stakes[account].lastStakeTime) / 60 / 60 / 24;
        // console.log("Balance", _stakes[account].balance);
        // console.log("Yearly interest", yearlyInterest);
        // console.log("Last stake time", _stakes[account].lastStakeTime);
        // console.log("Block time", block.timestamp);
        // console.log("Time diff", block.timestamp - _stakes[account].lastStakeTime);
        // console.log("Staked Day", stakedDay);
        // console.log("Reward", (yearlyInterest / 360) * stakedDay);

        // Assume the APR is for 360 days instead of 365
        // 360 is a highly composite number which leads to more precise results
        // https://en.wikipedia.org/wiki/Highly_composite_number
        return (yearlyInterest / 360) * stakedDay;
    }

    // Mutative functions

    /**
     * @notice Stake given amount of liquidity
     */
    function stake() external payable {
        require(msg.value >= 5 ether, "Staking amount should be minimum 5 ETH");
        if (_stakes[msg.sender].balance != 0) {
            // If user has already staked: calculate the reward, store it in dueReward and restart stake time
            // This prevents false reward calculation when user adds liquidity incrementally
            _stakes[msg.sender].dueReward = calculateReward(msg.sender);
        }

        _stakes[msg.sender].balance += msg.value;
        _stakes[msg.sender].lastStakeTime = block.timestamp;
        _totalSupply += msg.value;
        emit Staked(msg.sender, msg.value);
    }
}
