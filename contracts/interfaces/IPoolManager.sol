// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

interface IPoolManager {
    // Views

    /**
     * @notice Returns the pool info for the given address.
     * @param _poolAddress Address of the pool.
     * @return (bool, bool, address, uint256) Whether the pool is valid, whether the pool is eligible for rewards, address of the pool's farm, and the pool's unrealized profits.
     */
    function getPoolInfo(address _poolAddress) external view returns (bool, bool, address, uint256);

    /**
     * @notice Calculates the amount of unclaimed rewards the pool has available.
     * @param _poolAddress Address of the pool.
     * @return uint256 Amount of available unclaimed rewards.
     */
    function earned(address _poolAddress) external view returns (uint256);

    /**
     * @notice Calculates the amount of rewards per "token" a pool has.
     * @dev Scaled by a factor of 1e18.
     * @dev For the PoolManager contract, one "token" represents one unit of "weight" (derived from a pool's unrealized profits and token price).
     * @return uint256 Reward per "token".
     */
    function rewardPerToken() external view returns (uint256);

    /**
     * @notice Calculates the period index corresponding to the given timestamp.
     * @param _timestamp Timestamp to calculate the period for.
     * @return uint256 Index of the period to which the timestamp belongs to.
     */
    function getPeriodIndex(uint256 _timestamp) external view returns (uint256);

    /**
     * @notice Calculates the starting timestamp of the given period.
     * @dev This function is used for time-scaling a pool's weight.
     * @param _periodIndex Index of the period.
     * @return uint256 Timestamp at which the period started.
     */
    function getStartOfPeriod(uint256 _periodIndex) external view returns (uint256);

    // Restricted

    /**
     * @notice Updates the pool's weight based on the pool's unrealized profits and change in token price from the last period.
     * @dev This function is meant to be called by a pool contract at the end of deposit(), withdraw(), and executeTransaction() functions.
     * @param _newUnrealizedProfits The new unrealized profits for the pool, after calling the parent function.
     * @param _poolTokenPrice The current price of the pool's token.
     */
    function updateWeight(uint256 _newUnrealizedProfits, uint256 _poolTokenPrice) external;

    /**
     * @notice Registers a pool in the farming system.
     * @dev This function is meant to be called by the Registry contract when creating a pool.
     * @param _poolAddress address of the pool.
     * @param _seedPrice initial price of the pool.
     */
    function registerPool(address _poolAddress, uint256 _seedPrice) external;

    /**
     * @notice Marks a pool as eligible for farming rewards, if it meets the minimum criteria.
     * @dev This function is meant to be called by a pool contract, from the pool's owner.
     * @param _totalValueLocked Current value of the pool in USD.
     * @param _numberOfInvestors Number of unique investors in the pool.
     * @return bool whether the pool was marked as eligible.
     */
    function markPoolAsEligible(uint256 _totalValueLocked, uint256 _numberOfInvestors) external returns (bool);

    /**
     * @notice Claims the pool's available rewards.
     * @dev This function is meant to be called by the pool's farm whenever a user claims their farming rewards.
     * @param _poolAddress Address of the pool.
     * @return uint256 Amount of rewards claimed.
     */
    function claimLatestRewards(address _poolAddress) external returns (uint256);
}