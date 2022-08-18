// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

/**
 * A token release schedule that lasts indefinitely.
 */
interface IReleaseSchedule {
    /**
     * @notice Returns the total number of tokens that will be released in the given cycle.
     * @param _cycleIndex Index of the cycle to check.
     * @return uint256 Total number of tokens released during the given cycle.
     */
    function getTokensForCycle(uint256 _cycleIndex) external view returns (uint256);

    /**
     * @notice Returns the index of the current cycle.
     * @return uint256 Index of the current cycle.
     */
    function getCurrentCycle() external view returns (uint256);

    /**
     * @notice Returns the duration of each cycle.
     * @return uint256 Duration of each cycle (in seconds).
     */
    function cycleDuration() external view returns (uint256);

    /**
     * @notice Returns the starting timestamp of the given cycle.
     * @param _cycleIndex Index of the cycle to check.
     * @return uint256 Starting timestamp of the cycle.
     */
    function getStartOfCycle(uint256 _cycleIndex) external view returns (uint256);

    /**
     * @notice Given the index of a cycle, returns the number of tokens unlocked per second during the cycle.
     * @param _cycleIndex Index of the cycle to check.
     * @return uint256 Number of tokens per second.
     */
    function getRewardRate(uint256 _cycleIndex) external view returns (uint256);

    /**
     * @notice Returns the number of tokens unlocked per second in the current cycle.
     * @return uint256 Number of tokens per second.
     */
    function getCurrentRewardRate() external view returns (uint256);

    /**
     * @notice Returns the starting timestamp of the current cycle.
     * @return uint256 Starting timestamp.
     */
    function getStartOfCurrentCycle() external view returns (uint256);

    /**
     * @notice Returns the amount of rewards available, based on the given timestamp.
     * @param _lastClaimTime The timestamp of last rewards claim; used for calculating elapsed time.
     * @return uint256 Number of tokens available.
     */
    function availableRewards(uint256 _lastClaimTime) external view returns (uint256);
}
