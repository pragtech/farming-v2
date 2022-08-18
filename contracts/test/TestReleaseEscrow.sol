// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import "../openzeppelin-solidity/contracts/ERC20/SafeERC20.sol";
import "../openzeppelin-solidity/contracts/SafeMath.sol";
import "../openzeppelin-solidity/contracts/ReentrancyGuard.sol";

import "../interfaces/IReleaseSchedule.sol";
import "../interfaces/IReleaseEscrow.sol";

/**
 * Escrow to release tokens according to a schedule.
 */
contract TestReleaseEscrow is ReentrancyGuard, IReleaseEscrow {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    /* ========== STATE VARIABLES ========== */

    // When the release starts.
    uint256 public immutable startTime;

    // Reward token contract address.
    IERC20 public immutable rewardToken;

    // Where the funds go to.
    address public immutable beneficiary;

    // Schedule for release of tokens.
    IReleaseSchedule public immutable schedule;

    // Timestamp of the last withdrawal.
    uint256 public lastWithdrawalTime;

    // Total number of tokens that will be distributed.
    uint256 public override lifetimeRewards;

    // Number of tokens that have been claimed.
    uint256 public override distributedRewards;

    /* ========== CONSTRUCTOR ========== */

    /**
     * @notice Release Schedule must have the same start time. 
     */
    constructor(address beneficiary_, address rewardToken_, address schedule_, uint256 startTime_) {
        beneficiary = beneficiary_;
        rewardToken = IERC20(rewardToken_);
        schedule = IReleaseSchedule(schedule_);
        startTime = startTime_;
        lastWithdrawalTime = IReleaseSchedule(schedule_).getStartOfCycle(1);
        lifetimeRewards = IReleaseSchedule(schedule_).getTokensForCycle(1).mul(2);
    }

    /* ========== VIEWS ========== */

    /**
     * Returns true if release has already started.
     */
    function hasStarted() public view override returns (bool) {
        return startTime < block.timestamp;
    }

    /**
     * Returns the number of tokens left to distribute.
     */
    function remainingRewards() external view override returns (uint256) {
        return rewardToken.balanceOf(address(this));
    }

    /**
     * Returns the number of tokens that have vested based on a schedule.
     */
    function releasedRewards() public view override returns (uint256) {
        return lifetimeRewards.sub(rewardToken.balanceOf(address(this)));
    }

    /**
     * Returns the number of vested tokens that have not been claimed yet.
     */
    function unclaimedRewards() external view override returns (uint256) {
        return releasedRewards().sub(distributedRewards);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function setLastWithdrawalTime(uint lastWithdrawalTime_) external {
        lastWithdrawalTime = lastWithdrawalTime_;
    }

    /**
     * Withdraws tokens based on the current reward rate and the time since last withdrawal.
     *
     * @notice The tokens received represent rewards earned across all pools. The PoolManager contract handles the logic
     *          for partitioning rewards based on a specific pool's weight.
     * @notice This function is called by the PoolManager contract whenever a user claims rewards for a specific pool.
     */
    function withdraw() external override onlyBeneficiary nonReentrant {
        uint256 startOfCycle = schedule.getStartOfCurrentCycle();
        uint256 availableTokens = 0;

        // Return early if rewards have not started yet.
        if (!hasStarted()) {
            return;
        }

        // Check for cross-cycle rewards
        if (lastWithdrawalTime < startOfCycle) {
            availableTokens = (startOfCycle.sub(lastWithdrawalTime)).mul(schedule.getCurrentRewardRate().mul(2));
            availableTokens = availableTokens.add((block.timestamp.sub(startOfCycle)).mul(schedule.getCurrentRewardRate()));
        }
        else {
            availableTokens = (block.timestamp.sub(lastWithdrawalTime)).mul(schedule.getCurrentRewardRate());
        }
        
        lastWithdrawalTime = block.timestamp;
        distributedRewards = distributedRewards.add(availableTokens);
        rewardToken.safeTransfer(beneficiary, availableTokens);
    }

    /* ========== MODIFIERS ========== */

    modifier started {
        require(hasStarted(), "ReleaseEscrow: release has not started yet");
        _;
    }

    modifier onlyBeneficiary {
        require(msg.sender == beneficiary, "ReleaseEscrow: only the beneficiary can call this function");
        _;
    }
}