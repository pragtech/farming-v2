// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;

/**
 * @title A library for mathematical calculations.
 */
library TradegenMath {
    /**
    * @dev Scales a value based on the ratio of time elapsed to period duration.
    * @dev scalar = (currentTimestamp - startTimestamp) / duration
    * @dev x = (currentValue * scalar) + (previousValue * (1 - scalar))
    * @param currentValue value of a metric for the current period.
    * @param previousValue value of a metric for the previous period.
    * @param currentTimestamp the current timestamp; most likely "block.timestamp".
    * @param startTimestamp the timestamp at the start of the current period.
    * @param duration length of the period.
    * @return time-scaled value.
    */
    function scaleByTime(uint256 currentValue, uint256 previousValue, uint256 currentTimestamp, uint256 startTimestamp, uint256 duration) internal pure returns (uint256) {
        // Prevent division by 0
        if (duration == 0) {
            return 0;
        }

        // Prevent underflow
        if (startTimestamp > currentTimestamp) {
            return 0;
        }

        // Prevent underflow
        if (duration + startTimestamp < currentTimestamp) {
            return 0;
        }

        return ((currentValue * (currentTimestamp - startTimestamp)) + (previousValue * (duration + startTimestamp - currentTimestamp))) / duration;
    }

    /**
    * @dev Calculate log2(x) rounding down, where x is unsigned 256-bit integer number.
    * @param x unsigned 256-bit integer number.
    * @return result log2(x) unsigned 256-bit integer number.
    */
    function log(uint256 x) internal pure returns (uint256 result) {
        result = 0;

        while (x > 1) {
            if (x >= 2**128) { x >>= 128; result += 128; }
            if (x >= 2**64) { x >>= 64; result += 64; }
            if (x >= 2**32) { x >>= 32; result += 32; }
            if (x >= 2**16) { x >>= 16; result += 16; }
            if (x >= 2**8) { x >>= 8; result += 8; }
            if (x >= 2**4) { x >>= 4; result += 4; }
            if (x >= 2**2) { x >>= 2; result += 2; }
            if (x >= 2**1) { x >>= 1; result += 1; }
        }

        return result;
    }

    /**
    * @notice credit for this implementation goes to https://github.com/abdk-consulting/abdk-libraries-solidity/blob/master/ABDKMath64x64.sol.
    * @dev Calculate sqrt (x) rounding down, where x is unsigned 256-bit integer number.
    * @param x unsigned 256-bit integer number.
    * @return sqrt(`x`) unsigned 128-bit integer number.
    */
    function sqrt(uint256 x) internal pure returns (uint128) {
        if (x == 0) return 0;
        else {
            uint256 xx = x;
            uint256 r = 1;
            if (xx >= 0x100000000000000000000000000000000) {
                xx >>= 128;
                r <<= 64;
            }
            if (xx >= 0x10000000000000000) {
                xx >>= 64;
                r <<= 32;
            }
            if (xx >= 0x100000000) {
                xx >>= 32;
                r <<= 16;
            }
            if (xx >= 0x10000) {
                xx >>= 16;
                r <<= 8;
            }
            if (xx >= 0x100) {
                xx >>= 8;
                r <<= 4;
            }
            if (xx >= 0x10) {
                xx >>= 4;
                r <<= 2;
            }
            if (xx >= 0x8) {
                r <<= 1;
            }
            r = (r + x / r) >> 1;
            r = (r + x / r) >> 1;
            r = (r + x / r) >> 1;
            r = (r + x / r) >> 1;
            r = (r + x / r) >> 1;
            r = (r + x / r) >> 1;
            r = (r + x / r) >> 1; // Seven iterations should be enough
            uint256 r1 = x / r;
            return uint128(r < r1 ? r : r1);
        }
    }
}