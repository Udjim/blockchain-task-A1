const { expect } = require("chai");
const { ethers } = require("hardhat");
const data = require("./testdata.json");

function tokens(amount) {
  return ethers.utils.parseUnits(amount.toString(), "ether");
}

describe("Testing the functions of the InvestPool.sol", () => {
  let deployer,
    user1,
    user2,
    user3,
    user4,
    token,
    lpToken,
    roleContract,
    investPool,
    latestBlock,
    tx;

  beforeEach(async () => {
    [deployer, user1, user2, user3, user4] = await ethers.getSigners();
    const provider = new ethers.providers.JsonRpcProvider(
      "http://127.0.0.1:8545"
    );
    token = await ethers.deployContract("Token", data.tokenArgs, deployer);
    lpToken = await ethers.deployContract(
      "LPtoken",
      [data.lpTokenArgs.name, data.lpTokenArgs.symbol, deployer.address],
      deployer
    );

    roleContract = await ethers.deployContract("RoleContract", deployer);

    const rolesInit = [
      {
        roleNumber: data.rolesInit[0].roleNumber,
        isExist: data.rolesInit[0].isExist,
        minAmount: tokens(data.rolesInit[0].minAmount),
        maxAmount: tokens(data.rolesInit[0].maxAmount),
      },
      {
        roleNumber: data.rolesInit[1].roleNumber,
        isExist: data.rolesInit[1].isExist,
        minAmount: tokens(data.rolesInit[1].minAmount),
        maxAmount: tokens(data.rolesInit[1].maxAmount),
      },
      {
        roleNumber: data.rolesInit[2].roleNumber,
        isExist: data.rolesInit[2].isExist,
        minAmount: tokens(data.rolesInit[2].minAmount),
        maxAmount: tokens(data.rolesInit[2].maxAmount),
      },
    ];

    roleContract
      .connect(deployer)
      .initialize(deployer.address, deployer.address, rolesInit);

    latestBlock = await provider.getBlock("latest");

    const usersRole = [
      {
        roleNumber: data.rolesInit[0].roleNumber,
        startTime: latestBlock.timestamp,
        deadline: latestBlock.timestamp + 60 * 60 * 1000,
        roleFee: data.rolesInit[0].roleFee,
        maxAmountToSellForRole: tokens(
          data.rolesInit[0].maxAmountToSellForRole
        ),
      },
      {
        roleNumber: data.rolesInit[1].roleNumber,
        startTime: latestBlock.timestamp,
        deadline: latestBlock.timestamp + 60 * 60 * 1000,
        roleFee: data.rolesInit[1].roleFee,
        maxAmountToSellForRole: tokens(
          data.rolesInit[1].maxAmountToSellForRole
        ),
      },
      {
        roleNumber: data.rolesInit[2].roleNumber,
        startTime: latestBlock.timestamp,
        deadline: latestBlock.timestamp + 60 * 60 * 1000,
        roleFee: data.rolesInit[2].roleFee,
        maxAmountToSellForRole: tokens(
          data.rolesInit[2].maxAmountToSellForRole
        ),
      },
    ];

    investPool = await ethers.deployContract(
      "InvestPool",
      [
        lpToken.address,
        roleContract.address,
        token.address,
        deployer.address,
        data.investPoolArgs.baseFee,
        data.investPoolArgs.price,
        tokens(data.investPoolArgs.maxAmountToSell),
        deployer.address,
        usersRole,
      ],
      deployer
    );

    tx = await token.mint(deployer.address, tokens(data.INITIAL_SUPPLY_TKN));
    await tx.wait();

    const ownerBalance = await token.balanceOf(deployer.address);
    expect(await token.totalSupply()).to.equal(ownerBalance);
    expect(await token.balanceOf(deployer.address)).to.equal(
      tokens(data.INITIAL_SUPPLY_TKN)
    );

    tx = await token.transfer(user1.address, tokens(1200));
    await tx.wait();

    const userTokenBalance = await token.balanceOf(user1.address);
    expect(userTokenBalance).to.equal(tokens(1200));

    tx = await lpToken.mint(
      investPool.address,
      tokens(data.INITIAL_SUPPLY_LPT)
    );
    await tx.wait();

    const poolLPTBalance = await lpToken.balanceOf(investPool.address);
    expect(poolLPTBalance).to.equal(tokens(data.INITIAL_SUPPLY_LPT));

    /// Set role for user1 ///
    let role = await roleContract.getRole(user1.address);
    expect(role.isExist).to.equal(false);

    tx = await roleContract.connect(deployer).giveRole(user1.address, 1, 1);
    tx.wait();

    let roleNumber = await roleContract.getRoleNumber(user1.address);
    expect(roleNumber).to.equal(1);

    /// Set approve for InvestPoll of user1 ///

    tx = await token.connect(user1).approve(investPool.address, tokens(1200));
    await tx.wait();

    /// Set role for user1#2 ///
    role = await roleContract.getRole(user2.address);
    expect(role.isExist).to.equal(false);

    tx = await roleContract.connect(deployer).giveRole(user2.address, 1, 1);
    tx.wait();

    roleNumber = await roleContract.getRoleNumber(user2.address);
    expect(roleNumber).to.equal(1);

    /// Transfer tokens to user1#2 ///

    tx = await token.transfer(user2.address, tokens(300));
    await tx.wait();

    /// Set approve for InvestPoll of user1#2///

    tx = await token.connect(user2).approve(investPool.address, tokens(300));
    await tx.wait();

    /// Set role for user1#3 ///

    role = await roleContract.getRole(user3.address);
    expect(role.isExist).to.equal(false);

    tx = await roleContract.connect(deployer).giveRole(user3.address, 2, 1);
    tx.wait();

    roleNumber = await roleContract.getRoleNumber(user3.address);
    expect(roleNumber).to.equal(2);

    /// Transfer tokens to user1#3 ///

    tx = await token.transfer(user3.address, tokens(450));
    await tx.wait();

    /// Set approve for InvestPoll of user1#3///

    tx = await token.connect(user3).approve(investPool.address, tokens(450));
    await tx.wait();

    /// Transfer tokens to user1#4 ///

    tx = await token.transfer(user4.address, tokens(50));
    await tx.wait();

    /// Set approve for InvestPoll of user1#4///

    tx = await token.connect(user4).approve(investPool.address, tokens(50));
    await tx.wait();
  });

  it("Buy LPtoken", async () => {
    /// Check balance of owner ///

    const ownerTokenBalanceBefore = await token.balanceOf(deployer.address);

    /// Buy LP Token ///

    tx = await investPool.connect(user1).buyLP(tokens(100));
    await tx.wait();

    /// Check amount of LP Tokens ///

    let userLPTokenBalance = await lpToken.balanceOf(user1.address);
    expect(userLPTokenBalance).to.equal(tokens(100));
    let poolLPTokenBalance = await lpToken.balanceOf(investPool.address);
    expect(poolLPTokenBalance).to.equal(tokens(1900));

    /// Check amount of Tokens ///

    const userTokenBalance = await token.balanceOf(user1.address);

    const expectUserTokenBalance = tokens(1200).sub(
      tokens(100).add(tokens(100).mul(data.rolesInit[1].roleFee).div(1000))
    );
    expect(userTokenBalance).to.equal(expectUserTokenBalance);

    const pullTokenBalance = await token.balanceOf(investPool.address);
    expect(pullTokenBalance).to.equal(0);

    const ownerTokenBalanceAfter = await token.balanceOf(deployer.address);

    const expectOwnerTokenBalance = ownerTokenBalanceBefore.add(
      tokens(100).add(tokens(100).mul(data.rolesInit[1].roleFee).div(1000))
    );

    expect(ownerTokenBalanceAfter).to.equal(expectOwnerTokenBalance);

    /// Сhecking second purchase ///

    tx = await investPool.connect(user1).buyLP(tokens(100));
    await tx.wait();

    userLPTokenBalance = await lpToken.balanceOf(user1.address);
    expect(userLPTokenBalance).to.equal(tokens(200));
    poolLPTokenBalance = await lpToken.balanceOf(investPool.address);
    expect(poolLPTokenBalance).to.equal(tokens(1800));
  });

  it("Check minAmount and maxAmount for role", async () => {
    await expect(
      investPool.connect(user1).buyLP(tokens(1100))
    ).to.be.revertedWith("KP");

    await expect(investPool.connect(user1).buyLP(tokens(7))).to.be.revertedWith(
      "IA"
    );

    tx = await investPool.connect(user1).buyLP(tokens(1000));
    await tx.wait();

    await expect(investPool.connect(user1).buyLP(tokens(1))).to.be.revertedWith(
      "KP"
    );
  });

  it("Check maxAmountToSellForRole for role", async () => {
    tx = await investPool.connect(user1).buyLP(tokens(1000));
    await tx.wait();
    tx = await investPool.connect(user2).buyLP(tokens(100));
    await tx.wait();
    await expect(investPool.connect(user2).buyLP(tokens(1))).to.be.revertedWith(
      "RR"
    );
  });

  it("Check maxAmountToSell", async () => {
    tx = await investPool.connect(user1).buyLP(tokens(1000));
    await tx.wait();
    tx = await investPool.connect(user2).buyLP(tokens(100));
    await tx.wait();
    tx = await investPool.connect(user3).buyLP(tokens(400));
    await tx.wait();
    await expect(investPool.connect(user3).buyLP(tokens(1))).to.be.revertedWith(
      "LT"
    );
  });

  it("Check if user1 has no role", async () => {
    await expect(
      investPool.connect(user4).buyLP(tokens(20))
    ).to.be.revertedWith("KP");
  });

  it("Check deadline for role", async () => {
    tx = await investPool.connect(user1).buyLP(tokens(100));
    await tx.wait();

    latestBlock = await ethers.provider.getBlock("latest");

    await ethers.provider.send("evm_increaseTime", [3600000]);
    await ethers.provider.send("evm_mine");

    latestBlock = await ethers.provider.getBlock("latest");

    await expect(
      investPool.connect(user1).buyLP(tokens(100))
    ).to.be.revertedWith("TE");
    await tx.wait();
  });
});