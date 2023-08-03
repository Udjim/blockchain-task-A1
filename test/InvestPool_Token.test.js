const {
  loadFixture,
  time,
} = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  paymentTokenName,
  paymentTokenSymbol,
  paymentTokenDecimals,
  paymentTokenTotalValue,
  lpTokenName,
  lpTokenSymbol,
  lpTokenTotalValue,
  lpTokenAmountToBuy,
  baseFee,
  price,
  maxAmountToSell,
  isExist,
  maxAmount1,      
  minAmount1,
  maxAmount2,
  minAmount2,
  maxAmount3,
  minAmount3
} = require("./testdata.json");

describe("InvestPool Token", function () {
  // =================================
  // Deploy contracts function
  // =================================

  async function deploy() {
    //Get signers from ethers
    const [owner, manager, wallet, user] = await ethers.getSigners();

    // =================================
    // PaymentToken
    // =================================

    const FactoryPaymentToken = await ethers.getContractFactory("Token");
    const paymentToken = await FactoryPaymentToken.deploy(
      paymentTokenName,
      paymentTokenSymbol,
      paymentTokenDecimals
    );
    await paymentToken.deployed();

    //Minting payment tokens
    const mintToOwner = await paymentToken.mint(
      owner.address, 
      paymentTokenTotalValue > lpTokenTotalValue ? paymentTokenTotalValue: ( maxAmountToSell * 10)
    );
    await mintToOwner.wait();
    const mintToUser = await paymentToken.mint(
      user.address, 
      paymentTokenTotalValue > lpTokenTotalValue ? paymentTokenTotalValue: ( maxAmountToSell * 10)
    );
    await mintToUser.wait();

    // =================================
    // LPToken
    // =================================

    const FactoryLPToken = await ethers.getContractFactory("LPtoken");
    const lpToken = await FactoryLPToken.deploy(
      lpTokenName,
      lpTokenSymbol,
      manager.address
    );
    await lpToken.deployed();

    // =================================
    // RoleContract
    // =================================

    const FactoryRoleContract = await ethers.getContractFactory("RoleContract");
    const roleContract = await FactoryRoleContract.deploy();
    await roleContract.deployed();

    //Initialize RoleContracts's values
    const arrRoles =  [
      {
        roleNumber: 1,
        isExist: isExist,
        maxAmount: maxAmount1,
        minAmount: minAmount1
      },
      {
        roleNumber: 2,
        isExist: isExist,
        maxAmount: maxAmount2,
        minAmount: minAmount2
      },
      {
        roleNumber: 3,
        isExist: isExist,
        maxAmount: maxAmount3,
        minAmount: minAmount3
      }
    ];
    await roleContract.initialize(user.address, manager.address, arrRoles);

    //Give roles
    //First role to the owner
    await roleContract.connect(manager).giveRole(owner.address, 1, 1);
    //Third role to user
    await roleContract.connect(manager).giveRole(user.address, 3, 1);
    
    // =================================
    // InvestPool
    // =================================

    //Get current timestamp
    const ts = await time.latest();

    //Initialize roles settings array with current timestamp
    let _roleSettings = [
      {
        roleNumber: 1,
        startTime: ts,
        deadline: ts + 100000,
        roleFee: baseFee,
        maxAmountToSellForRole: maxAmount1,
      },
      {
        roleNumber: 2,
        startTime: ts,
        deadline: ts + 100000,
        roleFee: baseFee,
        maxAmountToSellForRole: maxAmount2,
      },
      {
        roleNumber: 3,
        startTime: ts,
        deadline: ts + 100000,
        roleFee: baseFee,
        maxAmountToSellForRole: maxAmount3,
      },
    ];

    const FactoryInvestPool = await ethers.getContractFactory("InvestPool");
    const investPool = await FactoryInvestPool.deploy(
      lpToken.address,
      roleContract.address,
      paymentToken.address,
      wallet.address,
      baseFee,
      price,
      maxAmountToSell,
      manager.address,
      _roleSettings
    );
    await investPool.deployed();

    //Minting LP tokens to the InvestPool contract
    const mintToInvestPool = await lpToken.mint(
      investPool.address, 
      lpTokenTotalValue > maxAmountToSell ? lpTokenTotalValue : ( maxAmountToSell * 10)
    );
    await mintToInvestPool.wait();
    return {
      owner,
      manager,
      wallet,
      user,
      lpToken,
      paymentToken,
      roleContract,
      investPool,
      ts
    };
  };
  
  describe("Check initial values", function () {
    it("should sets values correctly", async function () {
      //Call deploy() function
      const {
        owner,
        manager,
        wallet,
        user,
        lpToken,
        paymentToken,
        roleContract,
        investPool,
        ts,
      } = await loadFixture(deploy);

      //All contracts have proper addresses
      expect(lpToken.address).to.be.properAddress;
      expect(paymentToken.address).to.be.properAddress;
      expect(roleContract.address).to.be.properAddress;
      expect(investPool.address).to.be.properAddress;

      //All token's properties are sets correctly
      expect(await paymentToken.name()).to.equal(paymentTokenName);
      expect(await paymentToken.symbol()).to.equal(paymentTokenSymbol);
      expect(await paymentToken.decimals()).to.equal(paymentTokenDecimals);
      expect(await lpToken.name()).to.equal(lpTokenName);
      expect(await lpToken.symbol()).to.equal(lpTokenSymbol);
      expect(await lpToken.decimals()).to.equal(18);

      //Owner, manager and wallet are sets correctly
      expect(await investPool.owner()).to.equal(owner.address);
      expect(await investPool.manager()).to.equal(manager.address);
      expect(await investPool.fundrisingWallet()).to.equal(wallet.address);

      //Roles in RoleContract are sets correctly
      const role = await roleContract.rolesList(1);
      expect(role.roleNumber).to.equal(1);
      expect(role.isExist).to.equal(true);
      expect(role.maxAmount).to.equal(maxAmount1);
      expect(role.minAmount).to.equal(minAmount1);

      //Roles in InvestPool are sets correctly
      const roleIP = await investPool.roleSettings(1);
      expect(roleIP.startTime).to.equal(ts);
      expect(roleIP.deadline).to.equal(ts + 100000);
      expect(roleIP.roleFee).to.equal(baseFee);
      expect(roleIP.maxAmountToSellForRole).to.equal(maxAmount1);

      //Mapping alreadyBought have correct initial value
      const alrBought = await investPool.alreadyBought(user.address);
      expect(alrBought).to.equal(0);

      //Variables are sets correctly
      expect(await investPool.baseFee()).to.equal(baseFee);
      expect(await investPool.price()).to.equal(price);
      expect(await investPool.maxAmountToSell()).to.equal(maxAmountToSell);
      expect(await investPool.alreadySold()).to.equal(0);
      expect(await investPool.totalPaymentTokenSpended()).to.equal(0);
      expect(await investPool.totalLPDeposited()).to.equal(0);

      //Balances of user (payment tokens) and contract (LP tokens) are sets correctly
      expect(await paymentToken.balanceOf(user.address)).to.equal(
        paymentTokenTotalValue > lpTokenTotalValue ? paymentTokenTotalValue: ( maxAmountToSell * 10)
      );
      expect(await lpToken.balanceOf(investPool.address)).to.equal(
        lpTokenTotalValue > maxAmountToSell ? lpTokenTotalValue : ( maxAmountToSell * 10)
      );
    });
  });

  describe("buyLP() PAYMENT TOKET", function () {
    it("should allows to buy and change balances", async function () {
      //Call deploy() function
      const {
        wallet,
        user,
        lpToken,
        paymentToken,
        roleContract,
        investPool,
      } = await loadFixture(deploy);

      //Allow contract to take tokens
      const userBalance = await paymentToken.balanceOf(user.address);
      const txApr = await paymentToken
        .connect(user)
        .approve(investPool.address, userBalance);
      await txApr.wait();

      //Buy LP Tokens
      const txBuyLp = await investPool.connect(user).buyLP(lpTokenAmountToBuy);
      await txBuyLp.wait();

      //Get user role settings
      const userRoleNumber = await roleContract.getRoleNumber(user.address);
      const userRoleSettings = await investPool.roleSettings(userRoleNumber);

      //Calculate payment token amount
      const lpTokenDecimals = await lpToken.decimals()
      const paymentTokenAmountWithoutFee =
        (lpTokenAmountToBuy * price * 10 ** (paymentTokenDecimals - 2)) / 10 ** lpTokenDecimals;
      const paymentTokenAmount = (paymentTokenAmountWithoutFee * 
          (1000 + (userRoleSettings.roleFee == 0 ? baseFee : Number(userRoleSettings.roleFee)))) / 1000;
        
      //Changes balance of the user
      await expect(() => txBuyLp).to.changeTokenBalance(
        paymentToken,
        user.address,
        -(paymentTokenAmount - (paymentTokenAmount % 1))
      );

      await expect(() => txBuyLp).to.changeTokenBalance(
        lpToken,
        user.address,
        lpTokenAmountToBuy
      );

      //Changes balance of the InvetsPool contract
      await expect(() => txBuyLp).to.changeTokenBalance(
        lpToken,
        investPool.address,
        -lpTokenAmountToBuy
      );

      //Changes balance of the fundrising wallet
      await expect(() => txBuyLp).to.changeTokenBalance(
        paymentToken,
        wallet.address,
        (paymentTokenAmount - (paymentTokenAmount % 1))
      );
    });

    it('should sets values after buying correctly', async function () {
      //Call deploy() function
      const {
        user,
        lpToken,
        paymentToken,
        roleContract,
        investPool,
      } = await loadFixture(deploy);

      //Get user role settings before purchase
      const userRoleNumber = await roleContract.getRoleNumber(user.address);
      const userRoleSettings = await investPool.roleSettings(userRoleNumber);

      //Allow contract to take tokens
      const userBalance = await paymentToken.balanceOf(user.address);
      const txApr = await paymentToken
        .connect(user)
        .approve(investPool.address, userBalance);
      await txApr.wait();

      //Buy LP Tokens
      const txBuyLp = await investPool.connect(user).buyLP(lpTokenAmountToBuy);
      await txBuyLp.wait();

      //Get user role settings after purchase
      const userRoleSettings2 = await investPool.roleSettings(userRoleNumber);

      //Calculate payment token amount
      const lpTokenDecimals = await lpToken.decimals()
      const paymentTokenAmountWithoutFee =
        (lpTokenAmountToBuy * price * 10 ** (paymentTokenDecimals - 2)) / 10 ** lpTokenDecimals;
      const paymentTokenAmount = (paymentTokenAmountWithoutFee * 
        (1000 + (userRoleSettings.roleFee == 0 ? baseFee : Number(userRoleSettings.roleFee)))) / 1000;

      //Already bought LP tokens by the user
      expect(await investPool.alreadyBought(user.address)).to.equal(paymentTokenAmountWithoutFee);

      //Already sold LP tokens
      expect(userRoleSettings2.soldAmountForThisRole).to.equal(lpTokenAmountToBuy);
      expect(await investPool.alreadySold()).to.equal(lpTokenAmountToBuy);

      //Total spended tokens
      const totalPaymentTokenSpended = await investPool.totalPaymentTokenSpended();
      expect(Number(totalPaymentTokenSpended)).to.equal(paymentTokenAmount - paymentTokenAmount % 1);
      expect(Number(userRoleSettings2.totalAmountOfPaymentTokenSpended)).to.equal(paymentTokenAmount - paymentTokenAmount % 1);
    });

    it('should emit "Purchase"', async function () {
      //Call deploy() function
      const {
        user,
        paymentToken,
        roleContract,
        investPool,
      } = await loadFixture(deploy);

      //Allow contract to take tokens
      const userBalance = await paymentToken.balanceOf(user.address)
      const txApr = await paymentToken
        .connect(user)
        .approve(investPool.address, userBalance);
      await txApr.wait();

      //Buy LP Tokens
      const txBuyLp = await investPool.connect(user).buyLP(lpTokenAmountToBuy);
      await txBuyLp.wait();

      //Event
      await expect(txBuyLp)
        .to.emit(investPool, "Purchase")
        .withArgs(user.address, lpTokenAmountToBuy);
    });

    it("should not allow InvestPool contract to get payment tokens without allowance", async function () {
      //Call deploy() function
      const {
        user,
        investPool,
      } = await loadFixture(deploy);

      //Try to buy LP Tokens without approve
      await expect(investPool.connect(user).buyLP(lpTokenAmountToBuy))
        .to.be.revertedWith("STF");
    });

    it("should revert with KP", async function () {
      //Call deploy() function
      const {
        manager,
        user,
        lpToken,
        paymentToken,
        roleContract,
        investPool,
        ts,
      } = await loadFixture(deploy);

      // Increase maxAmountToSellForRole amount
      const setUserRoleSettings = await investPool.connect(manager).setRoleSetting({
        roleNumber: 3,
        startTime: ts,
        deadline: ts + 100000,
        roleFee: baseFee,
        maxAmountToSellForRole: maxAmountToSell,
      })

      //Allow contract to take tokens
      const userBalance = await paymentToken.balanceOf(user.address);
      const txApr = await paymentToken
        .connect(user)
        .approve(investPool.address, userBalance);
      await txApr.wait();

      //Buy max amount LP tokens for role
      const txBuyLp = await investPool.connect(user).buyLP(lpTokenAmountToBuy);
      await txBuyLp.wait();

      //Get user role settings
      const userRoleNumber = await roleContract.getRoleNumber(user.address);
      const userRoleSettings = await investPool.roleSettings(userRoleNumber);
      const maxAmout = userRoleSettings.maxAmountToSellForRole;

      //Calculate payment token amount
      const lpTokenDecimals = (await lpToken.decimals())
      const paymentTokenAmountWithoutFee =
        (lpTokenAmountToBuy * price * 10 ** (paymentTokenDecimals - 2)) / 10 ** lpTokenDecimals;
      const paymentTokenAmount = (paymentTokenAmountWithoutFee * 
          (1000 + (userRoleSettings.roleFee == 0 ? baseFee : Number(userRoleSettings.roleFee)))) / 1000;

      await expect(() => txBuyLp).to.changeTokenBalance(
        paymentToken,
        user.address,
        -(paymentTokenAmount - paymentTokenAmount % 1)
      );

      await expect(() => txBuyLp).to.changeTokenBalance(
        lpToken,
        user.address,
        lpTokenAmountToBuy
      );

      //Buy more than max amount LP tokens for role
      await expect(investPool.connect(user).buyLP(maxAmout * 10))
        .to.be.revertedWith("KP");
    });

    it("should revert with IA", async function () {
      //Call deploy() function
      const {
        user,
        investPool,
      } = await loadFixture(deploy);

      //Try to buy 0 LP Tokens
      await expect(investPool.connect(user).buyLP(0))
        .to.be.revertedWith("IA");
    });

    it("should revert with TE (start time has not started)", async function () {
      //Call deploy() function
      const {
        manager,
        user,
        paymentToken,
        roleContract,
        investPool,
        ts,
      } = await loadFixture(deploy);

      //Allow contract to take tokens
      const userBalance = await paymentToken.balanceOf(user.address);
      const txApr = await paymentToken
        .connect(user)
        .approve(investPool.address, userBalance);
      await txApr.wait();

      //Increase startTime
      const setUserRoleSettings = await investPool.connect(manager).setRoleSetting({
        roleNumber: 3,
        startTime: ts + 100,
        deadline: ts + 10000,
        roleFee: baseFee,
        maxAmountToSellForRole: maxAmountToSell,
      })

      //Try to buy LP Tokens
      await expect(investPool.connect(user).buyLP(lpTokenAmountToBuy))
        .to.be.revertedWith("TE");
    })

    it("should revert with TE (deadline is over)", async function () {
      //Call deploy() function
      const {
        manager,
        user,
        paymentToken,
        roleContract,
        investPool,
        ts,
      } = await loadFixture(deploy);

      //Allow contract to take tokens
      const userBalance = await paymentToken.balanceOf(user.address);
      const txApr = await paymentToken
        .connect(user)
        .approve(investPool.address, userBalance);
      await txApr.wait();

      // Decrease deadline
      const setUserRoleSettings = await investPool.connect(manager).setRoleSetting({
        roleNumber: 3,
        startTime: ts,
        deadline: ts,
        roleFee: baseFee,
        maxAmountToSellForRole: maxAmountToSell,
      })

      //Try to buy LP Tokens 
      await expect(investPool.connect(user).buyLP(lpTokenAmountToBuy))
        .to.be.revertedWith("TE");
    });

    it("should revert with RR", async function () {
      //Call deploy() function
      const {
        manager,
        user,
        paymentToken,
        roleContract,
        investPool,
        ts,
      } = await loadFixture(deploy);

      //Allow contract to take tokens
      const userBalance = await paymentToken.balanceOf(user.address);
      const txApr = await paymentToken
        .connect(user)
        .approve(investPool.address, userBalance);
      await txApr.wait();

      //Buy LP tokens
      const txBuyLp = await investPool.connect(user).buyLP(lpTokenAmountToBuy);
      await txBuyLp.wait();

      //Decrease maxAmountToSellForRole
      const setUserRoleSettings = await investPool.connect(manager).setRoleSetting({
        roleNumber: 3,
        startTime: ts,
        deadline: ts + 10000,
        roleFee: baseFee,
        maxAmountToSellForRole: lpTokenAmountToBuy,
      })

      //Try to buy LP Tokens 
      await expect(investPool.connect(user).buyLP(1))
        .to.be.revertedWith("RR");
    });

    it("should revert with LT", async function () {
      //Call deploy() function
      const {
        owner,
        user,
        paymentToken,
        investPool,
        lpToken
      } = await loadFixture(deploy);

      //Allow contract to take tokens from manager
      const ownerBalance = await paymentToken.balanceOf(owner.address);
      const txApr = await paymentToken
        .connect(owner)
        .approve(investPool.address, ownerBalance);
      await txApr.wait();

      //Buy max amount of LP tokens for sale
      const txBuyLp = await investPool.connect(owner).buyLP(maxAmountToSell);
      await txBuyLp.wait();

      //Try to buy LP Tokens 
      await expect(investPool.connect(user).buyLP(lpTokenAmountToBuy))
        .to.be.revertedWith("LT");
    });
  });
});