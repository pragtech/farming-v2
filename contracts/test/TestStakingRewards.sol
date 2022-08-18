// SPDX-License-Identifier: MIT
// solhint-disable not-rely-on-time

pragma solidity ^0.8.3;

// Inheritance
import "../StakingRewards.sol";

contract TestStakingRewards is StakingRewards {

    /* ========== CONSTRUCTOR ========== */

    constructor(address _poolManager, address _rewardsToken, address _poolAddress, address _xTGEN) StakingRewards(_poolManager, _rewardsToken, _poolAddress, _xTGEN) {}

    /* ========== MUTATIVE FUNCTIONS ========== */

    /**
     * @dev Claims available rewards for the user.
     * @notice Claims pool's share of global rewards first, then claims the user's share of those rewards.
     * @notice Nearly identical to the non-test version, except this version doesn't call PoolManager.claimLatestRewards() before calling _getReward().
     * @notice PoolManager.claimLatestRewards() is simulated by calling StakingRewards.addReward() with a manual weight from the contract deloyer before this function is called.
     */
    function getRewardTest() public nonReentrant {
        _getReward();
    }

    function claimLatestRewardsTest(address _poolAddress) public {
        poolManager.claimLatestRewards(_poolAddress);
    }

    /**
     * @dev Withdraws all tokens a user has staked for each token class.
     * @notice Nearly identical to the non-test version, except this version calls the internal version of _getReward() to avoid a call to PoolManager.claimLatestRewards().
     * @notice PoolManager.claimLatestRewards() is simulated by calling StakingRewards.addReward() with a manual weight from the contract deloyer before this function is called.
     */
    function exitTest() public nonReentrant {
        stakingToken.setApprovalForAll(msg.sender, true);
        _getReward();

        for (uint i = 0; i < 4; i++)
        {
            if (balances[msg.sender][i] > 0)
            {
                _withdraw(msg.sender, balances[msg.sender][i], i + 1);
            }
        }
    }
}