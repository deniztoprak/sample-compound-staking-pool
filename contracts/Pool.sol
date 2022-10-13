// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "../interfaces/CEth.sol";

import "hardhat/console.sol";

/**
 * @title Pool contract
 * @author Deniz Toprak
 * @notice Staking pool that rewards ETH providers with fungible tokens
 */

contract Pool is Ownable {
    // Use SafeERC20 to deal with non-reverting / non-standard ERC20 tokens
    using SafeERC20 for IERC20;
    // Use SafeCast to deal with possible overflows by calculating the reward
    using SafeCast for int256;

    // Events
    event Staked(address indexed account, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount);

    // State variables

    CEth public cEthToken;
    IERC20 public rewardToken;
    AggregatorV3Interface public priceFeed;
    uint8 public apr;

    struct Stake {
        uint256 balance;
        uint256 lastUpdate;
        uint256 dueReward;
    }

    uint256 private _totalReserve;
    mapping(address => Stake) private _stakes;

    /**
     * @dev Contracts are injected to prevent tight coupling with reward implementation
     */

    constructor(
        address payable _cEtherContract,
        address _rewardTokenContract,
        address _priceFeedContract,
        uint8 _apr
    ) {
        require(_cEtherContract != address(0), "CEth token contract address can not be zero");
        require(_rewardTokenContract != address(0), "Reward token contract address can not be zero");
        require(_priceFeedContract != address(0), "Price feed contract address can not be zero");
        require(_apr > 0 && _apr <= 100, "APR must be between 1 and 100");
        cEthToken = CEth(_cEtherContract);
        rewardToken = IERC20(_rewardTokenContract);
        priceFeed = AggregatorV3Interface(_priceFeedContract);
        apr = _apr;
    }

    // View functions

    /**
     * @notice Returns total ETH reserve of the contract
     * @dev TODO: Iterate _stakes map instead of storing the value to save more gas
     */
    function totalReserve() external view returns (uint256) {
        return _totalReserve;
    }

    /**
     * @notice Returns the balance of an account
     */
    function balanceOf(address _account) external view returns (uint256) {
        return _stakes[_account].balance;
    }

    /**
     * @notice Returns the reward of an account
     * @dev View functions don't cost gas when called externally
     */
    function rewardOf(address _account) external view returns (uint256) {
        return _stakes[_account].dueReward + calculateReward(_account);
    }

    /**
     * @notice Returns the due reward
     */
    function calculateReward(address _account) internal view returns (uint256) {
        uint256 yearlyInterest = (_stakes[_account].balance * apr) / 100;
        uint256 stakedDay = (block.timestamp - _stakes[_account].lastUpdate) / 60 / 60 / 24;

        // Calculate daily periodic interest rate (yearlyInterest / 360)
        // Assume the APR is for 360 days instead of 365
        // 360 is a highly composite number which generates more precise results
        // https://en.wikipedia.org/wiki/Highly_composite_number
        return (yearlyInterest / 360) * stakedDay;
    }

    // Mutative functions

    /**
     * @notice Change CEth token address
     */
    function setCEthToken(address payable _cEtherContract) external onlyOwner {
        cEthToken = CEth(_cEtherContract);
    }

    /**
     * @notice Change reward token address
     */
    function setRewardToken(address _rewardTokenContract) external onlyOwner {
        rewardToken = IERC20(_rewardTokenContract);
    }

    /**
     * @notice Change price feed address
     */
    function setPriceFeed(address _priceFeedContract) external onlyOwner {
        priceFeed = AggregatorV3Interface(_priceFeedContract);
    }

    /**
     * @notice Change APR
     */
    function setAPR(uint8 _apr) external onlyOwner {
        apr = _apr;
    }

    /**
     * @notice Stake given amount of liquidity
     */
    function stake() public payable {
        require(msg.value >= 5 ether, "Staking amount should be minimum 5 ETH");
        if (_stakes[msg.sender].balance != 0) {
            // If user has already staked: calculate the reward, store it in dueReward and update stake time
            // This prevents false reward calculation when users add liquidity incrementally
            _stakes[msg.sender].dueReward += calculateReward(msg.sender);
        }

        _stakes[msg.sender].balance += msg.value;
        _stakes[msg.sender].lastUpdate = block.timestamp;
        _totalReserve += msg.value;
        cEthToken.mint{ value: msg.value, gas: 250000 }();
        emit Staked(msg.sender, msg.value);
    }

    /**
     * @notice Withdraw given amount of liquidity
     */
    function withdraw(uint256 _amount) external {
        // Use checks-effects-interactions pattern to prevent re-entrancy
        // see: https://fravoll.github.io/solidity-patterns/checks_effects_interactions.html
        require(_amount > 0, "Withdraw amount can not be 0");
        require(_amount <= _stakes[msg.sender].balance, "User doesn't have enough balance");

        _stakes[msg.sender].dueReward += calculateReward(msg.sender);
        _stakes[msg.sender].balance -= _amount;
        _stakes[msg.sender].lastUpdate = block.timestamp;
        _totalReserve -= _amount;
        require(cEthToken.redeemUnderlying(_amount) == 0, "Failed to redeem assets");
        (bool success, ) = msg.sender.call{ value: _amount }("");
        require(success, "Receiver rejected ETH transfer");
        emit Withdrawn(msg.sender, _amount);
    }

    function claimReward() external {
        uint256 reward = calculateReward(msg.sender);
        require(reward > 0, "User doesn't have any reward");

        _stakes[msg.sender].dueReward = 0;
        _stakes[msg.sender].lastUpdate = block.timestamp;
        (, int256 price, , , ) = priceFeed.latestRoundData();

        rewardToken.transferFrom(owner(), msg.sender, reward * price.toUint256());
    }

    receive() external payable {
        if (msg.sender != address(cEthToken)) {
            stake();
        }
    }
}
