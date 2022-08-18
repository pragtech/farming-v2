// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

interface IStakingRewards {
    // Views

    /**
     * @notice Calculates the amount of unclaimed rewards the user has available.
     * @param _account Address of the user.
     * @return uint256 amount of available unclaimed rewards.
     */
    function earned(address _account) external view returns (uint256);

    /**
     * @notice Returns the total number of tokens staked in the farm.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @notice Returns the number of tokens a user has staked for the given token class.
     * @param _account Address of the user.
     * @param _tokenClass Class of the token (in range [1, 4] depending on the token's scarcity).
     * @return uint256 Amount of tokens staked for the given class.
     */
    function balanceOf(address _account, uint256 _tokenClass) external view returns (uint256);

    // Mutative

    /**
     * @notice Stakes tokens of the given class in the farm.
     * @param _amount number of tokens to stake.
     * @param _tokenClass class of the token (in range [1, 4] depending on the token's scarcity).
     */
    function stake(uint256 _amount, uint256 _tokenClass) external;

    /**
     * @notice Withdraws tokens of the given class from the farm.
     * @param _amount Number of tokens to stake.
     * @param _tokenClass Class of the token (in range [1, 4] depending on the token's scarcity).
     */
    function withdraw(uint256 _amount, uint256 _tokenClass) external;

     /**
     * @notice Claims available rewards for the user.
     * @dev Claims pool's share of global rewards first, then claims the user's share of those rewards.
     */
    function getReward() external;

    /**
     * @notice Withdraws all tokens a user has staked for each token class.
     */
    function exit() external;

    // Restricted

    /**
     * @notice Updates the available rewards for the pool, based on the pool's share of global rewards.
     * @dev This function is meant to be called by the PoolManager contract.
     * @param _reward number of tokens to add to the pool.
     */
    function addReward(uint256 _reward) external;
}