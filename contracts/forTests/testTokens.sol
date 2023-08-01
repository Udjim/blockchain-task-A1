// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract usd is ERC20 {
    constructor() ERC20("USD", "USD") {}

    function mint(address _to, uint256 _amount) public {
        _mint(_to, _amount);
    }
}

contract realUsd is ERC20 {
    constructor() ERC20("realUsd", "realUsd") {}

    function mint(address _to, uint256 _amount) public {
        _mint(_to, _amount);
    }

    function decimals() public view virtual override returns (uint8) {
        return 6;
    }

}

contract token is ERC20 {
    constructor() ERC20("token", "token") {}

    function mint(address _to, uint256 _amount) public {
        _mint(_to, _amount);
    }
}