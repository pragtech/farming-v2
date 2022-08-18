// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

//Libraries
import "../libraries/TradegenMath.sol";

contract TestLibrary {
    constructor() {}

    function scaleByTime(uint256 currentValue, uint256 previousValue, uint256 currentTimestamp, uint256 startTimestamp, uint256 duration) external pure returns (uint256) {
        return TradegenMath.scaleByTime(currentValue, previousValue, currentTimestamp, startTimestamp, duration);
    }

    function log(uint256 x) external pure returns (uint256) {
        return TradegenMath.log(x);
    }

}