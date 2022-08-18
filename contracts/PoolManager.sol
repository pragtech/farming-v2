// SPDX-License-Identifier: MIT
// solhint-disable not-rely-on-time

pragma solidity ^0.8.3;

// OpenZeppelin.
import "./openzeppelin-solidity/contracts/Ownable.sol";
import "./openzeppelin-solidity/contracts/SafeMath.sol";
import "./openzeppelin-solidity/contracts/ReentrancyGuard.sol";
import "./openzeppelin-solidity/contracts/ERC20/SafeERC20.sol";

// Inheritance.
import "./interfaces/IPoolManager.sol";
import "./interfaces/IStakingRewardsFactory.sol";

// Interfaces.
import "./interfaces/IReleaseEscrow.sol";
import "./interfaces/IReleaseSchedule.sol";
import "./interfaces/IStakingRewards.sol";

// Libraries.
import "./libraries/TradegenMath.sol";

contract PoolManager is IPoolManager, ReentrancyGuard, Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    struct PoolInfo {
        bool isValid;
        bool isEligible;
        address farmAddress;
        uint256 unrealizedProfits;
        uint256 latestRecordedPrice;
        uint256 latestRecordedPeriodIndex;
        uint256 previousRecordedPrice;
        uint256 previousRecordedPeriodIndex;
        uint256 lastUpdated;
        uint256 createdOn;
    }

    struct GlobalPeriodInfo {
        uint256 totalWeight;
    }

    struct PoolPeriodInfo {
        uint256 weight;
    }

    /* ========== STATE VARIABLES ========== */

    // Configuration.
    uint32 public constant PERIOD_DURATION = 14 days;
    uint256 public constant MINIMUM_POOL_DURATION = 30 days;
    uint256 public constant MINIMUM_NUMBER_OF_INVESTORS = 10;
    uint256 public constant MINIMUM_TOTAL_VALUE_LOCKED = 10 ** 21; // $1,000

    // Contracts.
    IERC20 public rewardsToken;
    IERC20 public TGEN;
    address public xTGEN;
    IReleaseEscrow public releaseEscrow;
    IReleaseSchedule public releaseSchedule;
    IStakingRewardsFactory public immutable stakingRewardsFactory;
    address public immutable registry;

    // (pool address => pool info).
    mapping(address => PoolInfo) public pools;

    // (period index => global period info).
    mapping(uint256 => GlobalPeriodInfo) public globalPeriods;

    // (pool address => period index => pool period info).
    mapping(address => mapping(uint256 => PoolPeriodInfo)) public poolPeriods;

    // (pool address => pool's average price change).
    mapping(address => uint256) public poolAPC;

    // Sum of (pool APC * pool duration).
    uint256 public totalWeightedAPC; 

    // Sum of pool durations.
    // Used for calculating average APC
    uint256 public totalDuration; 

    uint256 public lastUpdateTime;
    uint256 public startTime;
    uint256 public rewardPerTokenStored;

    mapping(address => uint256) public poolRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    /* ========== CONSTRUCTOR ========== */

    constructor(address _rewardsToken, address _releaseSchedule, address _registry, address _stakingRewardsFactory, address _TGEN, address _xTGEN) Ownable() {
        rewardsToken = IERC20(_rewardsToken);
        releaseSchedule = IReleaseSchedule(_releaseSchedule);
        stakingRewardsFactory = IStakingRewardsFactory(_stakingRewardsFactory);
        registry = _registry;
        TGEN = IERC20(_TGEN);
        xTGEN = _xTGEN;

        startTime = block.timestamp;
        lastUpdateTime = block.timestamp;
    }

    /* ========== VIEWS ========== */

    /**
     * @notice Returns the pool info for the given address.
     * @param _poolAddress Address of the pool.
     * @return (bool, bool, address, uint256) Whether the pool is valid, whether the pool is eligible for rewards, address of the pool's farm, and the pool's unrealized profits.
     */
    function getPoolInfo(address _poolAddress) external view override returns (bool, bool, address, uint256) {
        require(_poolAddress != address(0), "PoolManager: Invalid pool address.");

        PoolInfo memory data = pools[_poolAddress];

        return (data.isValid, data.isEligible, data.farmAddress, data.unrealizedProfits);
    }

    /**
     * @notice Calculates the amount of rewards per "token" a pool has.
     * @dev Scaled by a factor of 1e18.
     * @dev For the PoolManager contract, one "token" represents one unit of "weight" (derived from a pool's unrealized profits and token price).
     * @return uint256 Reward per "token".
     */
    function rewardPerToken() public view override returns (uint256) {
        uint256 currentPeriodIndex = getPeriodIndex(block.timestamp);
        uint256 scaledWeight = TradegenMath.scaleByTime(globalPeriods[currentPeriodIndex].totalWeight,
                                    currentPeriodIndex > 0 ? globalPeriods[currentPeriodIndex.sub(1)].totalWeight : 0,
                                    block.timestamp,
                                    getStartOfPeriod(currentPeriodIndex),
                                    PERIOD_DURATION);

        // Prevent division by 0 from TradegenMath.scaleByTime() returning 0.
        if (scaledWeight == 0) {
            return rewardPerTokenStored;
        }

        return rewardPerTokenStored.add(releaseSchedule.availableRewards(lastUpdateTime).mul(1e18).div(scaledWeight));
    }

    /**
     * @notice Calculates the amount of unclaimed rewards the pool has available.
     * @param _poolAddress Address of the pool.
     * @return uint256 Amount of available unclaimed rewards.
     */
    function earned(address _poolAddress) public view override returns (uint256) {
        require(_poolAddress != address(0), "PoolManager: Invalid pool address.");

        uint256 currentPeriodIndex = getPeriodIndex(block.timestamp);

        return TradegenMath.scaleByTime(poolPeriods[_poolAddress][currentPeriodIndex].weight,
                                        currentPeriodIndex > 0 ? poolPeriods[_poolAddress][currentPeriodIndex.sub(1)].weight : 0,
                                        block.timestamp,
                                        getStartOfPeriod(currentPeriodIndex),
                                        PERIOD_DURATION)
                                    .mul(rewardPerToken().sub(poolRewardPerTokenPaid[_poolAddress])).div(1e18).add(rewards[_poolAddress]);
    }

    /**
     * @notice Calculates the period index corresponding to the given timestamp.
     * @param _timestamp Timestamp to calculate the period for.
     * @return uint256 Index of the period to which the timestamp belongs to.
     */
    function getPeriodIndex(uint256 _timestamp) public view override returns (uint256) {
        require(_timestamp >= startTime, "PoolManager: Timestamp must be greater than start time.");

        return (_timestamp.sub(startTime)).div(PERIOD_DURATION);
    }

    /**
     * @notice Calculates the starting timestamp of the given period.
     * @dev This function is used for time-scaling a pool's weight.
     * @param _periodIndex Index of the period.
     * @return uint256 Timestamp at which the period started.
     */
    function getStartOfPeriod(uint256 _periodIndex) public view override returns (uint256) {
        require(_periodIndex >= 0, "PoolManager: Period index must be positive.");

        return startTime.add(_periodIndex.mul(PERIOD_DURATION));
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    /**
     * @notice Claims the pool's available rewards.
     * @dev This function is meant to be called by the pool's farm whenever a user claims their farming rewards.
     * @param _poolAddress Address of the pool.
     * @return uint256 Amount of rewards claimed.
     */
    function claimLatestRewards(address _poolAddress) external override releaseEscrowIsSet poolIsValid(_poolAddress) updateReward(_poolAddress) returns (uint256) {
        require(msg.sender == pools[_poolAddress].farmAddress, "PoolManager: Only the StakingRewards contract can call this function.");
        require(pools[_poolAddress].isEligible, "PoolManager: Pool is not eligible.");

        uint256 reward = rewards[_poolAddress];

        _getReward(_poolAddress);

        return reward;
    }

    /**
     * @notice Updates the pool's weight based on the pool's unrealized profits and change in token price from the last period.
     * @dev This function is meant to be called by a pool contract at the end of deposit(), withdraw(), and executeTransaction() functions.
     * @param _newUnrealizedProfits The new unrealized profits for the pool, after calling the parent function.
     * @param _poolTokenPrice The current price of the pool's token.
     */
    function updateWeight(uint256 _newUnrealizedProfits, uint256 _poolTokenPrice) external override nonReentrant releaseEscrowIsSet poolIsValid(msg.sender) updateReward(msg.sender) {
        require(_newUnrealizedProfits >= 0, "PoolManager: Unrealized profits cannot be negative.");
        require(_poolTokenPrice > 0, "PoolManager: Pool token price must be greater than 0.");

        uint256 currentPeriodIndex = getPeriodIndex(block.timestamp);
        uint256 currentPoolWeight = poolPeriods[msg.sender][currentPeriodIndex].weight;

        // Update pool info
        if (currentPeriodIndex > pools[msg.sender].latestRecordedPeriodIndex) {
            pools[msg.sender].previousRecordedPrice = pools[msg.sender].latestRecordedPrice;
            pools[msg.sender].previousRecordedPeriodIndex = pools[msg.sender].latestRecordedPeriodIndex; 
        }
        
        pools[msg.sender].unrealizedProfits = _newUnrealizedProfits;
        pools[msg.sender].latestRecordedPrice = _poolTokenPrice;
        pools[msg.sender].latestRecordedPeriodIndex = currentPeriodIndex;

        if (!pools[msg.sender].isEligible) {
            pools[msg.sender].lastUpdated = block.timestamp;
            return;
        }

        totalWeightedAPC = totalWeightedAPC.sub(poolAPC[msg.sender].mul(pools[msg.sender].lastUpdated.sub(pools[msg.sender].createdOn)));
        totalDuration = totalDuration.sub(pools[msg.sender].lastUpdated.sub(pools[msg.sender].createdOn));

        poolAPC[msg.sender] = _calculateAveragePriceChange(msg.sender);
        pools[msg.sender].lastUpdated = block.timestamp;

        totalWeightedAPC = totalWeightedAPC.add(poolAPC[msg.sender].mul(block.timestamp.sub(pools[msg.sender].createdOn)));
        totalDuration = totalDuration.add(block.timestamp.sub(pools[msg.sender].createdOn));

        uint256 newPoolWeight = _calculatePoolWeight(msg.sender);

        // Update pool info for current period
        poolPeriods[msg.sender][currentPeriodIndex] = PoolPeriodInfo({
            weight: newPoolWeight
        });

        // Update global info for current period
        globalPeriods[currentPeriodIndex] = GlobalPeriodInfo({
            totalWeight: globalPeriods[currentPeriodIndex].totalWeight.sub(currentPoolWeight).add(newPoolWeight)
        });

        _getReward(msg.sender);

        emit UpdatedWeight(msg.sender, _newUnrealizedProfits, _poolTokenPrice);
    }

    /**
     * @notice Registers a pool in the farming system.
     * @dev This function is meant to be called by the Registry contract when creating a pool.
     * @param _poolAddress address of the pool.
     * @param _seedPrice initial price of the pool.
     */
    function registerPool(address _poolAddress, uint256 _seedPrice) external override {
        require(msg.sender == registry, "PoolManager: Only the Registry contract can call this function.");
        require(_poolAddress != address(0), "PoolManager: Invalid pool address.");
        require(!pools[_poolAddress].isValid, "PoolManager: Pool already exists.");
        require(_seedPrice > 0, "PoolManager: Seed price must be greater than 0.");

        address farmAddress = stakingRewardsFactory.createFarm(msg.sender);
        uint256 currentPeriodIndex = getPeriodIndex(block.timestamp);

        pools[_poolAddress] = PoolInfo({
            isValid: true,
            isEligible: false,
            farmAddress: farmAddress,
            unrealizedProfits: 0,
            latestRecordedPrice: _seedPrice,
            latestRecordedPeriodIndex: currentPeriodIndex,
            previousRecordedPrice: _seedPrice,
            previousRecordedPeriodIndex: currentPeriodIndex,
            lastUpdated: block.timestamp,
            createdOn: block.timestamp
        });

        emit RegisteredPool(_poolAddress, farmAddress, _seedPrice);
    }

    /**
     * @notice Marks a pool as eligible for farming rewards, if it meets the minimum criteria.
     * @dev This function is meant to be called by a pool contract, from the pool's owner.
     * @param _totalValueLocked Current value of the pool in USD.
     * @param _numberOfInvestors Number of unique investors in the pool.
     * @return bool whether the pool was marked as eligible.
     */
    function markPoolAsEligible(uint256 _totalValueLocked, uint256 _numberOfInvestors) external override poolIsValid(msg.sender) returns (bool) {
        require(_totalValueLocked >= 0, "PoolManager: Total value locked must be positive.");
        require(_numberOfInvestors >= 0, "PoolManager: NumberOfInvestors must be positive.");
        require(!pools[msg.sender].isEligible, "PoolManager: Already marked as eligible.");

        if (block.timestamp.sub(pools[msg.sender].createdOn) < MINIMUM_POOL_DURATION) {
            return false;
        }

        if (_totalValueLocked < MINIMUM_TOTAL_VALUE_LOCKED) {
            return false;
        }

        if (_numberOfInvestors < MINIMUM_NUMBER_OF_INVESTORS) {
            return false;
        }

        pools[msg.sender].isEligible = true;

        emit MarkedPoolAsEligible(msg.sender);

        return true;
    }

    /**
     * @notice Sets the address of the ReleaseEscrow contract.
     * @dev This function can only be called once, and must be called before users can interact with PoolManager.
     */
    function setReleaseEscrow(address _releaseEscrow) external onlyOwner releaseEscrowIsNotSet {
        require(_releaseEscrow != address(0), "PoolManager: Invalid address.");

        releaseEscrow = IReleaseEscrow(_releaseEscrow);

        emit SetReleaseEscrow(_releaseEscrow);
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    /**
     * @notice Withdraws available tokens from the ReleaseEscrow contract and transfers the pool's share of those rewards to the pool's farm.
     * @param _poolAddress Address of the pool.
     */
    function _getReward(address _poolAddress) internal {
        releaseEscrow.withdraw();

        uint256 reward = rewards[_poolAddress];
        if (reward > 0) {
            rewards[_poolAddress] = 0;
            rewardsToken.transfer(pools[_poolAddress].farmAddress, reward);
            IStakingRewards(pools[_poolAddress].farmAddress).addReward(reward);

            emit RewardPaid(_poolAddress, reward);
        }
    }

    /**
     * @notice Calculates the pool's weight.
     * @dev The weight is calculated by [unrealizedProfits * x].
     * @dev If pool's APC >= average APC, x = sqrt(pool APC - average APC).
     * @dev Else, x = log2(pool APC) / sqrt(average APC - pool APC).
     * @dev Average APC = totalWeightedAPC / totalDuration.
     * @param _poolAddress Address of the pool.
     * @return uint256 Weight of the pool.
     */
    function _calculatePoolWeight(address _poolAddress) internal view returns (uint256) {
        // Prevent division by 0.
        if (totalDuration == 0) {
            return pools[_poolAddress].unrealizedProfits.mul(TradegenMath.sqrt(poolAPC[_poolAddress]));
        }

        // Pool's average price change is above the global average price change.
        if (poolAPC[_poolAddress] >= totalWeightedAPC.div(totalDuration)) {
            return pools[_poolAddress].unrealizedProfits.mul(TradegenMath.sqrt(poolAPC[_poolAddress].add(1).sub(totalWeightedAPC.div(totalDuration))));
        }

        // Pool's average price change is below the global average price change.
        return pools[_poolAddress].unrealizedProfits.mul(TradegenMath.log(poolAPC[_poolAddress])).div(TradegenMath.sqrt((totalWeightedAPC.div(totalDuration)).sub(poolAPC[_poolAddress])));
    }

    /**
     * @notice Calculates the pool's average price change over the last 2 periods.
     * @dev Average price change is the difference between latest price and previous price, divided by the number of periods between the two prices.
     * @param _poolAddress Address of the pool.
     * @return uint256 Average price change.
     */
    function _calculateAveragePriceChange(address _poolAddress) internal view returns (uint256) {
        PoolInfo memory data = pools[_poolAddress];

        // Return early if the pool's token has declined in price.
        if (data.latestRecordedPrice <= data.previousRecordedPrice) {
            return 0;
        }

        // Prevent division by 0.
        if (data.previousRecordedPrice == 0) {
            return 0;
        }

        // Prevent division by 0 or negative values.
        if (data.previousRecordedPeriodIndex > data.latestRecordedPeriodIndex) {
            return 0;
        }

        // Average price change is scaled by 1000x to preserve fractional percent changes.
        return (data.latestRecordedPrice.sub(data.previousRecordedPrice)).mul(1e18)
                                        .div(data.previousRecordedPrice)
                                        .div((data.latestRecordedPeriodIndex == data.previousRecordedPeriodIndex)
                                                ? 1 : data.latestRecordedPeriodIndex.sub(data.previousRecordedPeriodIndex)).div(1e15);
    }

    /* ========== MODIFIERS ========== */

    modifier updateReward(address _poolAddress) {
        uint256 initialRewardPerToken = rewardPerTokenStored;
        rewardPerTokenStored = rewardPerToken();

        // Check if the total scaled weight is 0
        // If so, transfer pending rewards to xTGEN to prevent tokens from being lost.
        // Pools will not earn rewards whenever there's 0 total weight.
        if ((initialRewardPerToken == rewardPerTokenStored) && releaseEscrow.hasStarted()) {
            releaseEscrow.withdraw();
            TGEN.transfer(xTGEN, releaseSchedule.availableRewards(lastUpdateTime));                               
        }

        lastUpdateTime = block.timestamp;
        rewards[_poolAddress] = earned(_poolAddress);
        poolRewardPerTokenPaid[_poolAddress] = rewardPerTokenStored;

        _;
    }

    modifier poolIsValid(address _poolAddress) {
        require(pools[_poolAddress].isValid, "PoolManager: Only registered pools can call this function.");
        _;
    }

    modifier releaseEscrowIsSet() {
        require(address(releaseEscrow) != address(0), "PoolManager: ReleaseEscrow contract must be set before calling this function.");
        _;
    }

    modifier releaseEscrowIsNotSet() {
        require(address(releaseEscrow) == address(0), "PoolManager: ReleaseEscrow contract already set.");
        _;
    }

    /* ========== EVENTS ========== */

    event RewardPaid(address poolAddress, uint256 reward);
    event RegisteredPool(address poolAddress, address farmAddress, uint256 seedPrice);
    event MarkedPoolAsEligible(address poolAddress);
    event UpdatedWeight(address poolAddress, uint256 newUnrealizedProfits, uint256 newTokenPrice);
    event SetReleaseEscrow(address releaseEscrowAddress);
}