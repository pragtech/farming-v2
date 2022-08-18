const { expect } = require("chai");

describe("TradegenMath", () => {
  let deployer;
  let otherUser;

  let library;
  let libraryAddress;
  let LibraryFactory;

  const ONE_DAY = 86400;
  const CYCLE_DURATION = ONE_DAY * 14; // 14 days
  
  before(async () => {
    const signers = await ethers.getSigners();
    deployer = signers[0];
    otherUser = signers[1];

    LibraryFactory = await ethers.getContractFactory('TestLibrary');

    library = await LibraryFactory.deploy();
    await library.deployed();
    libraryAddress = library.address;
  });
  
  describe("#log", () => {
    it("log(0) and log(1)", async () => {
        const result0 = await library.log(0);
        const result1 = await library.log(1);

        expect(result0).to.equal(0);
        expect(result1).to.equal(0);
    });

    it("log(2)", async () => {
      const result = await library.log(2);

      expect(result).to.equal(1);
    });

    it("log(3)", async () => {
      const result = await library.log(3);

      expect(result).to.equal(1);
    });

    it("log(4)", async () => {
      const result = await library.log(4);

      expect(result).to.equal(2);
    });

    it("log(32)", async () => {
      const result = await library.log(32);

      expect(result).to.equal(5);
    });

    it("log(63)", async () => {
      const result = await library.log(63);

      expect(result).to.equal(5);
    });

    it("log(511)", async () => {
      const result = await library.log(511);

      expect(result).to.equal(8);
    });

    it("log(512)", async () => {
      const result = await library.log(512);

      expect(result).to.equal(9);
    });
  });

  describe("#scaleByTime", () => {
    it("edge cases", async () => {
        // Check for 0 duration 
        const result1 = await library.scaleByTime(1000, 1000, CYCLE_DURATION + 1000, CYCLE_DURATION, 0);

        // Check for startTimestamp > currentTimestamp
        const result2 = await library.scaleByTime(1000, 1000, CYCLE_DURATION, CYCLE_DURATION + 1000, 0);

        // Check for duration + startTimestamp < currentTimestamp
        const result3 = await library.scaleByTime(1000, 1000, CYCLE_DURATION + 1000, CYCLE_DURATION, 100);

        expect(result1).to.equal(0);
        expect(result2).to.equal(0);
        expect(result3).to.equal(0);
    });

    it("50% cycle elapsed", async () => {
        const result1 = await library.scaleByTime(1000, 1000, CYCLE_DURATION * 1.5, CYCLE_DURATION, CYCLE_DURATION);
        const result2 = await library.scaleByTime(1000, 11000, CYCLE_DURATION * 1.5, CYCLE_DURATION, CYCLE_DURATION);
        const result3 = await library.scaleByTime(11000, 1000, CYCLE_DURATION * 1.5, CYCLE_DURATION, CYCLE_DURATION);
        const result4 = await library.scaleByTime(1000, 0, CYCLE_DURATION * 1.5, CYCLE_DURATION, CYCLE_DURATION);
        const result5 = await library.scaleByTime(0, 1000, CYCLE_DURATION * 1.5, CYCLE_DURATION, CYCLE_DURATION);

        expect(result1).to.equal(1000);
        expect(result2).to.equal(6000);
        expect(result3).to.equal(6000);
        expect(result4).to.equal(500);
        expect(result5).to.equal(500);
    });

    it("10% cycle elapsed", async () => {
        const result1 = await library.scaleByTime(1000, 1000, CYCLE_DURATION * 1.1, CYCLE_DURATION, CYCLE_DURATION);
        const result2 = await library.scaleByTime(1000, 11000, CYCLE_DURATION * 1.1, CYCLE_DURATION, CYCLE_DURATION);
        const result3 = await library.scaleByTime(11000, 1000, CYCLE_DURATION * 1.1, CYCLE_DURATION, CYCLE_DURATION);
        const result4 = await library.scaleByTime(1000, 0, CYCLE_DURATION * 1.1, CYCLE_DURATION, CYCLE_DURATION);
        const result5 = await library.scaleByTime(0, 1000, CYCLE_DURATION * 1.1, CYCLE_DURATION, CYCLE_DURATION);

        expect(result1).to.equal(1000);
        expect(result2).to.equal(10000);
        expect(result3).to.equal(2000);
        expect(result4).to.equal(100);
        expect(result5).to.equal(900);
    });

    it("80% cycle elapsed", async () => {
        const result1 = await library.scaleByTime(1000, 1000, CYCLE_DURATION * 1.8, CYCLE_DURATION, CYCLE_DURATION);
        const result2 = await library.scaleByTime(1000, 11000, CYCLE_DURATION * 1.8, CYCLE_DURATION, CYCLE_DURATION);
        const result3 = await library.scaleByTime(11000, 1000, CYCLE_DURATION * 1.8, CYCLE_DURATION, CYCLE_DURATION);
        const result4 = await library.scaleByTime(1000, 0, CYCLE_DURATION * 1.8, CYCLE_DURATION, CYCLE_DURATION);
        const result5 = await library.scaleByTime(0, 1000, CYCLE_DURATION * 1.8, CYCLE_DURATION, CYCLE_DURATION);

        expect(result1).to.equal(1000);
        expect(result2).to.equal(3000);
        expect(result3).to.equal(9000);
        expect(result4).to.equal(800);
        expect(result5).to.equal(200);
    });
  });
});