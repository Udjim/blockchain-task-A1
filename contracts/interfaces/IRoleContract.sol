// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface IRoleContract {
    
    function getRoleNumber(address _user) external view returns (uint256);

    function getAmounts(address _user) external view returns (uint256, uint256);

}