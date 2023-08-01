// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// Represents simple token ERC20
contract Token is ERC20, Ownable {
    uint8 private _decimals;

    constructor(
        string memory name, 
        string memory symbol,
        uint8 underlyingDecimals
    ) ERC20(name, symbol) {
        _decimals = underlyingDecimals;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}
