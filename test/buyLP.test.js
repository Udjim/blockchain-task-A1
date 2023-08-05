const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require("hardhat");

const {
    OWNER,
    MANAGER,
    FUNDRISING_WALLET,
    LP_TOKEN,
    INVEST_POOL,
    ROLES_INIT,
    PUBLIC_KEY,
} = require("./testdata.json");

describe("buyLP(unit256) function unit test", function () {
    let owner, manager, user1, user2;

    before(async function () {
        [owner, manager, , user1, user2] = await ethers.getSigners();
    });

    async function deployFixture() {
        // deploy LP Token
        const lpToken = await ethers.deployContract("LPtoken", [
            LP_TOKEN.name,
            LP_TOKEN.symbol,
            MANAGER,
        ]);

        // deploy RoleContract
        const rolesContract = await ethers.deployContract("RoleContract", []);
        // RoleContract initialization
        await rolesContract.initialize(PUBLIC_KEY, MANAGER, ROLES_INIT);

        // deploy mock Token
        const paymentToken = await ethers.deployContract("token", []);

        // deploy InvestPool
        const investPoolArgs = [
            lpToken.address,
            rolesContract.address,
            paymentToken.address,
            FUNDRISING_WALLET,
            INVEST_POOL.baseFee,
            INVEST_POOL.price,
            INVEST_POOL.maxAmountToSell,
            MANAGER,
            INVEST_POOL.roleSettings,
        ];
        const investPool = await ethers.deployContract(
            "InvestPool",
            investPoolArgs
        );

        return { lpToken, rolesContract, paymentToken, investPool };
    }

    it("should allow a user to buy LP tokens", async function () {
        const { investPool, rolesContract, paymentToken, lpToken } =
            await loadFixture(deployFixture);

        // Assuming user1 is going to buy LP tokens with the specified amount
        const lpTokenAmountToBuy = 100; // 100 LP token to buy

        // grant user1 role to buy LP tokens
        await rolesContract.connect(manager).giveRole(user1.address, 1, 30); // role num 1 for 30 days

        // mint payment tokens to user1
        await paymentToken.mint(
            user1.address,
            ethers.utils.parseUnits("1050", 1)
        );

        // approve token spending by investPool
        await paymentToken
            .connect(user1)
            .approve(investPool.address, ethers.constants.MaxUint256);

        // mint LPTokens to fund investPool
        await lpToken.mint(investPool.address, lpTokenAmountToBuy);

        // perform the purchase
        await investPool.connect(user1).buyLP(lpTokenAmountToBuy);

        // check the user's LP token balance after the purchase
        const user1LpTokenBalance = await lpToken.balanceOf(user1.address);
        expect(user1LpTokenBalance).to.equal(lpTokenAmountToBuy);

        // check the event emitted by the contract after the purchase
        const purchaseEvent = await investPool.queryFilter(
            "Purchase",
            user1.address
        );
        const eventData = purchaseEvent[0].args;

        expect(eventData.user).to.equal(user1.address);
        expect(eventData.amount).to.equal(lpTokenAmountToBuy);
    });

    it("should not allow a user to buy LP tokens if the role is not set", async function () {
        const { investPool } = await loadFixture(deployFixture);
        const unknownRoleUser = user2;
        const lpTokenAmountToBuy = 100;

        // attempt to buy LP tokens without a role
        await expect(
            investPool.connect(unknownRoleUser).buyLP(lpTokenAmountToBuy)
        ).to.be.revertedWith("User doesn't have role");
    });

    it("should not allow a user to buy LP tokens with an invalid LP token amount", async function () {
        const { investPool, rolesContract } = await loadFixture(deployFixture);
        const invalidLpTokenAmount = 0; // An invalid amount is 0

        // grant user1 role to buy LP tokens
        await rolesContract.connect(manager).giveRole(user1.address, 1, 30);

        await expect(
            investPool.connect(user1).buyLP(invalidLpTokenAmount)
        ).to.be.revertedWith("IA");
    });

    it("should not allow a user to buy LP tokens if the deadline has passed", async function () {
        const { investPool, rolesContract } = await loadFixture(deployFixture);

        // grant user1 role to buy LP tokens
        const tx = await rolesContract
            .connect(manager)
            .giveRole(user1.address, 1, 7); // 7 days

        const currentBlockNum = (await tx.wait()).blockNumber;
        const currentTimestamp = (
            await ethers.provider.getBlock(currentBlockNum)
        ).timestamp;

        const newTimestampInSeconds = currentTimestamp + 604800 + 1; // 604800 is 7 days in seconds

        // skip time so the so that the role will pass the deadline
        await ethers.provider.send("evm_setNextBlockTimestamp", [
            newTimestampInSeconds,
        ]);

        await expect(investPool.connect(user1).buyLP(100)).to.be.revertedWith(
            "TE"
        );
    });

    it("should not allow a user to buy LP tokens if the max amount Payment token to sell for the role is exceeded", async function () {
        const { investPool, rolesContract, paymentToken, lpToken } =
            await loadFixture(deployFixture);

        const maxAmountForRole = INVEST_POOL.maxAmountToSell; // The role number 1

        // grant a user the same role to buy LP tokens
        await rolesContract.connect(manager).giveRole(user1.address, 1, 30);
        await rolesContract.connect(manager).giveRole(user2.address, 1, 30);

        // mint payment tokens to user2
        await paymentToken.mint(user2.address, 52500);

        // approve token spending by investPool
        await paymentToken
            .connect(user2)
            .approve(investPool.address, ethers.constants.MaxUint256);

        // mint LPTokens to fund investPool
        await lpToken.mint(investPool.address, 5000);

        // the total amount should exceed the max amount
        await investPool.connect(user2).buyLP(5000);

        // Attempt to buy more LP tokens, which should fail
        await expect(investPool.connect(user1).buyLP(100)).to.be.revertedWith(
            "RR"
        );
    });

    it("should not allow a user to buy LP tokens if the max amount LP token to buy is exceeded", async () => {
        const { investPool, rolesContract, paymentToken, lpToken } =
            await loadFixture(deployFixture);

        // Assuming maxAmountToSell is set to 9999
        const lpTokenAmountToBuy = 5000; // double purchase should exceed maxAmountToSell

        // grant a user different roles to buy LP tokens
        await rolesContract.connect(manager).giveRole(user1.address, 1, 30);
        await rolesContract.connect(manager).giveRole(user2.address, 2, 30);

        // mint payment tokens to user2
        await paymentToken.mint(user2.address, 52500);

        // approve token spending by investPool
        await paymentToken
            .connect(user2)
            .approve(investPool.address, ethers.constants.MaxUint256);

        await lpToken.mint(investPool.address, lpTokenAmountToBuy);

        await investPool.connect(user2).buyLP(lpTokenAmountToBuy);

        await expect(
            investPool.connect(user1).buyLP(lpTokenAmountToBuy)
        ).to.be.revertedWith("LT");
    });

    /* 
    it("should allow a user to buy LP tokens when base fee is set to zero", async function () {});

    it("should allow a user to buy LP tokens with the min amount for the role", async function () {});

    it("should allow a user to buy LP tokens with the max amount for the role", async function () {});

    it("should check if a user has enough Payment tokens to buy LP tokens", async function () {});

    it("should update state variables correctly", async function () {
        // updates user's `soldAmountForThisRole` value 
        // updates `alreadySold`
        // updates `totalPaymentTokenSpended` value
        // updates  user's `totalAmountOfPaymentTokenSpended` value
    }); 

    it("should not allow a user to buy LP tokens if the contract does not have enough LP tokens deposited", async function () {});

    it("should check that the contract applies the payment fee to the user", async function () {});
     */

    // Other test cases...
});
