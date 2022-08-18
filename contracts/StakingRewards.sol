// SPDX-License-Identifier: MIT
// solhint-disable not-rely-on-time

pragma solidity ^0.8.3;

// OpenZeppelin.
import "./openzeppelin-solidity/contracts/Math.sol";
import "./openzeppelin-solidity/contracts/SafeMath.sol";
import "./openzeppelin-solidity/contracts/ReentrancyGuard.sol";
import "./openzeppelin-solidity/contracts/ERC20/SafeERC20.sol";
import "./openzeppelin-solidity/contracts/ERC1155/IERC1155.sol";
import "./openzeppelin-solidity/contracts/ERC1155/ERC1155Holder.sol";

// Inheritance/
import "./interfaces/IStakingRewards.sol";

// Interfaces/
import "./interfaces/IPoolManager.sol";

contract StakingRewards is IStakingRewards, ReentrancyGuard, ERC1155Holder {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    /* ========== STATE VARIABLES ========== */

    IERC20 public rewardsToken;
    IERC1155 public stakingToken;
    IPoolManager public poolManager;
    address public poolAddress;
    address public xTGEN;

    uint256 public totalAvailableRewards;
    uint256 public rewardPerTokenStored;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    uint256 public override totalSupply;
    uint256 public weightedTotalSupply;
    mapping(address => uint256[4]) public balances;
    mapping(address => uint256) public weightedBalance;

    // Weights per token class.
    uint256[4] public WEIGHTS = [65, 20, 10, 5];

    /* ========== CONSTRUCTOR ========== */

    constructor(address _poolManager, address _rewardsToken, address _poolAddress, address _xTGEN) {
        rewardsToken = IERC20(_rewardsToken);
        stakingToken = IERC1155(_poolAddress);
        poolManager = IPoolManager(_poolManager);
        poolAddress = _poolAddress;
        xTGEN = _xTGEN;
    }

    /* ========== VIEWS ========== */

    /**
     * @notice Returns the number of tokens a user has staked for the given token class.
     * @param _account Address of the user.
     * @param _tokenClass Class of the token (in range [1, 4] depending on the token's scarcity).
     * @return uint256 Amount of tokens staked for the given class.
     */
    function balanceOf(address _account, uint256 _tokenClass) external view override returns (uint256) {
        require(_tokenClass > 0 && _tokenClass < 5, "StakingRewards: Token class must be between 1 and 4.");

        return balances[_account][_tokenClass.sub(1)];
    }

    /**
     * @notice Calculates the amount of unclaimed rewards the user has available.
     * @param _account Address of the user.
     * @return uint256 amount of available unclaimed rewards.
     */
    function earned(address _account) public view override returns (uint256) {
        return weightedBalance[_account].mul(rewardPerTokenStored.sub(userRewardPerTokenPaid[_account])).add(rewards[_account]);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    /**
     * @notice Stakes tokens of the given class in the farm.
     * @param _amount number of tokens to stake.
     * @param _tokenClass class of the token (in range [1, 4] depending on the token's scarcity).
     */
    function stake(uint256 _amount, uint256 _tokenClass) external override nonReentrant updateReward(msg.sender) {
        require(_amount > 0, "StakingRewards: Amount must be positive.");
        require(_tokenClass > 0 && _tokenClass < 5, "StakingRewards: Token class must be between 1 and 4.");
        require(stakingToken.balanceOf(msg.sender, _tokenClass) >= _amount, "StakingRewards: Not enough tokens.");

        uint256 weightedAmount = _amount.mul(WEIGHTS[_tokenClass.sub(1)]);
        totalSupply = totalSupply.add(_amount);
        weightedTotalSupply = weightedTotalSupply.add(weightedAmount);
        weightedBalance[msg.sender] = weightedBalance[msg.sender].add(weightedAmount);
        balances[msg.sender][_tokenClass.sub(1)] = balances[msg.sender][_tokenClass.sub(1)].add(_amount);

        stakingToken.safeTransferFrom(msg.sender, address(this), _tokenClass, _amount, "0x0");

        emit Staked(msg.sender, _tokenClass, _amount);
    }

    /**
     * @notice Withdraws tokens of the given class from the farm.
     * @param _amount Number of tokens to stake.
     * @param _tokenClass Class of the token (in range [1, 4] depending on the token's scarcity).
     */
    function withdraw(uint256 _amount, uint256 _tokenClass) public override nonReentrant updateReward(msg.sender) {
        require(_amount > 0, "StakingRewards: Amount must be positive.");
        require(_tokenClass > 0 && _tokenClass < 5, "StakingRewards: Token class must be between 1 and 4.");

        stakingToken.setApprovalForAll(msg.sender, true);
        _withdraw(msg.sender, _amount, _tokenClass);
    }

    /**
     * @notice Claims available rewards for the user.
     * @dev Claims pool's share of global rewards first, then claims the user's share of those rewards.
     */
    function getReward() public override nonReentrant {
        poolManager.claimLatestRewards(poolAddress);
        _getReward();
    }

    /**
     * @notice Withdraws all tokens a user has staked for each token class.
     */
    function exit() external override {
        stakingToken.setApprovalForAll(msg.sender, true);
        getReward();

        for (uint256 i = 0; i < 4; i++) {
            if (balances[msg.sender][i] > 0) {
                _withdraw(msg.sender, balances[msg.sender][i], i.add(1));
            }
        }
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    /**
     * @notice Claims available rewards for the user.
     */
    function _getReward() internal updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];

        if (reward > 0) {
            rewards[msg.sender] = 0;
            rewardsToken.safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    /**
     * @notice Withdraws tokens of the given class from the user.
     * @param _user Address of the user withdrawing tokens.
     * @param _amount Number of tokens to withdraw.
     * @param _tokenClass Class of the token [1-4].
     */
    function _withdraw(address _user, uint256 _amount, uint256 _tokenClass) internal {
        uint256 weightedAmount = _amount.mul(WEIGHTS[_tokenClass.sub(1)]);
        totalSupply = totalSupply.sub(_amount);
        weightedTotalSupply = weightedTotalSupply.sub(weightedAmount);
        weightedBalance[_user] = weightedBalance[_user].sub(weightedAmount);
        balances[_user][_tokenClass.sub(1)] = balances[_user][_tokenClass.sub(1)].sub(_amount);

        stakingToken.safeTransferFrom(address(this), _user, _tokenClass, _amount, "0x0");

        emit Withdrawn(_user, _tokenClass, _amount);
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    /**
     * @notice Updates the available rewards for the pool, based on the pool's share of global rewards.
     * @dev This function is meant to be called by the PoolManager contract.
     * @param _reward number of tokens to add to the pool.
     */
    function addReward(uint256 _reward) external override onlyPoolManager {
        // Transfer to xTGEN contract if total supply is 0.
        // This prevents rewards tokens from getting stuck in this contract.
        if (weightedTotalSupply == 0) {
            rewardsToken.safeTransfer(xTGEN, _reward);
            return;
        }

        rewardPerTokenStored = rewardPerTokenStored.add(_reward.div(weightedTotalSupply));
        totalAvailableRewards = totalAvailableRewards.add(_reward);

        emit RewardAdded(_reward);
    }

    /* ========== MODIFIERS ========== */

    modifier updateReward(address _account) {
        rewards[_account] = earned(_account);
        userRewardPerTokenPaid[_account] = rewardPerTokenStored;
        _;
    }

    modifier onlyPoolManager() {
        require(msg.sender == address(poolManager), "StakingRewards: Only the PoolManager contract can call this function.");
        _;
    }

    /* ========== EVENTS ========== */

    event RewardAdded(uint256 reward);
    event Staked(address indexed user, uint256 tokenClass, uint256 amount);
    event Withdrawn(address indexed user, uint256 tokenClass, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
}