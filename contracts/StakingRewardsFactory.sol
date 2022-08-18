// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

// OpenZeppelin.
import "./openzeppelin-solidity/contracts/Ownable.sol";

// Internal references.
import './StakingRewards.sol';

// Inheritance.
import './interfaces/IStakingRewardsFactory.sol';

contract StakingRewardsFactory is IStakingRewardsFactory, Ownable {

    address public poolManager;
    address public rewardToken;
    address public stakingTGEN;

    constructor(address _rewardToken, address _xTGEN) Ownable() {
        rewardToken = _rewardToken;
        stakingTGEN = _xTGEN;
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    /**
     * @notice Creates a farm for the given pool.
     * @dev This function can only be called by the PoolManager contract.
     * @param _poolAddress address of the pool.
     * @return (uint256) address of the newly created farm.
     */
    function createFarm(address _poolAddress) external override poolManagerIsSet onlyPoolManager returns (address) {
        require(_poolAddress != address(0), "StakingRewardsFactory: Invalid address.");
        
        // Create farm.
        address farmAddress = address(new StakingRewards(poolManager, rewardToken, _poolAddress, stakingTGEN));

        emit CreatedFarm(_poolAddress, farmAddress);

        return farmAddress;
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    /**
     * @notice Sets the address of the PoolManager contract.
     * @dev This function can only be called once, and must be called before a farm can be created.
     */
    function setPoolManager(address _poolManager) external onlyOwner poolManagerIsNotSet {
        require(_poolManager != address(0), "StakingRewardsFactory: Invalid address.");

        poolManager = _poolManager;

        emit SetPoolManager(_poolManager);
    }

    /* ========== MODIFIERS ========== */

    modifier onlyPoolManager() {
        require(msg.sender == poolManager, "StakingRewardsFactory: Only the PoolManager contract can call this function.");
        _;
    }

    modifier poolManagerIsSet() {
        require(address(poolManager) != address(0), "StakingRewardsFactory: PoolManager contract must be set before calling this function.");
        _;
    }

    modifier poolManagerIsNotSet() {
        require(address(poolManager) == address(0), "StakingRewardsFactory: PoolManager contract already set.");
        _;
    }

    /* ========== EVENTS ========== */

    event SetPoolManager(address poolManager);
    event CreatedFarm(address poolAddress, address farmAddress);
}