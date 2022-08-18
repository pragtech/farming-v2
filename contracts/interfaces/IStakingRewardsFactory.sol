// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

interface IStakingRewardsFactory {
    /**
     * @notice Creates a farm for the given pool.
     * @dev This function can only be called by the PoolManager contract.
     * @param _poolAddress address of the pool.
     * @return (uint256) address of the newly created farm.
     */
    function createFarm(address _poolAddress) external returns (address);
}
