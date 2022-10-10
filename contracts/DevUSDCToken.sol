//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title devUSDC Token Contract
 * @author Deniz Toprak
 * @notice A custom ERC20 stablecoin
 */
contract DevUSDCToken is ERC20 {
    /**
     * @dev Initializes the contract by minting the initial supply.
     */
    constructor(uint256 initialSupply) ERC20("devUSDCToken", "USDC") {
        _mint(msg.sender, initialSupply);
    }
}
