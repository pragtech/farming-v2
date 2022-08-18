const { ethers } = require("hardhat");
const { parseEther } = require("@ethersproject/units");

const TGEN_ADDRESS_TESTNET = "0xa9e37D0DC17C8B8Ed457Ab7cCC40b5785d4d11C0";
const TGEN_ADDRESS_MAINNET = "";

const XTGEN_ADDRESS_TESTNET = "0x4a03DBf1A734BfE935347cccd3CC57f770c59C28";
const XTGEN_ADDRESS_MAINNET = "";

const REGISTRY_ADDRESS_TESTNET = "0x1DB1B73DDDAC81b957E744763d85c81dd638f2eE";
const REGISTRY_ADDRESS_MAINNET = "";

const RELEASE_SCHEDULE_ADDRESS_TESTNET = "0x59c8A678844899719AD1080bE4f9Ba7A480073ED";
const RELEASE_SCHEDULE_ADDRESS_MAINNET = "";

const RELEASE_ESCROW_ADDRESS_TESTNET = "0xcDd4B545b357D62c48408537636DDC0ba49A072C";
const RELEASE_ESCROW_ADDRESS_MAINNET = "";

const STAKING_REWARDS_FACTORY_ADDRESS_TESTNET = "0x033baa36F41f1bA42BbaC0274cCeE0d58f6cdF80";
const STAKING_REWARDS_FACTORY_ADDRESS_MAINNET = "";

const POOL_MANAGER_ADDRESS_TESTNET = "0xBcF24A50cd948b111bB0D297F27c53c063294fa4";
const POOL_MANAGER_ADDRESS_MAINNET = "";

const MATH_LIBRARY_ADDRESS_TESTNET = "0x6350DCd835100d63ce8E313DCFFFa23EE1756960";
const MATH_LIBRARY_ADDRESS_MAINNET = "";

async function deployMathLibrary() {
  const signers = await ethers.getSigners();
  deployer = signers[0];
  
  let MathFactory = await ethers.getContractFactory('TradegenMath');
  math = await MathFactory.deploy();
  await math.deployed();
  console.log("Math Library: " + math.address);
}

async function deployReleaseSchedule() {
  const signers = await ethers.getSigners();
  deployer = signers[0];
  
  let ReleaseScheduleFactory = await ethers.getContractFactory('HalveningReleaseSchedule');
  
  // September 1, 2022.
  let schedule = await ReleaseScheduleFactory.deploy(parseEther("300000000"), 1661990400);
  await schedule.deployed();
  let scheduleAddress = schedule.address;
  console.log("HalveningReleaseSchedule: " + scheduleAddress);
}

async function deployStakingRewardsFactory() {
  const signers = await ethers.getSigners();
  deployer = signers[0];
  
  let StakingRewardsFactoryFactory = await ethers.getContractFactory('StakingRewardsFactory');
  
  let factoryContract = await StakingRewardsFactoryFactory.deploy(TGEN_ADDRESS_TESTNET, XTGEN_ADDRESS_TESTNET);
  await factoryContract.deployed();
  let factoryAddress = factoryContract.address;
  console.log("StakingRewardsFactory: " + factoryAddress);
}

async function deployPoolManager() {
  const signers = await ethers.getSigners();
  deployer = signers[0];
  
  let PoolManagerFactory = await ethers.getContractFactory('PoolManager');
  
  let poolManager = await PoolManagerFactory.deploy(TGEN_ADDRESS_TESTNET, RELEASE_SCHEDULE_ADDRESS_TESTNET, REGISTRY_ADDRESS_TESTNET, STAKING_REWARDS_FACTORY_ADDRESS_TESTNET, TGEN_ADDRESS_TESTNET, XTGEN_ADDRESS_TESTNET);
  await poolManager.deployed();
  let poolManagerAddress = poolManager.address;
  console.log("PoolManager: " + poolManagerAddress);
}

async function setPoolManager() {
  const signers = await ethers.getSigners();
  deployer = signers[0];
  
  let StakingRewardsFactoryFactory = await ethers.getContractFactory('StakingRewardsFactory');
  let factory = StakingRewardsFactoryFactory.attach(STAKING_REWARDS_FACTORY_ADDRESS_TESTNET);
  
  let tx = await factory.setPoolManager(POOL_MANAGER_ADDRESS_TESTNET);
  await tx.wait();

  let manager = await factory.poolManager();
  console.log(manager);
}

async function deployReleaseEscrow() {
  const signers = await ethers.getSigners();
  deployer = signers[0];
  
  let ReleaseEscrowFactory = await ethers.getContractFactory('ReleaseEscrow');
  
  // Same timestamp as release schedule.
  let escrow = await ReleaseEscrowFactory.deploy(POOL_MANAGER_ADDRESS_TESTNET, TGEN_ADDRESS_TESTNET, RELEASE_SCHEDULE_ADDRESS_TESTNET, 1661990400);
  await escrow.deployed();
  let escrowAddress = escrow.address;
  console.log("ReleaseEscrow: " + escrowAddress);
}

async function setReleaseEscrow() {
  const signers = await ethers.getSigners();
  deployer = signers[0];
  
  let PoolManagerFactory = await ethers.getContractFactory('PoolManager');
  let poolManager = PoolManagerFactory.attach(POOL_MANAGER_ADDRESS_TESTNET);
  
  let tx = await poolManager.setReleaseEscrow(RELEASE_ESCROW_ADDRESS_TESTNET);
  await tx.wait();

  let escrow = await poolManager.releaseEscrow();
  console.log(escrow);
}
/*
deployMathLibrary()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })

deployReleaseSchedule()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })

deployStakingRewardsFactory()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })

deployPoolManager()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })

setPoolManager()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })

deployReleaseEscrow()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })*/

setReleaseEscrow()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })