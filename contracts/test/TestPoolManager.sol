// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

//Libraries
import "../PoolManager.sol";

contract TestPoolManager is PoolManager {
    constructor(address _rewardsToken, address _releaseSchedule, address _poolFactory, address _stakingRewardsFactory, address _TGEN, address _xTGEN)
        PoolManager(_rewardsToken, _releaseSchedule, _poolFactory, _stakingRewardsFactory, _TGEN, _xTGEN) {}

    function calculatePoolWeight(address _poolAddress) external view returns(uint256) {
        return _calculatePoolWeight(_poolAddress);
    }

    function calculateAveragePriceChange(address _poolAddress) external view returns(uint256) {
        return _calculateAveragePriceChange(_poolAddress);
    }

    function setStartTime(uint _startTime) external {
        startTime = _startTime;
    }

    function setLastUpdateTime(uint _lastUpdateTime) external {
        lastUpdateTime = _lastUpdateTime;
    }

    function getCurrentTime() external view returns(uint256) {
        return block.timestamp;
    }

    function setGlobalAPCVariables(uint256 _totalWeightedAPC, uint256 _totalDuration) external {
        totalWeightedAPC = _totalWeightedAPC;
        totalDuration = _totalDuration;
    }

    function setPoolAPC(address _poolAddress, uint256 _APC) external {
        poolAPC[_poolAddress] = _APC;
    }

    function setPoolInfo(address _poolAddress, bool _isValid, bool _isEligible, address _farmAddress, uint256 _unrealizedProfits, uint256 _latestRecordedPrice, uint256 _latestRecordedPeriodIndex, uint256 _previousRecordedPrice, uint256 _previousRecordedPeriodIndex, uint256 _lastUpdated, uint256 _createdOn) external {
        pools[_poolAddress] = PoolInfo({
            isValid: _isValid,
            isEligible: _isEligible,
            farmAddress: _farmAddress,
            unrealizedProfits: _unrealizedProfits,
            latestRecordedPrice: _latestRecordedPrice,
            latestRecordedPeriodIndex: _latestRecordedPeriodIndex,
            previousRecordedPrice: _previousRecordedPrice,
            previousRecordedPeriodIndex: _previousRecordedPeriodIndex,
            lastUpdated: _lastUpdated,
            createdOn: _createdOn
        });
    }

    function setGlobalPeriodInfo(uint256 _periodIndex, uint256 _totalWeight) external {
        globalPeriods[_periodIndex] = GlobalPeriodInfo({
            totalWeight: _totalWeight
        });
    }

    function setPoolPeriodInfo(address _poolAddress, uint256 _periodIndex, uint256 _weight) external {
        poolPeriods[_poolAddress][_periodIndex] = PoolPeriodInfo({
            weight: _weight
        });
    }
}