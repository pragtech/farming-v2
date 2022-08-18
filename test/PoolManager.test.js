const { expect } = require("chai");
const { parseEther } = require("@ethersproject/units");

describe("PoolManager", () => {
  let deployer;
  let otherUser;

  let scheduleCurrent;
  let scheduleCurrentAddress;
  let scheduleOld;
  let scheduleOldAddress;
  let scheduleFuture;
  let scheduleFutureAddress;
  let ScheduleFactory;

  let rewardToken;
  let rewardTokenAddress;
  let RewardTokenFactory;

  let stakingToken1;
  let stakingToken2;
  let stakingTokenAddress1;
  let stakingTokenAddress2;
  let StakingTokenFactory;

  let releaseEscrowCurrent;
  let releaseEscrowCurrentAddress;
  let releaseEscrowOld;
  let releaseEscrowOldAddress;
  let releaseEscrowFuture;
  let releaseEscrowFutureAddress;
  let ReleaseEscrowFactory;

  let poolManager;
  let poolManagerAddress;
  let PoolManagerFactory;

  let stakingRewards;
  let stakingRewardsAddress;
  let StakingRewardsFactory;

  let stakingRewardsFactory;
  let stakingRewardsFactoryAddress;
  let StakingRewardsFactoryFactory;

  let startTimeCurrent;
  let startTimeOld;
  let startTimeFuture;

  let currentTime;

  const ONE_WEEK = 86400 * 7;
  const WEEKS_27 = ONE_WEEK * 27;
  const CYCLE_DURATION = ONE_WEEK * 26; // 26 weeks
  
  before(async () => {
    const signers = await ethers.getSigners();
    deployer = signers[0];
    otherUser = signers[1];

    ScheduleFactory = await ethers.getContractFactory('HalveningReleaseSchedule');
    RewardTokenFactory = await ethers.getContractFactory('TestTokenERC20');
    ReleaseEscrowFactory = await ethers.getContractFactory('TestReleaseEscrow');
    PoolManagerFactory = await ethers.getContractFactory('TestPoolManager');
    StakingTokenFactory = await ethers.getContractFactory('TestTokenERC1155');
    StakingRewardsFactory = await ethers.getContractFactory('TestStakingRewards');
    StakingRewardsFactoryFactory = await ethers.getContractFactory('StakingRewardsFactory');

    startTimeCurrent = Math.floor(Date.now() / 1000) - 100;
    startTimeOld = Math.floor(Date.now() / 1000) - WEEKS_27;
    startTimeFuture = Math.floor(Date.now() / 1000) + 10000;

    scheduleOld = await ScheduleFactory.deploy(CYCLE_DURATION * 4, startTimeOld);
    await scheduleOld.deployed();
    scheduleOldAddress = scheduleOld.address;

    scheduleFuture = await ScheduleFactory.deploy(CYCLE_DURATION * 4, startTimeFuture);
    await scheduleFuture.deployed();
    scheduleFutureAddress = scheduleFuture.address;

    rewardToken = await RewardTokenFactory.deploy("Test Token", "TEST");
    await rewardToken.deployed();
    rewardTokenAddress = rewardToken.address;

    stakingToken1 = await StakingTokenFactory.deploy();
    await stakingToken1.deployed();
    stakingTokenAddress1 = stakingToken1.address;

    stakingToken2 = await StakingTokenFactory.deploy();
    await stakingToken2.deployed();
    stakingTokenAddress2 = stakingToken2.address;

    releaseEscrowOld = await ReleaseEscrowFactory.deploy(otherUser.address, rewardTokenAddress, scheduleOldAddress, startTimeOld);
    await releaseEscrowOld.deployed();
    releaseEscrowOldAddress = releaseEscrowOld.address;

    releaseEscrowFuture = await ReleaseEscrowFactory.deploy(otherUser.address, rewardTokenAddress, scheduleFutureAddress, startTimeFuture);
    await releaseEscrowFuture.deployed();
    releaseEscrowFutureAddress = releaseEscrowFuture.address;

    // Transfer tokens to ReleaseEscrowOld
    let tx = await rewardToken.approve(releaseEscrowOldAddress, CYCLE_DURATION * 8);
    await tx.wait();
    let tx2 = await rewardToken.transfer(releaseEscrowOldAddress, CYCLE_DURATION * 8);
    await tx2.wait();

    // Transfer tokens to ReleaseEscrowFuture
    let tx3 = await rewardToken.approve(releaseEscrowFutureAddress, CYCLE_DURATION * 8);
    await tx3.wait();
    let tx4 = await rewardToken.transfer(releaseEscrowFutureAddress, CYCLE_DURATION * 8);
    await tx4.wait();
  });

  beforeEach(async () => {
    scheduleCurrent = await ScheduleFactory.deploy(CYCLE_DURATION * 4, startTimeCurrent);
    await scheduleCurrent.deployed();
    scheduleCurrentAddress = scheduleCurrent.address;

    releaseEscrowCurrent = await ReleaseEscrowFactory.deploy(otherUser.address, rewardTokenAddress, scheduleCurrentAddress, startTimeCurrent);
    await releaseEscrowCurrent.deployed();
    releaseEscrowCurrentAddress = releaseEscrowCurrent.address;

    // Using scheduleCurrentAddress as xTGEN
    stakingRewardsFactory = await StakingRewardsFactoryFactory.deploy(rewardTokenAddress, scheduleCurrentAddress);
    await stakingRewardsFactory.deployed();
    stakingRewardsFactoryAddress = stakingRewardsFactory.address;

    poolManager = await PoolManagerFactory.deploy(rewardTokenAddress, scheduleCurrentAddress, deployer.address, stakingRewardsFactoryAddress, rewardTokenAddress, scheduleCurrentAddress);
    await poolManager.deployed();
    poolManagerAddress = poolManager.address;

    currentTime = await poolManager.getCurrentTime();

    // Initialize StakingRewardsFactory contract.
    let tx = await stakingRewardsFactory.setPoolManager(poolManagerAddress);
    await tx.wait();

    // Transfer tokens to ReleaseEscrowCurrent.
    let tx2 = await rewardToken.approve(releaseEscrowCurrentAddress, CYCLE_DURATION * 8);
    await tx2.wait();
    let tx3 = await rewardToken.transfer(releaseEscrowCurrentAddress, CYCLE_DURATION * 8);
    await tx3.wait();

    // Set the PoolManager's ReleaseEscrow address.
    let tx4 = await poolManager.setReleaseEscrow(releaseEscrowCurrentAddress);
    await tx4.wait();
  });

  describe("#registerPool", () => {
    it("only pool factory", async () => {
        let tx = poolManager.connect(otherUser).registerPool(stakingTokenAddress1, 1000);
        await expect(tx).to.be.reverted;
    });

    it("pool already exists", async () => {
        let tx = await poolManager.registerPool(stakingTokenAddress1, 1000);
        await tx.wait();

        let tx2 = poolManager.registerPool(stakingTokenAddress1, 1000);
        await expect(tx2).to.be.reverted;
    });

    it("create one pool and get pool info", async () => {
        let tx = await poolManager.registerPool(stakingTokenAddress1, 1000);
        expect(tx).to.emit(poolManager, "RegisteredPool");
        await tx.wait();

        let poolInfo = await poolManager.getPoolInfo(stakingTokenAddress1);
        expect(poolInfo[0]).to.be.true;
        expect(poolInfo[1]).to.be.false;
    });

    it("create two pools and get pool info", async () => {
        let tx = await poolManager.registerPool(stakingTokenAddress1, 1000);
        await tx.wait();

        let tx2 = await poolManager.registerPool(stakingTokenAddress2, 5000);
        await tx2.wait();

        let poolInfo1 = await poolManager.getPoolInfo(stakingTokenAddress1);
        expect(poolInfo1[0]).to.be.true;
        expect(poolInfo1[1]).to.be.false;

        let poolInfo2 = await poolManager.getPoolInfo(stakingTokenAddress2);
        expect(poolInfo2[0]).to.be.true;
        expect(poolInfo2[1]).to.be.false;
        expect(poolInfo2[2]).to.not.equal(poolInfo1[2]);
    });
  });
  
  describe("#markPoolAsEligible", () => {
    it("only registered pool", async () => {
        let tx = poolManager.markPoolAsEligible(1000, 10);
        await expect(tx).to.be.reverted;
    });

    it("pool doesn't meet minimum criteria", async () => {
        let tx = await poolManager.setPoolInfo(deployer.address, true, false, deployer.address, 0, 0, 0, 0, 0, 0, startTimeCurrent);
        await tx.wait();

        let tx2 = await poolManager.markPoolAsEligible(parseEther("10000"), 20);
        await tx2.wait();

        let poolInfo = await poolManager.getPoolInfo(deployer.address);
        expect(poolInfo[1]).to.be.false;

        let tx3 = await poolManager.setPoolInfo(deployer.address, true, false, deployer.address, 0, 0, 0, 0, 0, 0, 0);
        await tx3.wait();

        let tx4 = await poolManager.markPoolAsEligible(0, 20);
        await tx4.wait();

        poolInfo = await poolManager.getPoolInfo(deployer.address);
        expect(poolInfo[1]).to.be.false;

        let tx5 = await poolManager.markPoolAsEligible(parseEther("10000"), 0);
        await tx5.wait();

        poolInfo = await poolManager.getPoolInfo(deployer.address);
        expect(poolInfo[1]).to.be.false;
    });

    it("pool meets criteria; no other pools", async () => {
        let tx = await poolManager.setPoolInfo(deployer.address, true, false, deployer.address, 0, 0, 0, 0, 0, 0, 0);
        await tx.wait();

        let tx2 = await poolManager.markPoolAsEligible(parseEther("10000"), 20);
        await tx2.wait();

        let poolInfo = await poolManager.getPoolInfo(deployer.address);
        expect(poolInfo[0]).to.be.true;
        expect(poolInfo[1]).to.be.true;
    });

    it("pool meets criteria; one other pool", async () => {
        let tx = await poolManager.setPoolInfo(deployer.address, true, false, deployer.address, 0, 0, 0, 0, 0, 0, 0);
        await tx.wait();

        let tx2 = await poolManager.connect(otherUser).setPoolInfo(otherUser.address, true, false, otherUser.address, 0, 0, 0, 0, 0, 0, 0);
        await tx2.wait();

        let tx3 = await poolManager.markPoolAsEligible(parseEther("10000"), 20);
        await tx3.wait();

        let poolInfo1 = await poolManager.getPoolInfo(deployer.address);
        expect(poolInfo1[0]).to.be.true;
        expect(poolInfo1[1]).to.be.true;
        expect(poolInfo1[2]).to.equal(deployer.address);

        let tx4 = await poolManager.connect(otherUser).markPoolAsEligible(parseEther("10000"), 20);
        await tx4.wait();

        let poolInfo2 = await poolManager.connect(otherUser).getPoolInfo(otherUser.address);
        expect(poolInfo2[0]).to.be.true;
        expect(poolInfo2[1]).to.be.true;
        expect(poolInfo2[2]).to.equal(otherUser.address);
    });
  });
  
  describe("#getPeriodIndex", () => {
    it("timestamp must be greater than start time", async () => {
        await expect(poolManager.getPeriodIndex(startTimeCurrent - ONE_WEEK)).to.be.reverted;
    });

    it("timestamp in period 0", async () => {
        let current = Math.floor(Date.now() / 1000);
        let index = await poolManager.getPeriodIndex(current + 100);
        expect(index).to.equal(0);
    });

    it("timestamp in period 1", async () => {
        let current = Math.floor(Date.now() / 1000);
        let index = await poolManager.getPeriodIndex(current + 1000 + ONE_WEEK + ONE_WEEK);
        expect(index).to.equal(1);
    });
  });
  
  describe("#getStartOfPeriod", () => {
    it("index must be positive", async () => {
        await expect(poolManager.getStartOfPeriod(-1)).to.be.reverted;
    });

    it("start of period 0", async () => {
        let index = await poolManager.getStartOfPeriod(0);
        expect(index).to.equal(currentTime);
    });

    it("start of period 1", async () => {
        let index = await poolManager.getStartOfPeriod(1);
        expect(index).to.equal(Number(currentTime) + ONE_WEEK + ONE_WEEK);
    });
  });
  
  describe("#rewardPerToken", () => {
    it("0 total weight in current period and period index is 0", async () => {
        let rewardPerToken = await poolManager.rewardPerToken();
        expect(rewardPerToken).to.equal(0);
    });

    it("0 total weight in current period and previous period", async () => {
        let current = Math.floor(Date.now() / 1000);

        let tx = await poolManager.setStartTime(current - ONE_WEEK - ONE_WEEK - 100);
        await tx.wait();

        let rewardPerToken = await poolManager.rewardPerToken();
        expect(rewardPerToken).to.equal(0);
    });

    it("period 0", async () => {
        let current = await poolManager.getCurrentTime();

        let tx = await poolManager.setStartTime(current - 100);
        await tx.wait();

        let tx2 = await poolManager.setLastUpdateTime(current - 100);
        await tx2.wait();

        let tx3 = await poolManager.setGlobalPeriodInfo(0, ONE_WEEK + ONE_WEEK);
        await tx3.wait();
        
        let rewardPerToken = await poolManager.rewardPerToken();
        expect(rewardPerToken).to.equal(parseEther("4"));
    });

    // Accounts for difference of 7 seconds between local time and block.timestamp
    it("period 1", async () => {
        let current = await poolManager.getCurrentTime();

        scheduleCurrent = await ScheduleFactory.deploy(CYCLE_DURATION * 4, current - ONE_WEEK - ONE_WEEK - 100);
        await scheduleCurrent.deployed();
        scheduleCurrentAddress = scheduleCurrent.address;

        releaseEscrowCurrent = await ReleaseEscrowFactory.deploy(otherUser.address, rewardTokenAddress, scheduleCurrentAddress, current - ONE_WEEK - ONE_WEEK - 100);
        await releaseEscrowCurrent.deployed();
        releaseEscrowCurrentAddress = releaseEscrowCurrent.address;

        // Using scheduleCurrentAddress as xTGEN
        stakingRewardsFactory = await StakingRewardsFactoryFactory.deploy(rewardTokenAddress, scheduleCurrentAddress);
        await stakingRewardsFactory.deployed();
        stakingRewardsFactoryAddress = stakingRewardsFactory.address;

        poolManager = await PoolManagerFactory.deploy(rewardTokenAddress, scheduleCurrentAddress, deployer.address, stakingRewardsFactoryAddress, rewardTokenAddress, scheduleCurrentAddress);
        await poolManager.deployed();
        poolManagerAddress = poolManager.address;

        // Set the PoolManager's ReleaseEscrow address
        let tx = await poolManager.setReleaseEscrow(releaseEscrowCurrentAddress);
        await tx.wait();

        let tx2 = await poolManager.setStartTime(current - ONE_WEEK - ONE_WEEK - 100);
        await tx2.wait();

        let tx3 = await poolManager.setLastUpdateTime(current - ONE_WEEK - ONE_WEEK - 100);
        await tx3.wait();

        let tx4 = await poolManager.setGlobalPeriodInfo(1, ONE_WEEK + ONE_WEEK);
        await tx4.wait();
        
        let rewardPerToken = await poolManager.rewardPerToken();
        let flooredResult = BigInt(rewardPerToken) / BigInt(1e18);
        expect(Number(flooredResult)).to.equal(44804); // floor(4838824 * 1e18 / 108)
    });
    
    // Accounts for difference of 7 seconds between local time and block.timestamp
    it("weights in two periods; test values", async () => {
        let current = await poolManager.getCurrentTime();

        scheduleCurrent = await ScheduleFactory.deploy(CYCLE_DURATION * 4, current - (ONE_WEEK * 3));
        await scheduleCurrent.deployed();
        scheduleCurrentAddress = scheduleCurrent.address;

        releaseEscrowCurrent = await ReleaseEscrowFactory.deploy(otherUser.address, rewardTokenAddress, scheduleCurrentAddress, current - (ONE_WEEK * 3));
        await releaseEscrowCurrent.deployed();
        releaseEscrowCurrentAddress = releaseEscrowCurrent.address;

        // Using scheduleCurrentAddress as xTGEN
        stakingRewardsFactory = await StakingRewardsFactoryFactory.deploy(rewardTokenAddress, scheduleCurrentAddress);
        await stakingRewardsFactory.deployed();
        stakingRewardsFactoryAddress = stakingRewardsFactory.address;

        poolManager = await PoolManagerFactory.deploy(rewardTokenAddress, scheduleCurrentAddress, deployer.address, stakingRewardsFactoryAddress, rewardTokenAddress, scheduleCurrentAddress);
        await poolManager.deployed();
        poolManagerAddress = poolManager.address;

        // Set the PoolManager's ReleaseEscrow address
        let tx = await poolManager.setReleaseEscrow(releaseEscrowCurrentAddress);
        await tx.wait();

        let tx2 = await poolManager.setStartTime(current - (ONE_WEEK * 3));
        await tx2.wait();

        let tx3 = await poolManager.setLastUpdateTime(current - (ONE_WEEK * 3));
        await tx3.wait();

        let tx4 = await poolManager.setGlobalPeriodInfo(0, ONE_WEEK * 2);
        await tx4.wait();

        let tx5 = await poolManager.setGlobalPeriodInfo(1, ONE_WEEK * 4);
        await tx5.wait();
        
        let rewardPerToken = await poolManager.rewardPerToken();
        expect(rewardPerToken).to.equal(parseEther("4"));
    });

    // Accounts for difference of 7 seconds between local time and block.timestamp
    it("weights in two periods; production values", async () => {
        let current = await poolManager.getCurrentTime();

        scheduleCurrent = await ScheduleFactory.deploy(parseEther("125000000"), current - (ONE_WEEK * 3));
        await scheduleCurrent.deployed();
        scheduleCurrentAddress = scheduleCurrent.address;

        releaseEscrowCurrent = await ReleaseEscrowFactory.deploy(otherUser.address, rewardTokenAddress, scheduleCurrentAddress, current - (ONE_WEEK * 3));
        await releaseEscrowCurrent.deployed();
        releaseEscrowCurrentAddress = releaseEscrowCurrent.address;

        // Using scheduleCurrentAddress as xTGEN
        stakingRewardsFactory = await StakingRewardsFactoryFactory.deploy(rewardTokenAddress, scheduleCurrentAddress);
        await stakingRewardsFactory.deployed();
        stakingRewardsFactoryAddress = stakingRewardsFactory.address;

        poolManager = await PoolManagerFactory.deploy(rewardTokenAddress, scheduleCurrentAddress, deployer.address, stakingRewardsFactoryAddress, rewardTokenAddress, scheduleCurrentAddress);
        await poolManager.deployed();
        poolManagerAddress = poolManager.address;

        // Set the PoolManager's ReleaseEscrow address
        let tx = await poolManager.setReleaseEscrow(releaseEscrowCurrentAddress);
        await tx.wait();

        let tx2 = await poolManager.setStartTime(current - (ONE_WEEK * 3));
        await tx2.wait();

        let tx3 = await poolManager.setLastUpdateTime(current - (ONE_WEEK * 3));
        await tx3.wait();

        let tx4 = await poolManager.setGlobalPeriodInfo(0, parseEther("20000"));
        await tx4.wait();

        let tx5 = await poolManager.setGlobalPeriodInfo(1, parseEther("40000"));
        await tx5.wait();
        
        let rewardPerToken = await poolManager.rewardPerToken();
        let flooredResult = BigInt(rewardPerToken) / BigInt(1e16);
        expect(Number(flooredResult)).to.equal(48076); // [(3 * 125e24 * 1e18) / (26 * 30e21)] / 1e16
    });

    it("cross-cycle; same weight across 2 periods", async () => {
        let current = await poolManager.getCurrentTime();

        scheduleCurrent = await ScheduleFactory.deploy(CYCLE_DURATION * 4, current - (27 * ONE_WEEK));
        await scheduleCurrent.deployed();
        scheduleCurrentAddress = scheduleCurrent.address;

        releaseEscrowCurrent = await ReleaseEscrowFactory.deploy(otherUser.address, rewardTokenAddress, scheduleCurrentAddress, current - (27 * ONE_WEEK));
        await releaseEscrowCurrent.deployed();
        releaseEscrowCurrentAddress = releaseEscrowCurrent.address;

        // Using scheduleCurrentAddress as xTGEN
        stakingRewardsFactory = await StakingRewardsFactoryFactory.deploy(rewardTokenAddress, scheduleCurrentAddress);
        await stakingRewardsFactory.deployed();
        stakingRewardsFactoryAddress = stakingRewardsFactory.address;

        poolManager = await PoolManagerFactory.deploy(rewardTokenAddress, scheduleCurrentAddress, deployer.address, stakingRewardsFactoryAddress, rewardTokenAddress, scheduleCurrentAddress);
        await poolManager.deployed();
        poolManagerAddress = poolManager.address;

        // Set the PoolManager's ReleaseEscrow address
        let tx = await poolManager.setReleaseEscrow(releaseEscrowCurrentAddress);
        await tx.wait();

        let tx2 = await poolManager.setStartTime(current - (27 * ONE_WEEK));
        await tx2.wait();

        // One week in cycle 0, one week in cycle 1
        let tx3 = await poolManager.setLastUpdateTime(current - (2 * ONE_WEEK));
        await tx3.wait();

        let tx4 = await poolManager.setGlobalPeriodInfo(12, ONE_WEEK + ONE_WEEK);
        await tx4.wait();

        let tx5 = await poolManager.setGlobalPeriodInfo(13, ONE_WEEK + ONE_WEEK);
        await tx5.wait();
        
        let rewardPerToken = await poolManager.rewardPerToken();
        let flooredResult = BigInt(rewardPerToken) / BigInt(1e18);
        expect(Number(flooredResult)).to.equal(3); // [(3628814 * 1e18) / 1209600] / 1e18
    });
  });
  
  describe("#earned", () => {
    it("0 pool weight in current period and global weight is 0", async () => {
        let tx = await poolManager.setPoolInfo(deployer.address, true, false, deployer.address, 0, 0, 0, 0, 0, 0, 0);
        await tx.wait();

        let earned = await poolManager.earned(deployer.address);
        expect(earned).to.equal(0);
    });

    it("0 pool weight in current period and global weight is non-zero; one pool, period 0", async () => {
        let tx = await poolManager.setPoolInfo(deployer.address, true, false, deployer.address, 0, 0, 0, 0, 0, 0, 0);
        await tx.wait();

        let tx2 = await poolManager.setGlobalPeriodInfo(0, ONE_WEEK + ONE_WEEK);
        await tx2.wait();

        let rewardPerToken = await poolManager.rewardPerToken();
        expect(rewardPerToken).to.equal(parseEther("4"));

        let earned = await poolManager.earned(deployer.address);
        expect(earned).to.equal(0);
    });

    // Accounts for 5 seconds delay between local time and block.timestamp
    it("non-zero pool weight in current period and global weight is non-zero; one pool, period 0", async () => {
        let current = await poolManager.getCurrentTime();

        let tx = await poolManager.setPoolInfo(deployer.address, true, false, deployer.address, 0, 0, 0, 0, 0, 0, 0);
        await tx.wait();

        let tx2 = await poolManager.setGlobalPeriodInfo(0, ONE_WEEK + ONE_WEEK);
        await tx2.wait();

        // Same as global weight
        let tx3 = await poolManager.setPoolPeriodInfo(deployer.address, 0, ONE_WEEK + ONE_WEEK);
        await tx3.wait();

        let tx4 = await poolManager.setStartTime(current - 100);
        await tx4.wait();

        let tx5 = await poolManager.setLastUpdateTime(current - 100);
        await tx5.wait();

        let rewardPerToken = await poolManager.rewardPerToken();
        expect(rewardPerToken).to.equal(parseEther("4"));

        let earned = await poolManager.earned(deployer.address);
        expect(earned).to.equal(420);
    });
    
    // Accounts for 9 seconds delay between local time and block.timestamp
    it("0 pool weight in current period and global weight is non-zero; multiple pools, period 0", async () => {
        let current = await poolManager.getCurrentTime();

        scheduleCurrent = await ScheduleFactory.deploy(CYCLE_DURATION * 4, current - 100);
        await scheduleCurrent.deployed();
        scheduleCurrentAddress = scheduleCurrent.address;

        releaseEscrowCurrent = await ReleaseEscrowFactory.deploy(otherUser.address, rewardTokenAddress, scheduleCurrentAddress, current - 100);
        await releaseEscrowCurrent.deployed();
        releaseEscrowCurrentAddress = releaseEscrowCurrent.address;

        // Using scheduleCurrentAddress as xTGEN
        stakingRewardsFactory = await StakingRewardsFactoryFactory.deploy(rewardTokenAddress, scheduleCurrentAddress);
        await stakingRewardsFactory.deployed();
        stakingRewardsFactoryAddress = stakingRewardsFactory.address;

        poolManager = await PoolManagerFactory.deploy(rewardTokenAddress, scheduleCurrentAddress, deployer.address, stakingRewardsFactoryAddress, rewardTokenAddress, scheduleCurrentAddress);
        await poolManager.deployed();
        poolManagerAddress = poolManager.address;

        // Set the PoolManager's ReleaseEscrow address
        let tx = await poolManager.setReleaseEscrow(releaseEscrowCurrentAddress);
        await tx.wait();

        let tx2 = await poolManager.setStartTime(current - 100);
        await tx2.wait();

        let tx3 = await poolManager.setLastUpdateTime(current - 100);
        await tx3.wait();

        let tx4 = await poolManager.setPoolInfo(deployer.address, true, false, deployer.address, 0, 0, 0, 0, 0, 0, 0);
        await tx4.wait();

        let tx5 = await poolManager.setPoolInfo(otherUser.address, true, false, otherUser.address, 0, 0, 0, 0, 0, 0, 0);
        await tx5.wait();

        // Same as global weight
        let tx6 = await poolManager.setPoolPeriodInfo(otherUser.address, 0, ONE_WEEK + ONE_WEEK);
        await tx6.wait();

        let tx7 = await poolManager.setGlobalPeriodInfo(0, ONE_WEEK + ONE_WEEK);
        await tx7.wait();

        let rewardPerToken = await poolManager.rewardPerToken();
        expect(rewardPerToken).to.equal(parseEther("4"));

        let earnedDeployer = await poolManager.earned(deployer.address);
        expect(earnedDeployer).to.equal(0);

        let earnedOther = await poolManager.earned(otherUser.address);
        expect(earnedOther).to.equal(444);
    });

    // Accounts for 10 seconds delay between local time and block.timestamp
    it("non-zero pool weight in current period and global weight is non-zero; multiple pools, period 0", async () => {
        let current = await poolManager.getCurrentTime();

        scheduleCurrent = await ScheduleFactory.deploy(CYCLE_DURATION * 4, current - 100);
        await scheduleCurrent.deployed();
        scheduleCurrentAddress = scheduleCurrent.address;

        releaseEscrowCurrent = await ReleaseEscrowFactory.deploy(otherUser.address, rewardTokenAddress, scheduleCurrentAddress, current - 100);
        await releaseEscrowCurrent.deployed();
        releaseEscrowCurrentAddress = releaseEscrowCurrent.address;

        // Using scheduleCurrentAddress as xTGEN
        stakingRewardsFactory = await StakingRewardsFactoryFactory.deploy(rewardTokenAddress, scheduleCurrentAddress);
        await stakingRewardsFactory.deployed();
        stakingRewardsFactoryAddress = stakingRewardsFactory.address;

        poolManager = await PoolManagerFactory.deploy(rewardTokenAddress, scheduleCurrentAddress, deployer.address, stakingRewardsFactoryAddress, rewardTokenAddress, scheduleCurrentAddress);
        await poolManager.deployed();
        poolManagerAddress = poolManager.address;

        // Set the PoolManager's ReleaseEscrow address
        let tx = await poolManager.setReleaseEscrow(releaseEscrowCurrentAddress);
        await tx.wait();

        let tx2 = await poolManager.setStartTime(current - 100);
        await tx2.wait();

        let tx3 = await poolManager.setLastUpdateTime(current - 100);
        await tx3.wait();

        let tx4 = await poolManager.setPoolInfo(deployer.address, true, false, deployer.address, 0, 0, 0, 0, 0, 0, 0);
        await tx4.wait();

        let tx5 = await poolManager.setPoolInfo(otherUser.address, true, false, otherUser.address, 0, 0, 0, 0, 0, 0, 0);
        await tx5.wait();

        // Global weight / 2
        let tx6 = await poolManager.setPoolPeriodInfo(deployer.address, 0, ONE_WEEK);
        await tx6.wait();

        // Global weight / 2
        let tx7 = await poolManager.setPoolPeriodInfo(otherUser.address, 0, ONE_WEEK);
        await tx7.wait();

        let tx8 = await poolManager.setGlobalPeriodInfo(0, ONE_WEEK + ONE_WEEK);
        await tx8.wait();

        let rewardPerToken = await poolManager.rewardPerToken();
        expect(rewardPerToken).to.equal(parseEther("4"));

        let earnedDeployer = await poolManager.earned(deployer.address);
        expect(earnedDeployer).to.equal(224);

        let earnedOther = await poolManager.earned(otherUser.address);
        expect(earnedOther).to.equal(224);
    });

    // Accounts for 10 seconds delay between local time and block.timestamp
    it("non-zero pool weight in period 1, 0 pool weight in previous period, and global weight is non-zero in period 1; one pool", async () => {
        let current = await poolManager.getCurrentTime();

        scheduleCurrent = await ScheduleFactory.deploy(CYCLE_DURATION * 4, current - ONE_WEEK - ONE_WEEK - 100);
        await scheduleCurrent.deployed();
        scheduleCurrentAddress = scheduleCurrent.address;

        releaseEscrowCurrent = await ReleaseEscrowFactory.deploy(otherUser.address, rewardTokenAddress, scheduleCurrentAddress, current - ONE_WEEK - ONE_WEEK - 100);
        await releaseEscrowCurrent.deployed();
        releaseEscrowCurrentAddress = releaseEscrowCurrent.address;

        // Using scheduleCurrentAddress as xTGEN
        stakingRewardsFactory = await StakingRewardsFactoryFactory.deploy(rewardTokenAddress, scheduleCurrentAddress);
        await stakingRewardsFactory.deployed();
        stakingRewardsFactoryAddress = stakingRewardsFactory.address;

        poolManager = await PoolManagerFactory.deploy(rewardTokenAddress, scheduleCurrentAddress, deployer.address, stakingRewardsFactoryAddress, rewardTokenAddress, scheduleCurrentAddress);
        await poolManager.deployed();
        poolManagerAddress = poolManager.address;

        // Set the PoolManager's ReleaseEscrow address
        let tx = await poolManager.setReleaseEscrow(releaseEscrowCurrentAddress);
        await tx.wait();

        let tx2 = await poolManager.setPoolInfo(deployer.address, true, false, deployer.address, 0, 0, 0, 0, 0, 0, 0);
        await tx2.wait();

        let tx3 = await poolManager.setGlobalPeriodInfo(0, 0);
        await tx3.wait();

        let tx4 = await poolManager.setGlobalPeriodInfo(1, ONE_WEEK + ONE_WEEK);
        await tx4.wait();

        // 0 weight in period 0
        let tx5 = await poolManager.setPoolPeriodInfo(deployer.address, 0, 0);
        await tx5.wait();

        // Same as global weight in period 1
        let tx6 = await poolManager.setPoolPeriodInfo(deployer.address, 1, ONE_WEEK + ONE_WEEK);
        await tx6.wait();

        let tx7 = await poolManager.setStartTime(current - ONE_WEEK - ONE_WEEK - 100);
        await tx7.wait();

        let tx8 = await poolManager.setLastUpdateTime(current - ONE_WEEK - ONE_WEEK - 100);
        await tx8.wait();

        let rewardPerToken = await poolManager.rewardPerToken();
        let flooredResult = BigInt(rewardPerToken) / BigInt(1e18);
        expect(Number(flooredResult)).to.equal(43204); // floor(4838843 * 1e18 / 112)

        let earned = await poolManager.earned(deployer.address);
        expect(earned).to.equal(4838848);
    });

    // Accounts for 10 seconds delay between local time and block.timestamp
    it("non-zero pool weight in period 1, 0 pool weight in previous period, and global weight is non-zero in both periods; one pool", async () => {
        let current = await poolManager.getCurrentTime();

        scheduleCurrent = await ScheduleFactory.deploy(CYCLE_DURATION * 4, current - ONE_WEEK - ONE_WEEK - 100);
        await scheduleCurrent.deployed();
        scheduleCurrentAddress = scheduleCurrent.address;

        releaseEscrowCurrent = await ReleaseEscrowFactory.deploy(otherUser.address, rewardTokenAddress, scheduleCurrentAddress, current - ONE_WEEK - ONE_WEEK - 100);
        await releaseEscrowCurrent.deployed();
        releaseEscrowCurrentAddress = releaseEscrowCurrent.address;

        // Using scheduleCurrentAddress as xTGEN
        stakingRewardsFactory = await StakingRewardsFactoryFactory.deploy(rewardTokenAddress, scheduleCurrentAddress);
        await stakingRewardsFactory.deployed();
        stakingRewardsFactoryAddress = stakingRewardsFactory.address;

        poolManager = await PoolManagerFactory.deploy(rewardTokenAddress, scheduleCurrentAddress, deployer.address, stakingRewardsFactoryAddress, rewardTokenAddress, scheduleCurrentAddress);
        await poolManager.deployed();
        poolManagerAddress = poolManager.address;

        // Set the PoolManager's ReleaseEscrow address
        let tx = await poolManager.setReleaseEscrow(releaseEscrowCurrentAddress);
        await tx.wait();

        let tx2 = await poolManager.setPoolInfo(deployer.address, true, false, deployer.address, 0, 0, 0, 0, 0, 0, 0);
        await tx2.wait();

        let tx3 = await poolManager.setGlobalPeriodInfo(0, ONE_WEEK + ONE_WEEK);
        await tx3.wait();

        let tx4 = await poolManager.setGlobalPeriodInfo(1, ONE_WEEK + ONE_WEEK);
        await tx4.wait();

        // 0 weight in period 0
        let tx5 = await poolManager.setPoolPeriodInfo(deployer.address, 0, 0);
        await tx5.wait();

        // Same as global weight in period 1
        let tx6 = await poolManager.setPoolPeriodInfo(deployer.address, 1, ONE_WEEK + ONE_WEEK);
        await tx6.wait();

        let tx7 = await poolManager.setStartTime(current - ONE_WEEK - ONE_WEEK - 100);
        await tx7.wait();

        let tx8 = await poolManager.setLastUpdateTime(current - ONE_WEEK - ONE_WEEK - 100);
        await tx8.wait();

        let rewardPerToken = await poolManager.rewardPerToken();
        console.log(rewardPerToken.toString());
        let flooredResult = BigInt(rewardPerToken) / BigInt(1e18);
        expect(Number(flooredResult)).to.equal(4); // floor(4838839 * 1e18 / 1209700)

        let earned = await poolManager.earned(deployer.address);
        expect(earned).to.equal(448);
    });

    // Accounts for 10 seconds delay between local time and block.timestamp
    it("non-zero pool weight in period 1, non-zero pool weight in previous period, and global weight is non-zero in both periods; one pool", async () => {
        let current = await poolManager.getCurrentTime();

        scheduleCurrent = await ScheduleFactory.deploy(CYCLE_DURATION * 4, current - ONE_WEEK - ONE_WEEK - 100);
        await scheduleCurrent.deployed();
        scheduleCurrentAddress = scheduleCurrent.address;

        releaseEscrowCurrent = await ReleaseEscrowFactory.deploy(otherUser.address, rewardTokenAddress, scheduleCurrentAddress, current - ONE_WEEK - ONE_WEEK - 100);
        await releaseEscrowCurrent.deployed();
        releaseEscrowCurrentAddress = releaseEscrowCurrent.address;

        // Using scheduleCurrentAddress as xTGEN
        stakingRewardsFactory = await StakingRewardsFactoryFactory.deploy(rewardTokenAddress, scheduleCurrentAddress);
        await stakingRewardsFactory.deployed();
        stakingRewardsFactoryAddress = stakingRewardsFactory.address;

        poolManager = await PoolManagerFactory.deploy(rewardTokenAddress, scheduleCurrentAddress, deployer.address, stakingRewardsFactoryAddress, rewardTokenAddress, scheduleCurrentAddress);
        await poolManager.deployed();
        poolManagerAddress = poolManager.address;

        // Set the PoolManager's ReleaseEscrow address
        let tx = await poolManager.setReleaseEscrow(releaseEscrowCurrentAddress);
        await tx.wait();

        let tx2 = await poolManager.setPoolInfo(deployer.address, true, false, deployer.address, 0, 0, 0, 0, 0, 0, 0);
        await tx2.wait();

        let tx3 = await poolManager.setGlobalPeriodInfo(0, ONE_WEEK + ONE_WEEK);
        await tx3.wait();

        let tx4 = await poolManager.setGlobalPeriodInfo(1, ONE_WEEK + ONE_WEEK);
        await tx4.wait();

        // Same as global weight in period 0
        let tx5 = await poolManager.setPoolPeriodInfo(deployer.address, 0, ONE_WEEK + ONE_WEEK);
        await tx5.wait();

        // Same as global weight in period 1
        let tx6 = await poolManager.setPoolPeriodInfo(deployer.address, 1, ONE_WEEK + ONE_WEEK);
        await tx6.wait();

        let tx7 = await poolManager.setStartTime(current - ONE_WEEK - ONE_WEEK - 100);
        await tx7.wait();

        let tx8 = await poolManager.setLastUpdateTime(current - ONE_WEEK - ONE_WEEK - 100);
        await tx8.wait();

        let rewardPerToken = await poolManager.rewardPerToken();
        console.log(rewardPerToken.toString());
        let flooredResult = BigInt(rewardPerToken) / BigInt(1e18);
        expect(Number(flooredResult)).to.equal(4); // floor(4838839 * 1e18 / 1209700)

        let earned = await poolManager.earned(deployer.address);
        expect(earned).to.equal(4838847);
    });

    // Accounts for 12 seconds delay between local time and block.timestamp
    it("non-zero pool weight in period 1, non-zero pool weight in previous period, and global weight is non-zero in both periods; multiple pools", async () => {
        let current = await poolManager.getCurrentTime();

        scheduleCurrent = await ScheduleFactory.deploy(CYCLE_DURATION * 4, current - ONE_WEEK - ONE_WEEK - 100);
        await scheduleCurrent.deployed();
        scheduleCurrentAddress = scheduleCurrent.address;

        releaseEscrowCurrent = await ReleaseEscrowFactory.deploy(otherUser.address, rewardTokenAddress, scheduleCurrentAddress, current - ONE_WEEK - ONE_WEEK - 100);
        await releaseEscrowCurrent.deployed();
        releaseEscrowCurrentAddress = releaseEscrowCurrent.address;

        // Using scheduleCurrentAddress as xTGEN
        stakingRewardsFactory = await StakingRewardsFactoryFactory.deploy(rewardTokenAddress, scheduleCurrentAddress);
        await stakingRewardsFactory.deployed();
        stakingRewardsFactoryAddress = stakingRewardsFactory.address;

        poolManager = await PoolManagerFactory.deploy(rewardTokenAddress, scheduleCurrentAddress, deployer.address, stakingRewardsFactoryAddress, rewardTokenAddress, scheduleCurrentAddress);
        await poolManager.deployed();
        poolManagerAddress = poolManager.address;

        // Set the PoolManager's ReleaseEscrow address
        let tx = await poolManager.setReleaseEscrow(releaseEscrowCurrentAddress);
        await tx.wait();

        let tx2 = await poolManager.setPoolInfo(deployer.address, true, false, deployer.address, 0, 0, 0, 0, 0, 0, 0);
        await tx2.wait();

        let tx3 = await poolManager.setPoolInfo(otherUser.address, true, false, deployer.address, 0, 0, 0, 0, 0, 0, 0);
        await tx3.wait();

        let tx4 = await poolManager.setGlobalPeriodInfo(0, ONE_WEEK + ONE_WEEK );
        await tx4.wait();

        let tx5 = await poolManager.setGlobalPeriodInfo(1, ONE_WEEK + ONE_WEEK);
        await tx5.wait();

        // (Global weight / 2) in period 0
        let tx6 = await poolManager.setPoolPeriodInfo(deployer.address, 0, ONE_WEEK * 1.5);
        await tx6.wait();

        // (Global weight / 2) in period 1
        let tx7 = await poolManager.setPoolPeriodInfo(deployer.address, 1, ONE_WEEK * 1.5);
        await tx7.wait();

        // (Global weight / 2) in period 0
        let tx8 = await poolManager.setPoolPeriodInfo(otherUser.address, 0, ONE_WEEK * 0.5);
        await tx8.wait();

        // (Global weight / 2) in period 1
        let tx9 = await poolManager.setPoolPeriodInfo(otherUser.address, 1, ONE_WEEK * 0.5);
        await tx9.wait();

        let tx10 = await poolManager.setStartTime(current - ONE_WEEK - ONE_WEEK - 100);
        await tx10.wait();

        let tx11 = await poolManager.setLastUpdateTime(current - ONE_WEEK - ONE_WEEK - 100);
        await tx11.wait();

        let rewardPerToken = await poolManager.rewardPerToken();
        console.log(rewardPerToken.toString());
        let flooredResult = BigInt(rewardPerToken) / BigInt(1e18);
        expect(Number(flooredResult)).to.equal(4); // floor(4838850 * 1e18 / 1209700)

        let earnedDeployer = await poolManager.earned(deployer.address);
        expect(earnedDeployer).to.equal(3629144);

        let earnedOther = await poolManager.earned(otherUser.address);
        expect(earnedOther).to.equal(1209714);
    });
  });
  
  describe("#calculateAveragePriceChange", () => {
    it("decline in price", async () => {
        let tx = await poolManager.setPoolInfo(deployer.address, true, false, deployer.address, 0, 800, 2, 1000, 1, 0, 0);
        await tx.wait();

        let APC = await poolManager.calculateAveragePriceChange(deployer.address);
        expect(APC).to.equal(0);
    });

    it("previous recorded price is 0", async () => {
        let tx = await poolManager.setPoolInfo(deployer.address, true, false, deployer.address, 0, 1000, 2, 0, 1, 0, 0);
        await tx.wait();

        let APC = await poolManager.calculateAveragePriceChange(deployer.address);
        expect(APC).to.equal(0);
    });

    it("previous recorded index > latest recorded index", async () => {
        let tx = await poolManager.setPoolInfo(deployer.address, true, false, deployer.address, 0, 1000, 1, 200, 2, 0, 0);
        await tx.wait();

        let APC = await poolManager.calculateAveragePriceChange(deployer.address);
        expect(APC).to.equal(0);
    });
    
    it("small values test 1", async () => {
        let tx = await poolManager.setPoolInfo(deployer.address, true, false, deployer.address, 0, parseEther("1.2"), 1, parseEther("1"), 1, 0, 0);
        await tx.wait();

        let weight = await poolManager.calculateAveragePriceChange(deployer.address);
        expect(weight).to.equal(200);
    });
    
    it("small values test 2", async () => {
        let tx = await poolManager.setPoolInfo(deployer.address, true, false, deployer.address, 0, parseEther("0.9"), 1, parseEther("0.6"), 1, 0, 0);
        await tx.wait();

        let weight = await poolManager.calculateAveragePriceChange(deployer.address);
        expect(weight).to.equal(500);
    });
    
    it("medium values test; across 3 periods", async () => {
        let tx = await poolManager.setPoolInfo(deployer.address, true, false, deployer.address, 0, parseEther("2.4"), 2, parseEther("2"), 0, 0, 0);
        await tx.wait();

        let weight = await poolManager.calculateAveragePriceChange(deployer.address);
        expect(weight).to.equal(100);
    });
    
    it("large values test", async () => {
        let tx = await poolManager.setPoolInfo(deployer.address, true, false, deployer.address, 0, parseEther("3"), 1, parseEther("2"), 1, 0, 0);
        await tx.wait();

        let weight = await poolManager.calculateAveragePriceChange(deployer.address);
        expect(weight).to.equal(500);
    });
  });
  
  describe("#calculatePoolWeight", () => {
    it("total duration == 0", async () => {
        let tx = await poolManager.setPoolInfo(deployer.address, true, false, deployer.address, 0, 1000, 2, 800, 1, 0, 0);
        await tx.wait();

        let weight = await poolManager.calculatePoolWeight(deployer.address);
        expect(weight).to.equal(0);
    });
    
    it("small values test 1", async () => {
        let tx = await poolManager.setPoolInfo(deployer.address, true, false, deployer.address, parseEther("8"), parseEther("1.2"), 1, parseEther("1"), 1, 0, 0);
        await tx.wait();

        let tx2 = await poolManager.setGlobalAPCVariables(150, 1);
        await tx2.wait();

        let tx3 = await poolManager.setPoolAPC(deployer.address, 200);
        await tx3.wait();

        let weight = await poolManager.calculatePoolWeight(deployer.address);
        expect(weight).to.equal(parseEther("56"));
    });
    
    it("small values test 2", async () => {
        let tx = await poolManager.setPoolInfo(deployer.address, true, false, deployer.address, parseEther("30"), parseEther("0.9"), 1, parseEther("0.6"), 1, 0, 0);
        await tx.wait();

        let tx2 = await poolManager.setGlobalAPCVariables(150, 1);
        await tx2.wait();

        let tx3 = await poolManager.setPoolAPC(deployer.address, 500);
        await tx3.wait();

        let weight = await poolManager.calculatePoolWeight(deployer.address);
        expect(weight).to.equal(parseEther("540"));
    });
    
    it("medium values test; across 3 periods; below global APC", async () => {
        let tx = await poolManager.setPoolInfo(deployer.address, true, false, deployer.address, parseEther("10000"), parseEther("2.4"), 2, parseEther("2"), 0, 0, 0);
        await tx.wait();

        let tx2 = await poolManager.setGlobalAPCVariables(150, 1);
        await tx2.wait();

        let tx3 = await poolManager.setPoolAPC(deployer.address, 100);
        await tx3.wait();

        let weight = await poolManager.calculatePoolWeight(deployer.address);
        let expectedWeight = BigInt(10000e18) * BigInt(6) / BigInt(7);
        expect(weight.toString()).to.equal(expectedWeight.toString());
    });
    
    it("large values test", async () => {
        let tx = await poolManager.setPoolInfo(deployer.address, true, false, deployer.address, parseEther("1000000"), parseEther("3"), 1, parseEther("2"), 1, 0, 0);
        await tx.wait();

        let tx2 = await poolManager.setGlobalAPCVariables(150, 1);
        await tx2.wait();

        let tx3 = await poolManager.setPoolAPC(deployer.address, 500);
        await tx3.wait();

        let weight = await poolManager.calculatePoolWeight(deployer.address);
        expect(weight).to.equal(parseEther("18000000"));
    });
  });
  
  describe("#claimLatestRewards", () => {
      let current;
    beforeEach(async () => {
        current = await poolManager.getCurrentTime();

        rewardToken = await RewardTokenFactory.deploy("Test Token", "TEST");
        await rewardToken.deployed();
        rewardTokenAddress = rewardToken.address;

        scheduleCurrent = await ScheduleFactory.deploy(parseEther((4 * CYCLE_DURATION).toString()), current - 100);
        await scheduleCurrent.deployed();
        scheduleCurrentAddress = scheduleCurrent.address;
    
        // Using scheduleCurrentAddress as xTGEN
        stakingRewardsFactory = await StakingRewardsFactoryFactory.deploy(rewardTokenAddress, scheduleCurrentAddress);
        await stakingRewardsFactory.deployed();
        stakingRewardsFactoryAddress = stakingRewardsFactory.address;

        poolManager = await PoolManagerFactory.deploy(rewardTokenAddress, scheduleCurrentAddress, deployer.address, stakingRewardsFactoryAddress, rewardTokenAddress, scheduleCurrentAddress);
        await poolManager.deployed();
        poolManagerAddress = poolManager.address;

        releaseEscrowCurrent = await ReleaseEscrowFactory.deploy(poolManagerAddress, rewardTokenAddress, scheduleCurrentAddress, current - 100);
        await releaseEscrowCurrent.deployed();
        releaseEscrowCurrentAddress = releaseEscrowCurrent.address;

        stakingRewards = await StakingRewardsFactory.deploy(poolManagerAddress, rewardTokenAddress, stakingTokenAddress1, scheduleCurrentAddress);
        await stakingRewards.deployed();
        stakingRewardsAddress = stakingRewards.address;
    
        // Transfer tokens to ReleaseEscrowCurrent
        let tx = await rewardToken.approve(releaseEscrowCurrentAddress, parseEther((8 * CYCLE_DURATION).toString()));
        await tx.wait();
        let tx2 = await rewardToken.transfer(releaseEscrowCurrentAddress, parseEther((8 * CYCLE_DURATION).toString()));
        await tx2.wait();
    
        // Set the PoolManager's ReleaseEscrow address
        let tx3 = await poolManager.setReleaseEscrow(releaseEscrowCurrentAddress);
        await tx3.wait();
    });
    
    it("calling from address other than pool's farm", async () => {
        let tx = await poolManager.setPoolInfo(deployer.address, true, true, otherUser.address, 0, 1000, 2, 800, 1, 0, 0);
        await tx.wait();

        let tx2 = poolManager.claimLatestRewards(deployer.address);
        await expect(tx2).to.be.reverted;
    });

    it("distribution has not started", async () => {
        scheduleCurrent = await ScheduleFactory.deploy(CYCLE_DURATION * 4, current + 100);
        await scheduleCurrent.deployed();
        scheduleCurrentAddress = scheduleCurrent.address;
    
        // Using scheduleCurrentAddress as xTGEN
        stakingRewardsFactory = await StakingRewardsFactoryFactory.deploy(rewardTokenAddress, scheduleCurrentAddress);
        await stakingRewardsFactory.deployed();
        stakingRewardsFactoryAddress = stakingRewardsFactory.address;

        poolManager = await PoolManagerFactory.deploy(rewardTokenAddress, scheduleCurrentAddress, deployer.address, stakingRewardsFactoryAddress, rewardTokenAddress, scheduleCurrentAddress);
        await poolManager.deployed();
        poolManagerAddress = poolManager.address;

        releaseEscrowCurrent = await ReleaseEscrowFactory.deploy(poolManagerAddress, rewardTokenAddress, scheduleCurrentAddress, current + 100);
        await releaseEscrowCurrent.deployed();
        releaseEscrowCurrentAddress = releaseEscrowCurrent.address;

        stakingRewards = await StakingRewardsFactory.deploy(poolManagerAddress, rewardTokenAddress, stakingTokenAddress1, scheduleCurrentAddress);
        await stakingRewards.deployed();
        stakingRewardsAddress = stakingRewards.address;

        // Set the PoolManager's ReleaseEscrow address
        let tx = await poolManager.setReleaseEscrow(releaseEscrowCurrentAddress);
        await tx.wait();

        let tx2 = await poolManager.setPoolInfo(deployer.address, true, true, stakingRewardsAddress, 0, 1000, 2, 800, 1, 0, 0);
        await tx2.wait();

        let tx3 = await stakingRewards.claimLatestRewardsTest(deployer.address);
        await tx3.wait();

        let balanceStaking = await rewardToken.balanceOf(scheduleCurrentAddress);
        expect(balanceStaking).to.equal(0);

        // 17 seconds difference between local time and block.timestamp
        let lastUpdateTime = await poolManager.lastUpdateTime();
        expect(lastUpdateTime).to.equal(Number(current) + 17);

        let rewards = await poolManager.rewards(deployer.address);
        expect(rewards).to.equal(0);

        let poolRewardPerTokenPaid = await poolManager.poolRewardPerTokenPaid(deployer.address);
        expect(poolRewardPerTokenPaid).to.equal(0);

        let balanceFarm = await rewardToken.balanceOf(stakingRewardsAddress);
        expect(balanceFarm).to.equal(0);

        let totalAvailableRewards = await stakingRewards.totalAvailableRewards();
        expect(totalAvailableRewards).to.equal(0);

        let rewardPerTokenStored = await stakingRewards.rewardPerTokenStored();
        expect(rewardPerTokenStored).to.equal(0);
    });
    
    // Accounts for 14 seconds difference between local time and block.timestamp
    it("no rewards available", async () => {
        let scaledWeight = BigInt(1e18) * BigInt(100) / BigInt(86400 * 7 * 2);
        let expectedAvailableTokens = BigInt(400 * 1e18);
        let expectedRewardPerToken = expectedAvailableTokens * BigInt(1e18) / scaledWeight;

        let tx = await poolManager.setPoolInfo(deployer.address, true, true, stakingRewardsAddress, 0, 1000, 2, 800, 1, 0, 0);
        await tx.wait();

        let tx2 = await poolManager.setGlobalPeriodInfo(0, parseEther("1"));
        await tx2.wait();

        let tx3 = await poolManager.setPoolPeriodInfo(deployer.address, 0, 0);
        await tx3.wait();

        let tx4 = await poolManager.setStartTime(current - 100);
        await tx4.wait();

        let tx5 = await poolManager.setLastUpdateTime(current - 100);
        await tx5.wait();

        let rewardPerToken = await poolManager.rewardPerToken();
        expect((BigInt(rewardPerToken) / BigInt(1e12)).toString()).to.equal((expectedRewardPerToken / BigInt(1e12)).toString());

        let tx6 = await stakingRewards.claimLatestRewardsTest(deployer.address);
        await tx6.wait();

        let balanceStaking = await rewardToken.balanceOf(scheduleCurrentAddress);
        expect(balanceStaking).to.equal(0);

        let availableRewards = await scheduleCurrent.availableRewards(current - 100);

        // Rewards stay in PoolManager contract so other pool with >0 weight can be paid out.
        let balancePoolManager = await rewardToken.balanceOf(poolManagerAddress);
        expect(balancePoolManager).to.equal(availableRewards);

        let balanceFarm = await rewardToken.balanceOf(stakingRewardsAddress);
        expect(balanceFarm).to.equal(0);

        // 15 seconds difference between local time and block.timestamp
        let lastUpdateTime = await poolManager.lastUpdateTime();
        expect(lastUpdateTime).to.equal(Number(current) + 15);

        let newRewards = await poolManager.rewards(deployer.address);
        expect(newRewards).to.equal(0);

        let earned = await poolManager.earned(deployer.address);
        expect(earned).to.equal(0);

        let poolRewardPerTokenPaid = await poolManager.poolRewardPerTokenPaid(deployer.address);
        expect((BigInt(poolRewardPerTokenPaid.toString()) / BigInt(1e12)).toString()).to.equal((expectedRewardPerToken / BigInt(1e12)).toString());

        let totalAvailableRewards = await stakingRewards.totalAvailableRewards();
        expect(totalAvailableRewards).to.equal(0);

        let farmRewardPerTokenStored = await stakingRewards.rewardPerTokenStored();
        expect(farmRewardPerTokenStored).to.equal(0);
    });
    
    // Accounts for 14 seconds difference between local time and block.timestamp
    it("pool manager global weight is 0; no existing pool rewards", async () => {
        let tx = await poolManager.setPoolInfo(deployer.address, true, true, stakingRewardsAddress, 0, 1000, 2, 800, 1, 0, 0);
        await tx.wait();

        let tx2 = await poolManager.setGlobalPeriodInfo(0, 0);
        await tx2.wait();

        let tx3 = await poolManager.setPoolPeriodInfo(deployer.address, 0, 0);
        await tx3.wait();

        let tx4 = await poolManager.setStartTime(current - 100);
        await tx4.wait();

        let tx5 = await poolManager.setLastUpdateTime(current - 100);
        await tx5.wait();

        let rewardPerToken = await poolManager.rewardPerToken();
        expect(rewardPerToken).to.equal(0);

        let tx6 = await stakingRewards.claimLatestRewardsTest(deployer.address);
        await tx6.wait();
        
        let availableRewards = await scheduleCurrent.availableRewards(current - 100);

        let balanceStaking = await rewardToken.balanceOf(scheduleCurrentAddress);
        expect(balanceStaking).to.equal(availableRewards);

        // Rewards stay in PoolManager contract so other pool with >0 weight can be paid out.
        let balancePoolManager = await rewardToken.balanceOf(poolManagerAddress);
        expect(balancePoolManager).to.equal(0);

        let balanceFarm = await rewardToken.balanceOf(stakingRewardsAddress);
        expect(balanceFarm).to.equal(0);

        // 15 seconds difference between local time and block.timestamp
        let lastUpdateTime = await poolManager.lastUpdateTime();
        expect(lastUpdateTime).to.equal(Number(current) + 15);

        let newRewards = await poolManager.rewards(deployer.address);
        expect(newRewards).to.equal(0);

        let earned = await poolManager.earned(deployer.address);
        expect(earned).to.equal(0);

        let poolRewardPerTokenPaid = await poolManager.poolRewardPerTokenPaid(deployer.address);
        expect(poolRewardPerTokenPaid).to.equal(0);

        let totalAvailableRewards = await stakingRewards.totalAvailableRewards();
        expect(totalAvailableRewards).to.equal(0);

        let farmRewardPerTokenStored = await stakingRewards.rewardPerTokenStored();
        expect(farmRewardPerTokenStored).to.equal(0);
    });
    
    // Accounts for 14 seconds difference between local time and block.timestamp
    it("pool manager global weight is 0; existing pool rewards", async () => {
        let tx = await poolManager.setPoolInfo(deployer.address, true, true, stakingRewardsAddress, 0, 1000, 2, 800, 1, 0, 0);
        await tx.wait();

        let tx2 = await poolManager.setGlobalPeriodInfo(0, 0);
        await tx2.wait();

        let tx3 = await poolManager.setPoolPeriodInfo(deployer.address, 0, 0);
        await tx3.wait();

        let tx4 = await poolManager.setStartTime(current - 100);
        await tx4.wait();

        let tx5 = await poolManager.setLastUpdateTime(current - 100);
        await tx5.wait();

        let rewardPerToken = await poolManager.rewardPerToken();
        expect(rewardPerToken).to.equal(0);

        let tx6 = await stakingRewards.claimLatestRewardsTest(deployer.address);
        await tx6.wait();
        
        let availableRewards = await scheduleCurrent.availableRewards(current - 100);

        let balanceStaking = await rewardToken.balanceOf(scheduleCurrentAddress);
        expect(balanceStaking).to.equal(availableRewards);

        // Rewards stay in PoolManager contract so other pool with >0 weight can be paid out.
        let balancePoolManager = await rewardToken.balanceOf(poolManagerAddress);
        expect(balancePoolManager).to.equal(0);

        let balanceFarm = await rewardToken.balanceOf(stakingRewardsAddress);
        expect(balanceFarm).to.equal(0);

        // 15 seconds difference between local time and block.timestamp
        let lastUpdateTime = await poolManager.lastUpdateTime();
        expect(lastUpdateTime).to.equal(Number(current) + 15);

        let newRewards = await poolManager.rewards(deployer.address);
        expect(newRewards).to.equal(0);

        let earned = await poolManager.earned(deployer.address);
        expect(earned).to.equal(0);

        let poolRewardPerTokenPaid = await poolManager.poolRewardPerTokenPaid(deployer.address);
        expect(poolRewardPerTokenPaid).to.equal(0);

        let totalAvailableRewards = await stakingRewards.totalAvailableRewards();
        expect(totalAvailableRewards).to.equal(0);

        let farmRewardPerTokenStored = await stakingRewards.rewardPerTokenStored();
        expect(farmRewardPerTokenStored).to.equal(0);
    });
    
    it("rewards available; one pool eligible, no other pools", async () => {
        let scaledWeight = BigInt(1e18) * BigInt(100) / BigInt(86400 * 7 * 2);
        let expectedAvailableTokens = BigInt(400 * 1e18);
        let expectedRewardPerToken = expectedAvailableTokens * BigInt(1e18) / scaledWeight;

        let tx = await poolManager.setPoolInfo(deployer.address, true, true, stakingRewardsAddress, 0, 1000, 2, 800, 1, 0, 0);
        await tx.wait();

        let tx2 = await poolManager.setGlobalPeriodInfo(0, parseEther("1"));
        await tx2.wait();

        let tx3 = await poolManager.setPoolPeriodInfo(deployer.address, 0, parseEther("1"));
        await tx3.wait();

        let tx4 = await poolManager.setStartTime(current - 100);
        await tx4.wait();

        let tx5 = await poolManager.setLastUpdateTime(current - 100);
        await tx5.wait();

        let tx6 = await stakingToken1.setApprovalForAll(stakingRewardsAddress, true);
        await tx6.wait();

        let tx7 = await stakingRewards.stake(1, 3);
        await tx7.wait();

        let rewardPerToken = await poolManager.rewardPerToken();
        expect((BigInt(rewardPerToken) / BigInt(1e12)).toString()).to.equal((expectedRewardPerToken / BigInt(1e12)).toString());

        let availableRewards = await scheduleCurrent.availableRewards(current - 100);

        let earnedPool = await poolManager.earned(deployer.address);
        let delta = BigInt(availableRewards) + BigInt(1) - BigInt(earnedPool);
        expect(Number(delta)).to.be.lessThanOrEqual(2);

        let tx8 = await stakingRewards.claimLatestRewardsTest(deployer.address);
        await tx8.wait();

        let newEarnedPool = await poolManager.earned(deployer.address);
        expect(newEarnedPool).to.equal(0);

        // Check reward token balances

        let balanceStaking = await rewardToken.balanceOf(scheduleCurrentAddress);
        expect(balanceStaking).to.equal(0);

        let balancePoolManager = await rewardToken.balanceOf(poolManagerAddress);
        expect(Number(balancePoolManager)).to.be.lessThanOrEqual(2);

        let balanceFarm = await rewardToken.balanceOf(stakingRewardsAddress);
        delta = BigInt(balanceFarm) - BigInt(earnedPool);
        expect(Number(delta)).to.be.lessThanOrEqual(Number(parseEther("4")));

        // Check PoolManager state

        // 17 seconds difference between local time and block.timestamp
        let lastUpdateTime = await poolManager.lastUpdateTime();
        expect(lastUpdateTime).to.equal(Number(current) + 17);

        let newRewards = await poolManager.rewards(deployer.address);
        expect(newRewards).to.equal(0);

        let poolRewardPerTokenPaid = await poolManager.poolRewardPerTokenPaid(deployer.address);
        expect((BigInt(poolRewardPerTokenPaid.toString()) / BigInt(1e12)).toString()).to.equal((expectedRewardPerToken / BigInt(1e12)).toString());

        // Check farm's state

        let totalAvailableRewards = await stakingRewards.totalAvailableRewards();
        expect(totalAvailableRewards).to.equal(balanceFarm);

        let farmRewardPerTokenStored = await stakingRewards.rewardPerTokenStored();
        let expectedFarmRewardPerTokenStored = BigInt(balanceFarm) / BigInt(10);
        delta = BigInt(farmRewardPerTokenStored) - BigInt(expectedFarmRewardPerTokenStored);
        expect(Number(delta)).to.be.lessThanOrEqual(1);

        let earnedFarm = await stakingRewards.earned(deployer.address);
        delta = BigInt(earnedFarm) - BigInt(balanceFarm);
        expect(Number(delta)).to.be.lessThanOrEqual(1);
    });

    it("rewards available; one pool eligible, other pool has 0 weight", async () => {
        let scaledWeight = BigInt(1e18) * BigInt(100) / BigInt(86400 * 7 * 2);
        let expectedAvailableTokens = BigInt(400 * 1e18);
        let expectedRewardPerToken = expectedAvailableTokens * BigInt(1e18) / scaledWeight;
        
        let stakingRewards2 = await StakingRewardsFactory.deploy(poolManagerAddress, rewardTokenAddress, stakingTokenAddress1, scheduleCurrentAddress);
        await stakingRewards2.deployed();
        let stakingRewardsAddress2 = stakingRewards2.address;

        let tx = await poolManager.setPoolInfo(deployer.address, true, true, stakingRewardsAddress, 0, 1000, 2, 800, 1, 0, 0);
        await tx.wait();

        let tx2 = await poolManager.setPoolInfo(otherUser.address, true, true, stakingRewardsAddress2, 0, 1000, 2, 800, 1, 0, 0);
        await tx2.wait();

        let tx3 = await poolManager.setGlobalPeriodInfo(0, parseEther("1"));
        await tx3.wait();

        let tx4 = await poolManager.setPoolPeriodInfo(deployer.address, 0, parseEther("1"));
        await tx4.wait();

        let tx5 = await poolManager.setPoolPeriodInfo(otherUser.address, 0, 0);
        await tx5.wait();

        let tx6 = await poolManager.setStartTime(current - 100);
        await tx6.wait();

        let tx7 = await poolManager.setLastUpdateTime(current - 100);
        await tx7.wait();

        let tx8 = await stakingToken1.setApprovalForAll(stakingRewardsAddress, true);
        await tx8.wait();

        let tx9 = await stakingRewards.stake(1, 3);
        await tx9.wait();

        let tx10 = await stakingToken1.setApprovalForAll(stakingRewardsAddress2, true);
        await tx10.wait();

        let tx11 = await stakingRewards2.stake(1, 3);
        await tx11.wait();

        let rewardPerToken = await poolManager.rewardPerToken();
        expect((BigInt(rewardPerToken) / BigInt(1e12)).toString()).to.equal((expectedRewardPerToken / BigInt(1e12)).toString());

        let availableRewards = await scheduleCurrent.availableRewards(current - 100);

        let earnedPool1 = await poolManager.earned(deployer.address);
        let delta = BigInt(availableRewards) + BigInt(1) - BigInt(earnedPool1);
        expect(Number(delta)).to.be.lessThanOrEqual(2);

        let earnedPool2 = await poolManager.earned(otherUser.address);
        expect(earnedPool2).to.equal(0);

        let tx12 = await stakingRewards.claimLatestRewardsTest(deployer.address);
        await tx12.wait();

        let newEarnedPool1 = await poolManager.earned(deployer.address);
        expect(newEarnedPool1).to.equal(0);

        let tx13 = await stakingRewards2.claimLatestRewardsTest(otherUser.address);
        await tx13.wait();

        let newEarnedPool2 = await poolManager.earned(otherUser.address);
        expect(newEarnedPool2).to.equal(0);

        // Check reward token balances

        let balanceStaking = await rewardToken.balanceOf(scheduleCurrentAddress);
        expect(balanceStaking).to.equal(0);

        // Account for 1 second delay
        let balancePoolManager = await rewardToken.balanceOf(poolManagerAddress);
        expect(Number(balancePoolManager)).to.be.lessThanOrEqual(Number(parseEther("4")));

        let balanceFarm = await rewardToken.balanceOf(stakingRewardsAddress);
        delta = BigInt(balanceFarm) - BigInt(earnedPool1);
        expect(Number(delta)).to.be.lessThanOrEqual(Number(parseEther("4")));
        
        let balanceFarm2 = await rewardToken.balanceOf(stakingRewardsAddress2);
        expect(balanceFarm2).to.equal(0);

        // Check PoolManager state

        let newRewards = await poolManager.rewards(deployer.address);
        expect(newRewards).to.equal(0);

        let newRewards2 = await poolManager.rewards(otherUser.address);
        expect(newRewards2).to.equal(0);

        let poolRewardPerTokenPaid = await poolManager.poolRewardPerTokenPaid(deployer.address);
        expect((BigInt(poolRewardPerTokenPaid.toString()) / BigInt(1e12)).toString()).to.equal((expectedRewardPerToken / BigInt(1e12)).toString());

        // 23 seconds delay from when contracts were deployed
        let scaledWeight2 = BigInt(1e18) * BigInt(123) / BigInt(86400 * 7 * 2);
        let expectedAvailableTokens2 = BigInt(4 * 1e18);
        let expectedRewardPerToken2 = expectedRewardPerToken + (expectedAvailableTokens2 * BigInt(1e18) / scaledWeight2);

        let poolRewardPerTokenPaid2 = await poolManager.poolRewardPerTokenPaid(otherUser.address);
        expect((BigInt(poolRewardPerTokenPaid2.toString()) / BigInt(1e12)).toString()).to.equal((expectedRewardPerToken2 / BigInt(1e12)).toString());

        // Check first farm's state

        let totalAvailableRewards = await stakingRewards.totalAvailableRewards();
        expect(totalAvailableRewards).to.equal(balanceFarm);

        let farmRewardPerTokenStored = await stakingRewards.rewardPerTokenStored();
        let expectedFarmRewardPerTokenStored = BigInt(balanceFarm) / BigInt(10);
        delta = BigInt(farmRewardPerTokenStored) - BigInt(expectedFarmRewardPerTokenStored);
        expect(Number(delta)).to.be.lessThanOrEqual(1);

        let earnedFarm = await stakingRewards.earned(deployer.address);
        delta = BigInt(earnedFarm) - BigInt(balanceFarm);
        expect(Number(delta)).to.be.lessThanOrEqual(1);

        // Check second farm's state

        let totalAvailableRewards2 = await stakingRewards2.totalAvailableRewards();
        expect(totalAvailableRewards2).to.equal(0);

        let farmRewardPerTokenStored2 = await stakingRewards2.rewardPerTokenStored();
        expect(farmRewardPerTokenStored2).to.equal(0);

        let earnedFarm2 = await stakingRewards2.earned(deployer.address);
        expect(earnedFarm2).to.equal(0);
    });

    it("rewards available; both pools eligible, one has stakers and other doesn't", async () => {
        let scaledWeight = BigInt(2e18) * BigInt(100) / BigInt(86400 * 7 * 2);
        let expectedAvailableTokens = BigInt(400 * 1e18);
        let expectedRewardPerToken = expectedAvailableTokens * BigInt(1e18) / scaledWeight;
        
        let stakingRewards2 = await StakingRewardsFactory.deploy(poolManagerAddress, rewardTokenAddress, stakingTokenAddress1, scheduleCurrentAddress);
        await stakingRewards2.deployed();
        let stakingRewardsAddress2 = stakingRewards2.address;

        let tx = await poolManager.setPoolInfo(deployer.address, true, true, stakingRewardsAddress, 0, 1000, 2, 800, 1, 0, 0);
        await tx.wait();

        let tx2 = await poolManager.setPoolInfo(otherUser.address, true, true, stakingRewardsAddress2, 0, 1000, 2, 800, 1, 0, 0);
        await tx2.wait();

        let tx3 = await poolManager.setGlobalPeriodInfo(0, parseEther("2"));
        await tx3.wait();

        let tx4 = await poolManager.setPoolPeriodInfo(deployer.address, 0, parseEther("1"));
        await tx4.wait();

        let tx5 = await poolManager.setPoolPeriodInfo(otherUser.address, 0, parseEther("1"));
        await tx5.wait();

        let tx6 = await poolManager.setStartTime(current - 100);
        await tx6.wait();

        let tx7 = await poolManager.setLastUpdateTime(current - 100);
        await tx7.wait();

        let tx8 = await stakingToken1.setApprovalForAll(stakingRewardsAddress, true);
        await tx8.wait();

        let tx9 = await stakingRewards.stake(1, 3);
        await tx9.wait();

        let rewardPerToken = await poolManager.rewardPerToken();
        expect((BigInt(rewardPerToken) / BigInt(1e12)).toString()).to.equal((expectedRewardPerToken / BigInt(1e12)).toString());

        let tx10 = await stakingRewards.claimLatestRewardsTest(deployer.address);
        await tx10.wait();

        let newEarnedPool1 = await poolManager.earned(deployer.address);
        expect(newEarnedPool1).to.equal(0);

        let tx11 = await stakingRewards2.claimLatestRewardsTest(otherUser.address);
        await tx11.wait();

        let newEarnedPool2 = await poolManager.earned(otherUser.address);
        expect(newEarnedPool2).to.equal(0);

        // Check reward token balances

        // Account for 1 second delay
        let balancePoolManager = await rewardToken.balanceOf(poolManagerAddress);
        expect(Number(balancePoolManager)).to.be.lessThanOrEqual(Number(parseEther("4")));

        // Rewards for first pool are transferred to farm
        let balanceFarm = await rewardToken.balanceOf(stakingRewardsAddress);
        expect(Number(balanceFarm)).to.be.greaterThanOrEqual(0);
        
        let balanceFarm2 = await rewardToken.balanceOf(stakingRewardsAddress2);
        expect(balanceFarm2).to.equal(0);

        // Check PoolManager state

        let newRewards = await poolManager.rewards(deployer.address);
        expect(newRewards).to.equal(0);

        let newRewards2 = await poolManager.rewards(otherUser.address);
        expect(newRewards2).to.equal(0);

        let poolRewardPerTokenPaid = await poolManager.poolRewardPerTokenPaid(deployer.address);
        expect((BigInt(poolRewardPerTokenPaid.toString()) / BigInt(1e12)).toString()).to.equal((expectedRewardPerToken / BigInt(1e12)).toString());

        // 21 seconds delay from when contracts were deployed
        let scaledWeight2 = BigInt(2e18) * BigInt(121) / BigInt(86400 * 7 * 2);
        let expectedAvailableTokens2 = BigInt(4 * 1e18);
        let expectedRewardPerToken2 = expectedRewardPerToken + (expectedAvailableTokens2 * BigInt(1e18) / scaledWeight2);

        let poolRewardPerTokenPaid2 = await poolManager.poolRewardPerTokenPaid(otherUser.address);
        expect((BigInt(poolRewardPerTokenPaid2.toString()) / BigInt(1e12)).toString()).to.equal((expectedRewardPerToken2 / BigInt(1e12)).toString());

        // Check first farm's state

        let totalAvailableRewards = await stakingRewards.totalAvailableRewards();
        expect(totalAvailableRewards).to.equal(balanceFarm);

        let farmRewardPerTokenStored = await stakingRewards.rewardPerTokenStored();
        let expectedFarmRewardPerTokenStored = BigInt(balanceFarm) / BigInt(10);
        delta = BigInt(farmRewardPerTokenStored) - BigInt(expectedFarmRewardPerTokenStored);
        expect(Number(delta)).to.be.lessThanOrEqual(1);

        let earnedFarm = await stakingRewards.earned(deployer.address);
        delta = BigInt(earnedFarm) - BigInt(balanceFarm);
        expect(Number(delta)).to.be.lessThanOrEqual(1);

        // Check second farm's state

        let totalAvailableRewards2 = await stakingRewards2.totalAvailableRewards();
        expect(totalAvailableRewards2).to.equal(0);

        let farmRewardPerTokenStored2 = await stakingRewards2.rewardPerTokenStored();
        expect(farmRewardPerTokenStored2).to.equal(0);

        let earnedFarm2 = await stakingRewards2.earned(deployer.address);
        expect(earnedFarm2).to.equal(0);
    });

    it("rewards available; both pools eligible, both have stakers", async () => {
        let scaledWeight = BigInt(2e18) * BigInt(100) / BigInt(86400 * 7 * 2);
        let expectedAvailableTokens = BigInt(400 * 1e18);
        let expectedRewardPerToken = expectedAvailableTokens * BigInt(1e18) / scaledWeight;
        
        let stakingRewards2 = await StakingRewardsFactory.deploy(poolManagerAddress, rewardTokenAddress, stakingTokenAddress1, scheduleCurrentAddress);
        await stakingRewards2.deployed();
        let stakingRewardsAddress2 = stakingRewards2.address;

        let tx = await poolManager.setPoolInfo(deployer.address, true, true, stakingRewardsAddress, 0, 1000, 2, 800, 1, 0, 0);
        await tx.wait();

        let tx2 = await poolManager.setPoolInfo(otherUser.address, true, true, stakingRewardsAddress2, 0, 1000, 2, 800, 1, 0, 0);
        await tx2.wait();

        let tx3 = await poolManager.setGlobalPeriodInfo(0, parseEther("2"));
        await tx3.wait();

        let tx4 = await poolManager.setPoolPeriodInfo(deployer.address, 0, parseEther("1"));
        await tx4.wait();

        let tx5 = await poolManager.setPoolPeriodInfo(otherUser.address, 0, parseEther("1"));
        await tx5.wait();

        let tx6 = await poolManager.setStartTime(current - 100);
        await tx6.wait();

        let tx7 = await poolManager.setLastUpdateTime(current - 100);
        await tx7.wait();

        let tx8 = await stakingToken1.setApprovalForAll(stakingRewardsAddress, true);
        await tx8.wait();

        let tx9 = await stakingRewards.stake(1, 3);
        await tx9.wait();

        let tx10 = await stakingToken1.setApprovalForAll(stakingRewardsAddress2, true);
        await tx10.wait();

        let tx11 = await stakingRewards2.stake(1, 3);
        await tx11.wait();

        let rewardPerToken = await poolManager.rewardPerToken();
        expect((BigInt(rewardPerToken) / BigInt(1e12)).toString()).to.equal((expectedRewardPerToken / BigInt(1e12)).toString());

        let tx12 = await stakingRewards.claimLatestRewardsTest(deployer.address);
        await tx12.wait();

        let newEarnedPool1 = await poolManager.earned(deployer.address);
        expect(newEarnedPool1).to.equal(0);

        let tx13 = await stakingRewards2.claimLatestRewardsTest(otherUser.address);
        await tx13.wait();

        let newEarnedPool2 = await poolManager.earned(otherUser.address);
        expect(newEarnedPool2).to.equal(0);

        // Check reward token balances

        let balanceStaking = await rewardToken.balanceOf(scheduleCurrentAddress);
        expect(balanceStaking).to.equal(0);

        // Account for 1 second delay
        let balancePoolManager = await rewardToken.balanceOf(poolManagerAddress);
        expect(Number(balancePoolManager)).to.be.lessThanOrEqual(Number(parseEther("4")));

        // Rewards for first pool are transferred to farm
        let balanceFarm = await rewardToken.balanceOf(stakingRewardsAddress);
        expect(Number(balanceFarm)).to.be.greaterThanOrEqual(0);
        
        // Rewards for second pool are transferred to farm
        let balanceFarm2 = await rewardToken.balanceOf(stakingRewardsAddress2);
        expect(Number(balanceFarm2)).to.be.greaterThanOrEqual(0);

        // Check PoolManager state

        let newRewards = await poolManager.rewards(deployer.address);
        expect(newRewards).to.equal(0);

        let newRewards2 = await poolManager.rewards(otherUser.address);
        expect(newRewards2).to.equal(0);

        let poolRewardPerTokenPaid = await poolManager.poolRewardPerTokenPaid(deployer.address);
        expect((BigInt(poolRewardPerTokenPaid.toString()) / BigInt(1e12)).toString()).to.equal((expectedRewardPerToken / BigInt(1e12)).toString());

        // 23 seconds delay from when contracts were deployed
        let scaledWeight2 = BigInt(2e18) * BigInt(123) / BigInt(86400 * 7 * 2);
        let expectedAvailableTokens2 = BigInt(4 * 1e18);
        let expectedRewardPerToken2 = expectedRewardPerToken + (expectedAvailableTokens2 * BigInt(1e18) / scaledWeight2);

        let poolRewardPerTokenPaid2 = await poolManager.poolRewardPerTokenPaid(otherUser.address);
        expect((BigInt(poolRewardPerTokenPaid2.toString()) / BigInt(1e12)).toString()).to.equal((expectedRewardPerToken2 / BigInt(1e12)).toString());

        // Check first farm's state

        let totalAvailableRewards = await stakingRewards.totalAvailableRewards();
        expect(totalAvailableRewards).to.equal(balanceFarm);

        let farmRewardPerTokenStored = await stakingRewards.rewardPerTokenStored();
        let expectedFarmRewardPerTokenStored = BigInt(balanceFarm) / BigInt(10);
        delta = BigInt(farmRewardPerTokenStored) - BigInt(expectedFarmRewardPerTokenStored);
        expect(Number(delta)).to.be.lessThanOrEqual(1);

        let earnedFarm = await stakingRewards.earned(deployer.address);
        delta = BigInt(earnedFarm) - BigInt(balanceFarm);
        expect(Number(delta)).to.be.lessThanOrEqual(1);

        // Check second farm's state

        let totalAvailableRewards2 = await stakingRewards2.totalAvailableRewards();
        expect(totalAvailableRewards2).to.equal(balanceFarm2);

        let farmRewardPerTokenStored2 = await stakingRewards2.rewardPerTokenStored();
        let expectedFarmRewardPerTokenStored2 = BigInt(balanceFarm2) / BigInt(10);
        delta = BigInt(farmRewardPerTokenStored2) - BigInt(expectedFarmRewardPerTokenStored2);
        expect(Number(delta)).to.be.lessThanOrEqual(1);

        let earnedFarm2 = await stakingRewards2.earned(deployer.address);
        delta = BigInt(earnedFarm2) - BigInt(balanceFarm2);
        expect(Number(delta)).to.be.lessThanOrEqual(1);
    });

    it("pool has rewards available but farm has no stakers", async () => {
        let scaledWeight = BigInt(1e18) * BigInt(100) / BigInt(86400 * 7 * 2);
        let expectedAvailableTokens = BigInt(400 * 1e18);
        let expectedRewardPerToken = expectedAvailableTokens * BigInt(1e18) / scaledWeight;

        let tx = await poolManager.setPoolInfo(deployer.address, true, true, stakingRewardsAddress, 0, 1000, 2, 800, 1, 0, 0);
        await tx.wait();

        let tx2 = await poolManager.setGlobalPeriodInfo(0, parseEther("1"));
        await tx2.wait();

        let tx3 = await poolManager.setPoolPeriodInfo(deployer.address, 0, parseEther("1"));
        await tx3.wait();

        let tx4 = await poolManager.setStartTime(current - 100);
        await tx4.wait();

        let tx5 = await poolManager.setLastUpdateTime(current - 100);
        await tx5.wait();

        let rewardPerToken = await poolManager.rewardPerToken();
        expect((BigInt(rewardPerToken) / BigInt(1e12)).toString()).to.equal((expectedRewardPerToken / BigInt(1e12)).toString());

        let availableRewards = await scheduleCurrent.availableRewards(current - 100);

        let earnedPool = await poolManager.earned(deployer.address);
        let delta = BigInt(availableRewards) + BigInt(1) - BigInt(earnedPool);
        expect(Number(delta)).to.be.lessThanOrEqual(2);

        let tx6 = await stakingRewards.claimLatestRewardsTest(deployer.address);
        await tx6.wait();

        let newEarnedPool = await poolManager.earned(deployer.address);
        expect(newEarnedPool).to.equal(0);

        // Check reward token balances

        let balanceStaking = await rewardToken.balanceOf(scheduleCurrentAddress);
        delta = BigInt(balanceStaking) - BigInt(earnedPool);
        expect(Number(delta)).to.be.lessThanOrEqual(Number(parseEther("4")));

        let balancePoolManager = await rewardToken.balanceOf(poolManagerAddress);
        expect(Number(balancePoolManager)).to.be.lessThanOrEqual(2);

        let balanceFarm = await rewardToken.balanceOf(stakingRewardsAddress);
        expect(balanceFarm).to.equal(0);

        // Check PoolManager state

        let newRewards = await poolManager.rewards(deployer.address);
        expect(newRewards).to.equal(0);

        let poolRewardPerTokenPaid = await poolManager.poolRewardPerTokenPaid(deployer.address);
        expect((BigInt(poolRewardPerTokenPaid.toString()) / BigInt(1e12)).toString()).to.equal((expectedRewardPerToken / BigInt(1e12)).toString());

        // Check farm's state

        let totalAvailableRewards = await stakingRewards.totalAvailableRewards();
        expect(totalAvailableRewards).to.equal(0);

        let farmRewardPerTokenStored = await stakingRewards.rewardPerTokenStored();
        expect(farmRewardPerTokenStored).to.equal(0);

        let earnedFarm = await stakingRewards.earned(deployer.address);
        expect(earnedFarm).to.equal(0);
    });

    it("rewards available, pool claims rewards, more rewards added", async () => {
        let scaledWeight = BigInt(1e18) * BigInt(100) / BigInt(86400 * 7 * 2);
        let expectedAvailableTokens = BigInt(400 * 1e18);
        let expectedRewardPerToken = BigInt(2) * expectedAvailableTokens * BigInt(1e18) / scaledWeight;

        let tx = await poolManager.setPoolInfo(deployer.address, true, true, stakingRewardsAddress, 0, 1000, 2, 800, 1, 0, 0);
        await tx.wait();

        let tx2 = await poolManager.setGlobalPeriodInfo(0, parseEther("1"));
        await tx2.wait();

        let tx3 = await poolManager.setPoolPeriodInfo(deployer.address, 0, parseEther("1"));
        await tx3.wait();

        let tx4 = await poolManager.setStartTime(current - 100);
        await tx4.wait();

        let tx5 = await poolManager.setLastUpdateTime(current - 100);
        await tx5.wait();

        let tx6 = await stakingToken1.setApprovalForAll(stakingRewardsAddress, true);
        await tx6.wait();

        let tx7 = await stakingRewards.stake(1, 3);
        await tx7.wait();

        let tx8 = await stakingRewards.claimLatestRewardsTest(deployer.address);
        await tx8.wait();

        // Reset timestamps to simulate more rewards being added

        let tx9 = await poolManager.setStartTime(current - 100);
        await tx9.wait();

        let tx10 = await poolManager.setLastUpdateTime(current - 100);
        await tx10.wait();

        let tx11 = await releaseEscrowCurrent.setLastWithdrawalTime(current - 100);
        await tx11.wait();

        let rewardPerToken = await poolManager.rewardPerToken();
        expect((BigInt(rewardPerToken) / BigInt(1e12)).toString()).to.equal((expectedRewardPerToken / BigInt(1e12)).toString());

        let availableRewards = await scheduleCurrent.availableRewards(current - 100);

        let earnedPool = await poolManager.earned(deployer.address);
        let delta = BigInt(availableRewards) + BigInt(1) - BigInt(earnedPool);
        expect(Number(delta)).to.be.lessThanOrEqual(2);

        let tx12 = await stakingRewards.claimLatestRewardsTest(deployer.address);
        await tx12.wait();

        let newEarnedPool = await poolManager.earned(deployer.address);
        expect(newEarnedPool).to.equal(0);

        // Check reward token balances

        let balanceStaking = await rewardToken.balanceOf(scheduleCurrentAddress);
        expect(balanceStaking).to.equal(0);

        let balancePoolManager = await rewardToken.balanceOf(poolManagerAddress);
        expect(Number(balancePoolManager)).to.be.lessThanOrEqual(2);

        let balanceFarm = await rewardToken.balanceOf(stakingRewardsAddress);
        let expectedBalanceFarm = (BigInt(460) * BigInt(1e18)) + (BigInt(484) * BigInt(1e18));
        delta = BigInt(expectedBalanceFarm) - BigInt(balanceFarm);
        expect(Number(delta)).to.be.lessThanOrEqual(2);

        // Check PoolManager state

        let newRewards = await poolManager.rewards(deployer.address);
        expect(newRewards).to.equal(0);

        let poolRewardPerTokenPaid = await poolManager.poolRewardPerTokenPaid(deployer.address);
        expect((BigInt(poolRewardPerTokenPaid.toString()) / BigInt(1e12)).toString()).to.equal((expectedRewardPerToken / BigInt(1e12)).toString());

        // Check farm's state

        let totalAvailableRewards = await stakingRewards.totalAvailableRewards();
        delta = BigInt(expectedBalanceFarm) - BigInt(totalAvailableRewards);
        expect(Number(delta)).to.be.lessThanOrEqual(2);

        let farmRewardPerTokenStored = await stakingRewards.rewardPerTokenStored();
        let expectedFarmRewardPerTokenStored = BigInt(balanceFarm) / BigInt(10);
        delta = BigInt(farmRewardPerTokenStored) - BigInt(expectedFarmRewardPerTokenStored);
        expect(Number(delta)).to.be.lessThanOrEqual(1);

        let earnedFarm = await stakingRewards.earned(deployer.address);
        delta = BigInt(totalAvailableRewards) - BigInt(earnedFarm);
        expect(Number(delta)).to.be.lessThanOrEqual(20);
    });

    it("rewards available, one pool claims rewards and other pool doesn't, more rewards added", async () => {
        let scaledWeight = BigInt(1e18) * BigInt(100) / BigInt(86400 * 7 * 2);
        let expectedAvailableTokens = BigInt(400 * 1e18);
        let expectedRewardPerToken = BigInt(2) * expectedAvailableTokens * BigInt(1e18) / scaledWeight;

        let tx = await poolManager.setPoolInfo(deployer.address, true, true, stakingRewardsAddress, 0, 1000, 2, 800, 1, 0, 0);
        await tx.wait();

        let tx2 = await poolManager.setGlobalPeriodInfo(0, parseEther("1"));
        await tx2.wait();

        let tx3 = await poolManager.setPoolPeriodInfo(deployer.address, 0, parseEther("1"));
        await tx3.wait();

        let tx4 = await poolManager.setStartTime(current - 100);
        await tx4.wait();

        let tx5 = await poolManager.setLastUpdateTime(current - 100);
        await tx5.wait();

        let tx6 = await stakingToken1.setApprovalForAll(stakingRewardsAddress, true);
        await tx6.wait();

        let tx7 = await stakingRewards.stake(1, 3);
        await tx7.wait();

        let tx8 = await stakingRewards.claimLatestRewardsTest(deployer.address);
        await tx8.wait();

        // Reset timestamps to simulate more rewards being added

        let tx9 = await poolManager.setStartTime(current - 100);
        await tx9.wait();

        let tx10 = await poolManager.setLastUpdateTime(current - 100);
        await tx10.wait();

        let tx11 = await releaseEscrowCurrent.setLastWithdrawalTime(current - 100);
        await tx11.wait();

        let rewardPerToken = await poolManager.rewardPerToken();
        expect((BigInt(rewardPerToken) / BigInt(1e12)).toString()).to.equal((expectedRewardPerToken / BigInt(1e12)).toString());

        let availableRewards = await scheduleCurrent.availableRewards(current - 100);

        let earnedPool = await poolManager.earned(deployer.address);
        let delta = BigInt(availableRewards) + BigInt(1) - BigInt(earnedPool);
        expect(Number(delta)).to.be.lessThanOrEqual(2);

        let tx12 = await stakingRewards.claimLatestRewardsTest(deployer.address);
        await tx12.wait();

        let newEarnedPool = await poolManager.earned(deployer.address);
        expect(newEarnedPool).to.equal(0);

        // Check reward token balances

        let balanceStaking = await rewardToken.balanceOf(scheduleCurrentAddress);
        expect(balanceStaking).to.equal(0);

        let balancePoolManager = await rewardToken.balanceOf(poolManagerAddress);
        expect(Number(balancePoolManager)).to.be.lessThanOrEqual(2);

        let balanceFarm = await rewardToken.balanceOf(stakingRewardsAddress);
        let expectedBalanceFarm = (BigInt(460) * BigInt(1e18)) + (BigInt(484) * BigInt(1e18));
        delta = BigInt(expectedBalanceFarm) - BigInt(balanceFarm);
        expect(Number(delta)).to.be.lessThanOrEqual(2);

        // Check PoolManager state

        let newRewards = await poolManager.rewards(deployer.address);
        expect(newRewards).to.equal(0);

        let poolRewardPerTokenPaid = await poolManager.poolRewardPerTokenPaid(deployer.address);
        expect((BigInt(poolRewardPerTokenPaid.toString()) / BigInt(1e12)).toString()).to.equal((expectedRewardPerToken / BigInt(1e12)).toString());

        // Check farm's state

        let totalAvailableRewards = await stakingRewards.totalAvailableRewards();
        delta = BigInt(expectedBalanceFarm) - BigInt(totalAvailableRewards);
        expect(Number(delta)).to.be.lessThanOrEqual(2);

        let farmRewardPerTokenStored = await stakingRewards.rewardPerTokenStored();
        let expectedFarmRewardPerTokenStored = BigInt(balanceFarm) / BigInt(10);
        delta = BigInt(farmRewardPerTokenStored) - BigInt(expectedFarmRewardPerTokenStored);
        expect(Number(delta)).to.be.lessThanOrEqual(1);

        let earnedFarm = await stakingRewards.earned(deployer.address);
        delta = BigInt(totalAvailableRewards) - BigInt(earnedFarm);
        expect(Number(delta)).to.be.lessThanOrEqual(20);
    });
  });
  
  describe("#updateWeight", () => {
    let current;
    beforeEach(async () => {
        current = await poolManager.getCurrentTime();

        rewardToken = await RewardTokenFactory.deploy("Test Token", "TEST");
        await rewardToken.deployed();
        rewardTokenAddress = rewardToken.address;

        scheduleCurrent = await ScheduleFactory.deploy(parseEther((4 * CYCLE_DURATION).toString()), current - 100);
        await scheduleCurrent.deployed();
        scheduleCurrentAddress = scheduleCurrent.address;
    
        // Using scheduleCurrentAddress as xTGEN
        stakingRewardsFactory = await StakingRewardsFactoryFactory.deploy(rewardTokenAddress, scheduleCurrentAddress);
        await stakingRewardsFactory.deployed();
        stakingRewardsFactoryAddress = stakingRewardsFactory.address;

        poolManager = await PoolManagerFactory.deploy(rewardTokenAddress, scheduleCurrentAddress, deployer.address, stakingRewardsFactoryAddress, rewardTokenAddress, scheduleCurrentAddress);
        await poolManager.deployed();
        poolManagerAddress = poolManager.address;

        releaseEscrowCurrent = await ReleaseEscrowFactory.deploy(poolManagerAddress, rewardTokenAddress, scheduleCurrentAddress, current - 100);
        await releaseEscrowCurrent.deployed();
        releaseEscrowCurrentAddress = releaseEscrowCurrent.address;

        stakingRewards = await StakingRewardsFactory.deploy(poolManagerAddress, rewardTokenAddress, stakingTokenAddress1, scheduleCurrentAddress);
        await stakingRewards.deployed();
        stakingRewardsAddress = stakingRewards.address;
    
        // Transfer tokens to ReleaseEscrowCurrent
        let tx = await rewardToken.approve(releaseEscrowCurrentAddress, parseEther((8 * CYCLE_DURATION).toString()));
        await tx.wait();
        let tx2 = await rewardToken.transfer(releaseEscrowCurrentAddress, parseEther((8 * CYCLE_DURATION).toString()));
        await tx2.wait();
    
        // Set the PoolManager's ReleaseEscrow address
        let tx3 = await poolManager.setReleaseEscrow(releaseEscrowCurrentAddress);
        await tx3.wait();
    });
    
    it("update weights for first time in period 0; one pool", async () => {
        let tx = await poolManager.setPoolInfo(deployer.address, true, true, stakingRewardsAddress, parseEther("10"), parseEther("1.2"), 0, parseEther("1"), 0, current - 100, current - 100);
        await tx.wait();

        let tx2 = await poolManager.setGlobalAPCVariables(0, 0);
        await tx2.wait();

        let tx3 = await poolManager.updateWeight(parseEther("10"), parseEther("1.2"));
        await tx3.wait();

        // 12 seconds difference between local time and block.timestamp
        let lastUpdateTime = await poolManager.lastUpdateTime();
        expect(lastUpdateTime).to.equal(Number(current) + 12);

        let poolAPC = await poolManager.poolAPC(deployer.address);
        expect(poolAPC).to.equal(200);

        let totalDuration = await poolManager.totalDuration();
        expect(totalDuration).to.equal(112);

        let totalWeightedAPC = await poolManager.totalWeightedAPC();
        expect(totalWeightedAPC).to.equal(22400);

        let poolWeightPeriod0 = await poolManager.poolPeriods(deployer.address, 0);
        expect(poolWeightPeriod0).to.equal(parseEther("10"));

        let globalWeightPeriod0 = await poolManager.globalPeriods(0);
        expect(globalWeightPeriod0).to.equal(parseEther("10"));

        let poolInfo = await poolManager.pools(deployer.address);
        console.log(poolInfo);
        expect(poolInfo.unrealizedProfits).to.equal(parseEther("10"));
        expect(poolInfo.latestRecordedPrice).to.equal(parseEther("1.2"));
        expect(poolInfo.previousRecordedPrice).to.equal(parseEther("1"));
        expect(poolInfo.previousRecordedPeriodIndex).to.equal(0);
        expect(poolInfo.latestRecordedPeriodIndex).to.equal(0);
        expect(poolInfo.lastUpdated).to.equal(Number(current) + 12);
    });

    it("update weights multiple times in period 0; one pool", async () => {
        let tx = await poolManager.setPoolInfo(deployer.address, true, true, stakingRewardsAddress, parseEther("10"), parseEther("1.2"), 0, parseEther("1"), 0, current - 100, current - 100);
        await tx.wait();

        let tx2 = await poolManager.setGlobalAPCVariables(0, 0);
        await tx2.wait();

        let tx3 = await poolManager.updateWeight(parseEther("10"), parseEther("1.2"));
        await tx3.wait();

        let tx4 = await poolManager.updateWeight(parseEther("20"), parseEther("1.3"));
        await tx4.wait();

        // 13 seconds difference between local time and block.timestamp
        let lastUpdateTime = await poolManager.lastUpdateTime();
        expect(lastUpdateTime).to.equal(Number(current) + 13);

        let poolAPC = await poolManager.poolAPC(deployer.address);
        expect(poolAPC).to.equal(300);

        let totalDuration = await poolManager.totalDuration();
        expect(totalDuration).to.equal(113);

        let totalWeightedAPC = await poolManager.totalWeightedAPC();
        expect(totalWeightedAPC).to.equal(33900);

        let poolWeightPeriod0 = await poolManager.poolPeriods(deployer.address, 0);
        expect(poolWeightPeriod0).to.equal(parseEther("20"));

        let globalWeightPeriod0 = await poolManager.globalPeriods(0);
        expect(globalWeightPeriod0).to.equal(parseEther("20"));

        let poolInfo = await poolManager.pools(deployer.address);
        console.log(poolInfo);
        expect(poolInfo.unrealizedProfits).to.equal(parseEther("20"));
        expect(poolInfo.latestRecordedPrice).to.equal(parseEther("1.3"));
        expect(poolInfo.previousRecordedPrice).to.equal(parseEther("1"));
        expect(poolInfo.previousRecordedPeriodIndex).to.equal(0);
        expect(poolInfo.latestRecordedPeriodIndex).to.equal(0);
        expect(poolInfo.lastUpdated).to.equal(Number(current) + 13);
    });

    // Simulate multiple pools by initializing global APC variables to non-zero values.
    it("update weights multiple times in period 0; multiple pools", async () => {
        let tx = await poolManager.setPoolInfo(deployer.address, true, true, stakingRewardsAddress, parseEther("10"), parseEther("1.2"), 0, parseEther("1"), 0, current - 100, current - 100);
        await tx.wait();

        let tx2 = await poolManager.setGlobalPeriodInfo(0, parseEther("10"));
        await tx2.wait();

        let tx3 = await poolManager.setGlobalAPCVariables(10000, 100);
        await tx3.wait();

        let tx4 = await poolManager.updateWeight(parseEther("10"), parseEther("1.2"));
        await tx4.wait();

        let tx5 = await poolManager.updateWeight(parseEther("20"), parseEther("1.3"));
        await tx5.wait();

        // 14 seconds difference between local time and block.timestamp
        let lastUpdateTime = await poolManager.lastUpdateTime();
        expect(lastUpdateTime).to.equal(Number(current) + 14);

        let poolAPC = await poolManager.poolAPC(deployer.address);
        expect(poolAPC).to.equal(300);

        let totalDuration = await poolManager.totalDuration();
        expect(totalDuration).to.equal(214);

        let totalWeightedAPC = await poolManager.totalWeightedAPC();
        expect(totalWeightedAPC).to.equal(44200);

        let poolWeightPeriod0 = await poolManager.poolPeriods(deployer.address, 0);
        expect(poolWeightPeriod0).to.equal(parseEther("180"));

        let globalWeightPeriod0 = await poolManager.globalPeriods(0);
        expect(globalWeightPeriod0).to.equal(parseEther("190"));

        let poolInfo = await poolManager.pools(deployer.address);
        console.log(poolInfo);
        expect(poolInfo.unrealizedProfits).to.equal(parseEther("20"));
        expect(poolInfo.latestRecordedPrice).to.equal(parseEther("1.3"));
        expect(poolInfo.previousRecordedPrice).to.equal(parseEther("1"));
        expect(poolInfo.previousRecordedPeriodIndex).to.equal(0);
        expect(poolInfo.latestRecordedPeriodIndex).to.equal(0);
        expect(poolInfo.lastUpdated).to.equal(Number(current) + 14);
    });

    // Simulate multiple pools by initializing global APC variables to non-zero values.
    it("update weights multiple times in period 1; multiple pools", async () => {
        rewardToken = await RewardTokenFactory.deploy("Test Token", "TEST");
        await rewardToken.deployed();
        rewardTokenAddress = rewardToken.address;

        scheduleCurrent = await ScheduleFactory.deploy(parseEther((4 * CYCLE_DURATION).toString()), current - 100 - (ONE_WEEK * 2));
        await scheduleCurrent.deployed();
        scheduleCurrentAddress = scheduleCurrent.address;
    
        // Using scheduleCurrentAddress as xTGEN
        stakingRewardsFactory = await StakingRewardsFactoryFactory.deploy(rewardTokenAddress, scheduleCurrentAddress);
        await stakingRewardsFactory.deployed();
        stakingRewardsFactoryAddress = stakingRewardsFactory.address;

        poolManager = await PoolManagerFactory.deploy(rewardTokenAddress, scheduleCurrentAddress, deployer.address, stakingRewardsFactoryAddress, rewardTokenAddress, scheduleCurrentAddress);
        await poolManager.deployed();
        poolManagerAddress = poolManager.address;

        releaseEscrowCurrent = await ReleaseEscrowFactory.deploy(poolManagerAddress, rewardTokenAddress, scheduleCurrentAddress, current - 100 - (ONE_WEEK * 2));
        await releaseEscrowCurrent.deployed();
        releaseEscrowCurrentAddress = releaseEscrowCurrent.address;

        stakingRewards = await StakingRewardsFactory.deploy(poolManagerAddress, rewardTokenAddress, stakingTokenAddress1, scheduleCurrentAddress);
        await stakingRewards.deployed();
        stakingRewardsAddress = stakingRewards.address;
    
        // Transfer tokens to ReleaseEscrowCurrent
        let tx = await rewardToken.approve(releaseEscrowCurrentAddress, parseEther((8 * CYCLE_DURATION).toString()));
        await tx.wait();
        let tx2 = await rewardToken.transfer(releaseEscrowCurrentAddress, parseEther((8 * CYCLE_DURATION).toString()));
        await tx2.wait();
    
        // Set the PoolManager's ReleaseEscrow address
        let tx3 = await poolManager.setReleaseEscrow(releaseEscrowCurrentAddress);
        await tx3.wait();

        let tx4 = await poolManager.setStartTime(current - 100 - (ONE_WEEK * 2));
        await tx4.wait();

        let tx5 = await poolManager.setPoolInfo(deployer.address, true, true, stakingRewardsAddress, parseEther("10"), parseEther("1"), 0, parseEther("1"), 0, current - 100 - (ONE_WEEK * 2), current - 100 - (ONE_WEEK * 2));
        await tx5.wait();

        let tx6 = await poolManager.setGlobalPeriodInfo(1, parseEther("10"));
        await tx6.wait();

        let tx7 = await poolManager.setGlobalAPCVariables(10000, 100);
        await tx7.wait();

        let tx8 = await poolManager.updateWeight(parseEther("10"), parseEther("1.2"));
        await tx8.wait();

        let tx9 = await poolManager.updateWeight(parseEther("20"), parseEther("1.8"));
        await tx9.wait();

        // 24 seconds difference between local time and block.timestamp
        let lastUpdateTime = await poolManager.lastUpdateTime();
        expect(lastUpdateTime).to.equal(Number(current) + 24);

        let poolAPC = await poolManager.poolAPC(deployer.address);
        expect(poolAPC).to.equal(800);

        let totalDuration = await poolManager.totalDuration();
        expect(totalDuration).to.equal(1209824);

        let totalWeightedAPC = await poolManager.totalWeightedAPC();
        expect(totalWeightedAPC).to.equal(967789200);

        let poolWeightPeriod0 = await poolManager.poolPeriods(deployer.address, 0);
        expect(poolWeightPeriod0).to.equal(0);

        let globalWeightPeriod0 = await poolManager.globalPeriods(0);
        expect(globalWeightPeriod0).to.equal(0);

        let poolWeightPeriod1 = await poolManager.poolPeriods(deployer.address, 1);
        expect(poolWeightPeriod1).to.equal(parseEther("20"));

        let globalWeightPeriod1 = await poolManager.globalPeriods(1);
        expect(globalWeightPeriod1).to.equal(parseEther("30"));

        let poolInfo = await poolManager.pools(deployer.address);
        console.log(poolInfo);
        expect(poolInfo.unrealizedProfits).to.equal(parseEther("20"));
        expect(poolInfo.latestRecordedPrice).to.equal(parseEther("1.8"));
        expect(poolInfo.previousRecordedPrice).to.equal(parseEther("1"));
        expect(poolInfo.previousRecordedPeriodIndex).to.equal(0);
        expect(poolInfo.latestRecordedPeriodIndex).to.equal(1);
        expect(poolInfo.lastUpdated).to.equal(Number(current) + 24);
    });

    // Simulate multiple pools by initializing global APC variables to non-zero values.
    it("update weights multiple times in period 3, with first update in period 0; multiple pools", async () => {
        rewardToken = await RewardTokenFactory.deploy("Test Token", "TEST");
        await rewardToken.deployed();
        rewardTokenAddress = rewardToken.address;

        scheduleCurrent = await ScheduleFactory.deploy(parseEther((4 * CYCLE_DURATION).toString()), current - 100 - (ONE_WEEK * 6));
        await scheduleCurrent.deployed();
        scheduleCurrentAddress = scheduleCurrent.address;
    
        // Using scheduleCurrentAddress as xTGEN
        stakingRewardsFactory = await StakingRewardsFactoryFactory.deploy(rewardTokenAddress, scheduleCurrentAddress);
        await stakingRewardsFactory.deployed();
        stakingRewardsFactoryAddress = stakingRewardsFactory.address;

        poolManager = await PoolManagerFactory.deploy(rewardTokenAddress, scheduleCurrentAddress, deployer.address, stakingRewardsFactoryAddress, rewardTokenAddress, scheduleCurrentAddress);
        await poolManager.deployed();
        poolManagerAddress = poolManager.address;

        releaseEscrowCurrent = await ReleaseEscrowFactory.deploy(poolManagerAddress, rewardTokenAddress, scheduleCurrentAddress, current - 100 - (ONE_WEEK * 6));
        await releaseEscrowCurrent.deployed();
        releaseEscrowCurrentAddress = releaseEscrowCurrent.address;

        stakingRewards = await StakingRewardsFactory.deploy(poolManagerAddress, rewardTokenAddress, stakingTokenAddress1, scheduleCurrentAddress);
        await stakingRewards.deployed();
        stakingRewardsAddress = stakingRewards.address;
    
        // Transfer tokens to ReleaseEscrowCurrent
        let tx = await rewardToken.approve(releaseEscrowCurrentAddress, parseEther((8 * CYCLE_DURATION).toString()));
        await tx.wait();
        let tx2 = await rewardToken.transfer(releaseEscrowCurrentAddress, parseEther((8 * CYCLE_DURATION).toString()));
        await tx2.wait();
    
        // Set the PoolManager's ReleaseEscrow address
        let tx3 = await poolManager.setReleaseEscrow(releaseEscrowCurrentAddress);
        await tx3.wait();

        let tx4 = await poolManager.setStartTime(current - 100 - (ONE_WEEK * 6));
        await tx4.wait();

        let tx5 = await poolManager.setPoolInfo(deployer.address, true, true, stakingRewardsAddress, parseEther("10"), parseEther("1"), 0, parseEther("1"), 0, current - 100 - (ONE_WEEK * 6), current - 100 - (ONE_WEEK * 6));
        await tx5.wait();

        let tx6 = await poolManager.setGlobalPeriodInfo(3, parseEther("10"));
        await tx6.wait();

        // Average APC is 100
        let tx7 = await poolManager.setGlobalAPCVariables(500000000, 5000000);
        await tx7.wait();

        let tx8 = await poolManager.updateWeight(parseEther("10"), parseEther("1.3"));
        await tx8.wait();

        let tx9 = await poolManager.updateWeight(parseEther("20"), parseEther("1.9"));
        await tx9.wait();

        // 24 seconds difference between local time and block.timestamp
        let lastUpdateTime = await poolManager.lastUpdateTime();
        expect(lastUpdateTime).to.equal(Number(current) + 24);

        let poolAPC = await poolManager.poolAPC(deployer.address);
        expect(poolAPC).to.equal(300);

        let totalDuration = await poolManager.totalDuration();
        expect(totalDuration).to.equal(8628924);

        let totalWeightedAPC = await poolManager.totalWeightedAPC();
        expect(totalWeightedAPC).to.equal(1588677200);

        let poolWeightPeriod0 = await poolManager.poolPeriods(deployer.address, 0);
        expect(poolWeightPeriod0).to.equal(0);

        let globalWeightPeriod0 = await poolManager.globalPeriods(0);
        expect(globalWeightPeriod0).to.equal(0);

        // 20e18 * floor(sqrt(300 - 184))
        let poolWeightPeriod3 = await poolManager.poolPeriods(deployer.address, 3);
        expect(poolWeightPeriod3).to.equal(parseEther("200"));

        let globalWeightPeriod3 = await poolManager.globalPeriods(3);
        expect(globalWeightPeriod3).to.equal(parseEther("210"));

        let poolInfo = await poolManager.pools(deployer.address);
        console.log(poolInfo);
        expect(poolInfo.unrealizedProfits).to.equal(parseEther("20"));
        expect(poolInfo.latestRecordedPrice).to.equal(parseEther("1.9"));
        expect(poolInfo.previousRecordedPrice).to.equal(parseEther("1"));
        expect(poolInfo.previousRecordedPeriodIndex).to.equal(0);
        expect(poolInfo.latestRecordedPeriodIndex).to.equal(3);
        expect(poolInfo.lastUpdated).to.equal(Number(current) + 24);
    });

    // Simulate multiple pools by initializing global APC variables to non-zero values.
    it("update weights multiple times in period 3, with first update in period 1; multiple pools", async () => {
        rewardToken = await RewardTokenFactory.deploy("Test Token", "TEST");
        await rewardToken.deployed();
        rewardTokenAddress = rewardToken.address;

        scheduleCurrent = await ScheduleFactory.deploy(parseEther((4 * CYCLE_DURATION).toString()), current - 100 - (ONE_WEEK * 6));
        await scheduleCurrent.deployed();
        scheduleCurrentAddress = scheduleCurrent.address;
    
        // Using scheduleCurrentAddress as xTGEN
        stakingRewardsFactory = await StakingRewardsFactoryFactory.deploy(rewardTokenAddress, scheduleCurrentAddress);
        await stakingRewardsFactory.deployed();
        stakingRewardsFactoryAddress = stakingRewardsFactory.address;

        poolManager = await PoolManagerFactory.deploy(rewardTokenAddress, scheduleCurrentAddress, deployer.address, stakingRewardsFactoryAddress, rewardTokenAddress, scheduleCurrentAddress);
        await poolManager.deployed();
        poolManagerAddress = poolManager.address;

        releaseEscrowCurrent = await ReleaseEscrowFactory.deploy(poolManagerAddress, rewardTokenAddress, scheduleCurrentAddress, current - 100 - (ONE_WEEK * 6));
        await releaseEscrowCurrent.deployed();
        releaseEscrowCurrentAddress = releaseEscrowCurrent.address;

        stakingRewards = await StakingRewardsFactory.deploy(poolManagerAddress, rewardTokenAddress, stakingTokenAddress1, scheduleCurrentAddress);
        await stakingRewards.deployed();
        stakingRewardsAddress = stakingRewards.address;
    
        // Transfer tokens to ReleaseEscrowCurrent
        let tx = await rewardToken.approve(releaseEscrowCurrentAddress, parseEther((8 * CYCLE_DURATION).toString()));
        await tx.wait();
        let tx2 = await rewardToken.transfer(releaseEscrowCurrentAddress, parseEther((8 * CYCLE_DURATION).toString()));
        await tx2.wait();
    
        // Set the PoolManager's ReleaseEscrow address
        let tx3 = await poolManager.setReleaseEscrow(releaseEscrowCurrentAddress);
        await tx3.wait();

        let tx4 = await poolManager.setStartTime(current - 100 - (ONE_WEEK * 6));
        await tx4.wait();

        let tx5 = await poolManager.setPoolInfo(deployer.address, true, true, stakingRewardsAddress, parseEther("10"), parseEther("1.2"), 1, parseEther("1"), 0, current - 100 - (ONE_WEEK * 4), current - 100 - (ONE_WEEK * 6));
        await tx5.wait();

        let tx6 = await poolManager.setGlobalPeriodInfo(1, parseEther("10"));
        await tx6.wait();

        let tx7 = await poolManager.setGlobalPeriodInfo(3, parseEther("10"));
        await tx7.wait();

        let tx8 = await poolManager.setPoolPeriodInfo(deployer.address, 1, parseEther("10"));
        await tx8.wait();

        // Average APC is 100
        let tx9 = await poolManager.setGlobalAPCVariables(500000000, 5000000);
        await tx9.wait();

        let tx10 = await poolManager.updateWeight(parseEther("10"), parseEther("1.5"));
        await tx10.wait();

        let tx11 = await poolManager.updateWeight(parseEther("20"), parseEther("1.8"));
        await tx11.wait();

        // 26 seconds difference between local time and block.timestamp
        let lastUpdateTime = await poolManager.lastUpdateTime();
        expect(lastUpdateTime).to.equal(Number(current) + 26);

        // 50% rise over 2 periods
        let poolAPC = await poolManager.poolAPC(deployer.address);
        expect(poolAPC).to.equal(250);

        // 124 + 5,000,000 - (86,400 * 7 * 2) + (86,400 * 7 * 6)
        let totalDuration = await poolManager.totalDuration();
        expect(totalDuration).to.equal(7419326);

        // 500,000,000 + (250 * 86,400 * 7 * 6)
        let totalWeightedAPC = await poolManager.totalWeightedAPC();
        expect(totalWeightedAPC).to.equal(1407231500);

        let poolWeightPeriod0 = await poolManager.poolPeriods(deployer.address, 0);
        expect(poolWeightPeriod0).to.equal(0);

        let globalWeightPeriod0 = await poolManager.globalPeriods(0);
        expect(globalWeightPeriod0).to.equal(0);

        let poolWeightPeriod1 = await poolManager.poolPeriods(deployer.address, 1);
        expect(poolWeightPeriod1).to.equal(parseEther("10"));

        let globalWeightPeriod1 = await poolManager.globalPeriods(1);
        expect(globalWeightPeriod1).to.equal(parseEther("10"));

        // 20e18 * floor(sqrt(250 - 189))
        let poolWeightPeriod3 = await poolManager.poolPeriods(deployer.address, 3);
        expect(poolWeightPeriod3).to.equal(parseEther("140"));

        let globalWeightPeriod3 = await poolManager.globalPeriods(3);
        expect(globalWeightPeriod3).to.equal(parseEther("150"));

        let poolInfo = await poolManager.pools(deployer.address);
        console.log(poolInfo);
        expect(poolInfo.unrealizedProfits).to.equal(parseEther("20"));
        expect(poolInfo.latestRecordedPrice).to.equal(parseEther("1.8"));
        expect(poolInfo.previousRecordedPrice).to.equal(parseEther("1.2"));
        expect(poolInfo.previousRecordedPeriodIndex).to.equal(1);
        expect(poolInfo.latestRecordedPeriodIndex).to.equal(3);
        expect(poolInfo.lastUpdated).to.equal(Number(current) + 26);
    });
    
    it("multiple pools updating weight multiple times in period 0", async () => {
        let tx = await poolManager.setPoolInfo(deployer.address, true, true, stakingRewardsAddress, parseEther("10"), parseEther("1"), 0, parseEther("1"), 0, current - 100, current - 100);
        await tx.wait();

        let tx2 = await poolManager.setPoolInfo(otherUser.address, true, true, stakingRewardsAddress, parseEther("10"), parseEther("1"), 0, parseEther("1"), 0, current - 100, current - 100);
        await tx2.wait();

        let tx3 = await poolManager.setGlobalPeriodInfo(0, 0);
        await tx3.wait();

        let tx4 = await poolManager.setGlobalAPCVariables(0, 0);
        await tx4.wait();

        let tx5 = await poolManager.updateWeight(parseEther("15"), parseEther("1.5"));
        await tx5.wait();

        let tx6 = await poolManager.connect(otherUser).updateWeight(parseEther("20"), parseEther("1.8"));
        await tx6.wait();

        // 15 seconds difference between local time and block.timestamp
        let lastUpdateTime = await poolManager.lastUpdateTime();
        expect(lastUpdateTime).to.equal(Number(current) + 15);

        let poolAPC1 = await poolManager.poolAPC(deployer.address);
        expect(poolAPC1).to.equal(500);

        let poolAPC2 = await poolManager.poolAPC(otherUser.address);
        expect(poolAPC2).to.equal(800);

        let totalDuration = await poolManager.totalDuration();
        expect(totalDuration).to.equal(229);

        // (500 * 114) + (800 * 115)
        let totalWeightedAPC = await poolManager.totalWeightedAPC();
        expect(totalWeightedAPC).to.equal(149000);

        let poolWeight1 = await poolManager.poolPeriods(deployer.address, 0);
        expect(poolWeight1).to.equal(parseEther("15"));

        // 20e18 * floor(sqrt(801 - 650)); aAPC = 147700 / 227 = 650
        let poolWeight2 = await poolManager.poolPeriods(otherUser.address, 0);
        expect(poolWeight2).to.equal(parseEther("240"));

        let globalWeight = await poolManager.globalPeriods(0);
        expect(globalWeight).to.equal(parseEther("255"));

        let poolInfo1 = await poolManager.pools(deployer.address);
        expect(poolInfo1.unrealizedProfits).to.equal(parseEther("15"));
        expect(poolInfo1.latestRecordedPrice).to.equal(parseEther("1.5"));
        expect(poolInfo1.previousRecordedPrice).to.equal(parseEther("1"));
        expect(poolInfo1.previousRecordedPeriodIndex).to.equal(0);
        expect(poolInfo1.latestRecordedPeriodIndex).to.equal(0);
        expect(poolInfo1.lastUpdated).to.equal(Number(current) + 14);

        let poolInfo2 = await poolManager.pools(otherUser.address);
        expect(poolInfo2.unrealizedProfits).to.equal(parseEther("20"));
        expect(poolInfo2.latestRecordedPrice).to.equal(parseEther("1.8"));
        expect(poolInfo2.previousRecordedPrice).to.equal(parseEther("1"));
        expect(poolInfo2.previousRecordedPeriodIndex).to.equal(0);
        expect(poolInfo2.latestRecordedPeriodIndex).to.equal(0);
        expect(poolInfo2.lastUpdated).to.equal(Number(current) + 15);

        // Update weights again for both pool

        let tx7 = await poolManager.updateWeight(parseEther("25"), parseEther("1.6"));
        await tx7.wait();

        // (600 * 116) + (800 * 115)
        totalWeightedAPC = await poolManager.totalWeightedAPC();
        expect(totalWeightedAPC).to.equal(161600);

        totalDuration = await poolManager.totalDuration();
        expect(totalDuration).to.equal(231);

        // 25e18 * log2(600) / floor(sqrt(699 - 600))
        poolWeight1 = await poolManager.poolPeriods(deployer.address, 0);
        expect(poolWeight1).to.equal(parseEther("25"));

        globalWeight = await poolManager.globalPeriods(0);
        expect(globalWeight).to.equal(parseEther("265"));

        let tx8 = await poolManager.connect(otherUser).updateWeight(parseEther("10"), parseEther("1.4"));
        await tx8.wait();

        // 17 seconds difference between local time and block.timestamp
        lastUpdateTime = await poolManager.lastUpdateTime();
        expect(lastUpdateTime).to.equal(Number(current) + 17);

        poolAPC1 = await poolManager.poolAPC(deployer.address);
        expect(poolAPC1).to.equal(600);

        poolAPC2 = await poolManager.poolAPC(otherUser.address);
        expect(poolAPC2).to.equal(400);

        totalDuration = await poolManager.totalDuration();
        expect(totalDuration).to.equal(233);

        // (600 * 116) + (400 * 117)
        totalWeightedAPC = await poolManager.totalWeightedAPC();
        expect(totalWeightedAPC).to.equal(116400);

        // 10e18 * log(400) / floor(sqrt(499 - 400)); aAPC = 115400 / 231 = 499
        poolWeight2 = await poolManager.poolPeriods(otherUser.address, 0);
        let expectedPoolWeight2 = BigInt(80e18) / BigInt(9);
        expect(poolWeight2.toString()).to.equal(expectedPoolWeight2.toString());

        globalWeight = await poolManager.globalPeriods(0);
        let expectedGlobalWeight = BigInt(expectedPoolWeight2) + BigInt(25e18);
        expect(globalWeight.toString()).to.equal(expectedGlobalWeight.toString());

        poolInfo1 = await poolManager.pools(deployer.address);
        expect(poolInfo1.unrealizedProfits).to.equal(parseEther("25"));
        expect(poolInfo1.latestRecordedPrice).to.equal(parseEther("1.6"));
        expect(poolInfo1.previousRecordedPrice).to.equal(parseEther("1"));
        expect(poolInfo1.previousRecordedPeriodIndex).to.equal(0);
        expect(poolInfo1.latestRecordedPeriodIndex).to.equal(0);
        expect(poolInfo1.lastUpdated).to.equal(Number(current) + 16);

        poolInfo2 = await poolManager.pools(otherUser.address);
        expect(poolInfo2.unrealizedProfits.toString()).to.equal(parseEther("10"));
        expect(poolInfo2.latestRecordedPrice).to.equal(parseEther("1.4"));
        expect(poolInfo2.previousRecordedPrice).to.equal(parseEther("1"));
        expect(poolInfo2.previousRecordedPeriodIndex).to.equal(0);
        expect(poolInfo2.latestRecordedPeriodIndex).to.equal(0);
        expect(poolInfo2.lastUpdated).to.equal(Number(current) + 17);
    });

    it("multiple pools updating weight multiple times in different periods", async () => {
        rewardToken = await RewardTokenFactory.deploy("Test Token", "TEST");
        await rewardToken.deployed();
        rewardTokenAddress = rewardToken.address;

        scheduleCurrent = await ScheduleFactory.deploy(parseEther((4 * CYCLE_DURATION).toString()), current - 100 - (ONE_WEEK * 6));
        await scheduleCurrent.deployed();
        scheduleCurrentAddress = scheduleCurrent.address;
    
        // Using scheduleCurrentAddress as xTGEN
        stakingRewardsFactory = await StakingRewardsFactoryFactory.deploy(rewardTokenAddress, scheduleCurrentAddress);
        await stakingRewardsFactory.deployed();
        stakingRewardsFactoryAddress = stakingRewardsFactory.address;

        poolManager = await PoolManagerFactory.deploy(rewardTokenAddress, scheduleCurrentAddress, deployer.address, stakingRewardsFactoryAddress, rewardTokenAddress, scheduleCurrentAddress);
        await poolManager.deployed();
        poolManagerAddress = poolManager.address;

        releaseEscrowCurrent = await ReleaseEscrowFactory.deploy(poolManagerAddress, rewardTokenAddress, scheduleCurrentAddress, current - 100 - (ONE_WEEK * 6));
        await releaseEscrowCurrent.deployed();
        releaseEscrowCurrentAddress = releaseEscrowCurrent.address;

        stakingRewards = await StakingRewardsFactory.deploy(poolManagerAddress, rewardTokenAddress, stakingTokenAddress1, scheduleCurrentAddress);
        await stakingRewards.deployed();
        stakingRewardsAddress = stakingRewards.address;
    
        // Transfer tokens to ReleaseEscrowCurrent
        let tx = await rewardToken.approve(releaseEscrowCurrentAddress, parseEther((8 * CYCLE_DURATION).toString()));
        await tx.wait();
        let tx2 = await rewardToken.transfer(releaseEscrowCurrentAddress, parseEther((8 * CYCLE_DURATION).toString()));
        await tx2.wait();
    
        // Set the PoolManager's ReleaseEscrow address
        let tx3 = await poolManager.setReleaseEscrow(releaseEscrowCurrentAddress);
        await tx3.wait();

        let tx4 = await poolManager.setStartTime(current - 100 - (ONE_WEEK * 6));
        await tx4.wait();

        // Last updated 10 seconds after period 1 started
        // Duration = (86400 * 7 * 2) + 10
        let tx5 = await poolManager.setPoolInfo(deployer.address, true, true, stakingRewardsAddress, parseEther("10"), parseEther("1.2"), 1, parseEther("1"), 0, current - 90 - (ONE_WEEK * 4), current - 100 - (ONE_WEEK * 6));
        await tx5.wait();

        // Last updated when pool was created
        let tx6 = await poolManager.setPoolInfo(otherUser.address, true, true, stakingRewardsAddress, 0, parseEther("1"), 0, parseEther("1"), 0, current - 100 - (ONE_WEEK * 6), current - 100 - (ONE_WEEK * 6));
        await tx6.wait();

        // Initial APC = 200, initial duration = (86400 * 14) + 10 = 1,209,610; total APC = 200 * 1,209,610 = 241,922,000
        let tx7 = await poolManager.setGlobalAPCVariables(241922000, 1209610);
        await tx7.wait();

        let tx8 = await poolManager.setPoolAPC(deployer.address, 200);
        await tx8.wait();

        // Update weights first time

        let tx9 = await poolManager.updateWeight(parseEther("15"), parseEther("1.8"));
        await tx9.wait();

        let tx10 = await poolManager.connect(otherUser).updateWeight(parseEther("20"), parseEther("0.9"));
        await tx10.wait();

        // 25 seconds difference between local time and block.timestamp
        let lastUpdateTime = await poolManager.lastUpdateTime();
        expect(lastUpdateTime).to.equal(Number(current) + 25);

        // 50% rise over 2 periods
        let poolAPC1 = await poolManager.poolAPC(deployer.address);
        expect(poolAPC1).to.equal(250);

        // 10% fall over 3 periods, so 0 APC
        let poolAPC2 = await poolManager.poolAPC(otherUser.address);
        expect(poolAPC2).to.equal(0);

        // [(86400 * 7 * 6) + 100 + 24] + [(86400 * 7 * 6) + 100 + 25] 
        let totalDuration = await poolManager.totalDuration();
        expect(totalDuration).to.equal(7257849);
        
        // (250 * [(86400 * 7 * 6) + 100 + 24]) + (0 * [(86400 * 7 * 6) + 100 + 25])
        let totalWeightedAPC = await poolManager.totalWeightedAPC();
        expect(totalWeightedAPC).to.equal(907231000);

        let poolWeight1 = await poolManager.poolPeriods(deployer.address, 3);
        expect(poolWeight1).to.equal(parseEther("15"));

        let poolWeight2 = await poolManager.poolPeriods(otherUser.address, 3);
        expect(poolWeight2).to.equal(0);

        let globalWeight = await poolManager.globalPeriods(3);
        expect(globalWeight).to.equal(parseEther("15"));

        let poolInfo1 = await poolManager.pools(deployer.address);
        expect(poolInfo1.unrealizedProfits).to.equal(parseEther("15"));
        expect(poolInfo1.latestRecordedPrice).to.equal(parseEther("1.8"));
        expect(poolInfo1.previousRecordedPrice).to.equal(parseEther("1.2"));
        expect(poolInfo1.previousRecordedPeriodIndex).to.equal(1);
        expect(poolInfo1.latestRecordedPeriodIndex).to.equal(3);
        expect(poolInfo1.lastUpdated).to.equal(Number(current) + 24);

        let poolInfo2 = await poolManager.pools(otherUser.address);
        expect(poolInfo2.unrealizedProfits).to.equal(parseEther("20"));
        expect(poolInfo2.latestRecordedPrice).to.equal(parseEther("0.9"));
        expect(poolInfo2.previousRecordedPrice).to.equal(parseEther("1"));
        expect(poolInfo2.previousRecordedPeriodIndex).to.equal(0);
        expect(poolInfo2.latestRecordedPeriodIndex).to.equal(3);
        expect(poolInfo2.lastUpdated).to.equal(Number(current) + 25);
        
        // Update weights again for both pools

        // 60% rise over 2 periods
        let tx11 = await poolManager.updateWeight(parseEther("25"), parseEther("1.92"));
        await tx11.wait();

        // (300 * [(86400 * 7 * 6) + 100 + 24])
        totalWeightedAPC = await poolManager.totalWeightedAPC();
        expect(totalWeightedAPC).to.equal(1088677800);

        // [(86400 * 7 * 6) + 100 + 24] + [(86400 * 7 * 6) + 100 + 23] 
        totalDuration = await poolManager.totalDuration();
        expect(totalDuration).to.equal(7257851);

        // 25e18 * floor(sqrt(301 - 150)); aAPC = 1088677200 / 7257847 = 150
        poolWeight1 = await poolManager.poolPeriods(deployer.address, 3);
        expect(poolWeight1).to.equal(parseEther("300"));

        globalWeight = await poolManager.globalPeriods(3);
        expect(globalWeight).to.equal(parseEther("300"));

        let tx12 = await poolManager.connect(otherUser).updateWeight(parseEther("10"), parseEther("1.9"));
        await tx12.wait();

        // 27 seconds difference between local time and block.timestamp
        lastUpdateTime = await poolManager.lastUpdateTime();
        expect(lastUpdateTime).to.equal(Number(current) + 27);

        // 30% rise over 2 periods
        poolAPC1 = await poolManager.poolAPC(deployer.address);
        expect(poolAPC1).to.equal(300);

        // 30% rise over 3 periods
        poolAPC2 = await poolManager.poolAPC(otherUser.address);
        expect(poolAPC2).to.equal(300);

        // [(86400 * 7 * 6) + 100 + 26] + [(86400 * 7 * 6) + 100 + 27] 
        totalDuration = await poolManager.totalDuration();
        expect(totalDuration).to.equal(7257853);

        // (300 * [(86400 * 7 * 6) + 100 + 24]) + (300 * [(86400 * 7 * 6) + 100 + 25])
        totalWeightedAPC = await poolManager.totalWeightedAPC();
        expect(totalWeightedAPC).to.equal(2177355900);

        // 10e18 * floor(sqrt(301 - 300)); aAPC = 2177354700 / 7257849 = 300
        poolWeight2 = await poolManager.poolPeriods(otherUser.address, 3);
        expect(poolWeight2).to.equal(parseEther("10"));

        globalWeight = await poolManager.globalPeriods(3);
        expect(globalWeight).to.equal(parseEther("310"));

        poolInfo1 = await poolManager.pools(deployer.address);
        expect(poolInfo1.unrealizedProfits).to.equal(parseEther("25"));
        expect(poolInfo1.latestRecordedPrice).to.equal(parseEther("1.92"));
        expect(poolInfo1.previousRecordedPrice).to.equal(parseEther("1.2"));
        expect(poolInfo1.previousRecordedPeriodIndex).to.equal(1);
        expect(poolInfo1.latestRecordedPeriodIndex).to.equal(3);
        expect(poolInfo1.lastUpdated).to.equal(Number(current) + 26);

        poolInfo2 = await poolManager.pools(otherUser.address);
        expect(poolInfo2.unrealizedProfits.toString()).to.equal(parseEther("10"));
        expect(poolInfo2.latestRecordedPrice).to.equal(parseEther("1.9"));
        expect(poolInfo2.previousRecordedPrice).to.equal(parseEther("1"));
        expect(poolInfo2.previousRecordedPeriodIndex).to.equal(0);
        expect(poolInfo2.latestRecordedPeriodIndex).to.equal(3);
        expect(poolInfo2.lastUpdated).to.equal(Number(current) + 27);
    });
  });
});