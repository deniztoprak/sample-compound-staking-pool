import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { time } from '@nomicfoundation/hardhat-network-helpers';

const ONE_DAY_IN_SECONDS = 60 * 60 * 24;
// Assume the APR is for 360 days instead of 365
const ONE_YEAR_IN_SECONDS = ONE_DAY_IN_SECONDS * 360;

describe('Pool', function () {
  // Define a fixture to reuse the same setup
  async function deployContracts() {
    const USDCToken = await ethers.getContractFactory('DevUSDCToken');
    const USDCTokenInitialSupply = ethers.BigNumber.from('999999999999999999');
    const USDCTokenInstance = await USDCToken.deploy(USDCTokenInitialSupply);

    const Pool = await ethers.getContractFactory('Pool');
    const PoolAPR = ethers.BigNumber.from('10');
    const PoolInstance = await Pool.deploy(USDCTokenInstance.address, PoolAPR);

    await PoolInstance.deployed();
    // Allow Pool to spend all issued USDC tokens
    await USDCTokenInstance.approve(PoolInstance.address, USDCTokenInitialSupply);

    return { PoolInstance, USDCTokenInstance, PoolAPR };
  }

  describe('Deployment', function () {
    it('sets the reward token address', async function () {
      const { PoolInstance, USDCTokenInstance } = await loadFixture(deployContracts);
      const rewardToken = await PoolInstance.rewardToken();

      expect(rewardToken).to.equal(USDCTokenInstance.address);
    });

    it('reverts when the reward token address is not provided', async function () {
      const Pool = await ethers.getContractFactory('Pool');
      await expect(Pool.deploy(ethers.constants.AddressZero, '123')).to.be.revertedWith(
        'Reward token address can not be zero'
      );
    });

    it('sets the annual percentage rate', async function () {
      const { PoolInstance, PoolAPR } = await loadFixture(deployContracts);
      const apr = await PoolInstance.apr();

      expect(apr).to.equal(PoolAPR);
    });

    it('reverts when the annual percentage rate is below 1', async function () {
      const Pool = await ethers.getContractFactory('Pool');
      const USDCTokenAddress = '0x1111111111111111111111111111111111111111';
      const PoolAPR = ethers.BigNumber.from('0');
      await expect(Pool.deploy(USDCTokenAddress, PoolAPR)).to.be.revertedWith('APR must be between 1 and 100');
    });

    it('reverts when the annual percentage rate is above 100', async function () {
      const Pool = await ethers.getContractFactory('Pool');
      const USDCTokenAddress = '0x1111111111111111111111111111111111111111';
      const PoolAPR = ethers.BigNumber.from('101');
      await expect(Pool.deploy(USDCTokenAddress, PoolAPR)).to.be.revertedWith('APR must be between 1 and 100');
    });
  });

  describe('Staking', function () {
    it("updates users' balance when they stake ether", async function () {
      const [deployer, user1, user2] = await ethers.getSigners();
      const user1StakedValue = ethers.utils.parseEther('5');
      const user2StakedValue = ethers.utils.parseEther('10');
      const { PoolInstance } = await loadFixture(deployContracts);
      await PoolInstance.connect(user1).stake({ value: user1StakedValue });
      await PoolInstance.connect(user2).stake({ value: user2StakedValue });
      const user1Balance = await PoolInstance.balanceOf(user1.address);
      const user2Balance = await PoolInstance.balanceOf(user2.address);

      expect(user1Balance).to.equal(user1StakedValue);
      expect(user2Balance).to.equal(user2StakedValue);
    });

    it('updates total balance when users stake ether', async function () {
      const [deployer, user1, user2] = await ethers.getSigners();
      const user1StakedValue = ethers.utils.parseEther('5');
      const user2StakedValue = ethers.utils.parseEther('10');
      const { PoolInstance } = await loadFixture(deployContracts);
      await PoolInstance.connect(user1).stake({ value: user1StakedValue });
      await PoolInstance.connect(user2).stake({ value: user2StakedValue });
      const totalBalance = await ethers.provider.getBalance(PoolInstance.address);

      expect(totalBalance).to.equal(user1StakedValue.add(user2StakedValue));
    });

    it('updates rewards when users stake', async function () {
      const [deployer, user1, user2] = await ethers.getSigners();
      const user1StakedValue = ethers.utils.parseEther('36');
      const user2StakedValue = ethers.utils.parseEther('72');
      const { PoolInstance, PoolAPR } = await loadFixture(deployContracts);
      // Initial stake
      await PoolInstance.connect(user1).stake({ value: user1StakedValue });
      await PoolInstance.connect(user2).stake({ value: user2StakedValue });
      // Fast forward 1 year
      await time.increase(ONE_YEAR_IN_SECONDS);

      const user1Reward = await PoolInstance.rewardOf(user1.address);
      const user2Reward = await PoolInstance.rewardOf(user2.address);
      const user1ExpectedReward = user1StakedValue.mul(PoolAPR).div(100);
      const user2ExpectedReward = user2StakedValue.mul(PoolAPR).div(100);

      expect(user1Reward).to.equal(user1ExpectedReward);
      expect(user2Reward).to.equal(user2ExpectedReward);
    });

    it('updates rewards when users increase their stake', async function () {
      const [deployer, user1] = await ethers.getSigners();
      const user1StakedValue = ethers.utils.parseEther('36');
      const { PoolInstance, PoolAPR } = await loadFixture(deployContracts);
      // Initial stake
      await PoolInstance.connect(user1).stake({ value: user1StakedValue });
      // Fast forward 1 year
      await time.increase(ONE_YEAR_IN_SECONDS);
      // Additional stake
      await PoolInstance.connect(user1).stake({ value: user1StakedValue });
      await time.increase(ONE_YEAR_IN_SECONDS / 2);

      const user1Reward = await PoolInstance.rewardOf(user1.address);
      const expectedReward = user1StakedValue.mul(2).mul(PoolAPR).div(100);

      expect(user1Reward).to.equal(expectedReward);
    });

    it('emits "staked" event when users stake', async function () {
      const [deployer, user1] = await ethers.getSigners();
      const user1StakedValue = ethers.utils.parseEther('36');
      const { PoolInstance } = await loadFixture(deployContracts);

      await expect(PoolInstance.connect(user1).stake({ value: user1StakedValue }))
        .to.emit(PoolInstance, 'Staked')
        .withArgs(user1.address, user1StakedValue);
    });

    it('reverts when user staked less than 5 ETH', async function () {
      const [deployer, user1] = await ethers.getSigners();
      const user1StakedValue = ethers.utils.parseEther('4.9');
      const { PoolInstance } = await loadFixture(deployContracts);

      await expect(PoolInstance.connect(user1).stake({ value: user1StakedValue })).to.be.revertedWith(
        'Staking amount should be minimum 5 ETH'
      );
    });
  });

  describe('Withdrawal', function () {
    it("updates users' balance when they withdraw ether", async function () {
      const [deployer, user1, user2] = await ethers.getSigners();
      const user1StakedValue = ethers.utils.parseEther('5');
      const user2StakedValue = ethers.utils.parseEther('10');
      const { PoolInstance } = await loadFixture(deployContracts);
      await PoolInstance.connect(user1).stake({ value: user1StakedValue });
      await PoolInstance.connect(user2).stake({ value: user2StakedValue });
      await PoolInstance.connect(user1).withdraw(user1StakedValue.div(2));
      await PoolInstance.connect(user2).withdraw(user2StakedValue.div(2));
      const user1Balance = await PoolInstance.balanceOf(user1.address);
      const user2Balance = await PoolInstance.balanceOf(user2.address);

      expect(user1Balance).to.equal(user1StakedValue.div(2));
      expect(user2Balance).to.equal(user2StakedValue.div(2));
    });

    it('updates total balance when users withdraw ether', async function () {
      const [deployer, user1, user2] = await ethers.getSigners();
      const user1StakedValue = ethers.utils.parseEther('5');
      const user2StakedValue = ethers.utils.parseEther('10');
      const { PoolInstance } = await loadFixture(deployContracts);
      await PoolInstance.connect(user1).stake({ value: user1StakedValue });
      await PoolInstance.connect(user2).stake({ value: user2StakedValue });
      await PoolInstance.connect(user1).withdraw(user1StakedValue.div(2));
      await PoolInstance.connect(user2).withdraw(user2StakedValue.div(2));
      const totalBalance = await ethers.provider.getBalance(PoolInstance.address);

      expect(totalBalance).to.equal(user1StakedValue.add(user2StakedValue).div(2));
    });

    it('updates rewards when users withdraw liquidity', async function () {
      const [deployer, user1, user2] = await ethers.getSigners();
      const user1StakedValue = ethers.utils.parseEther('36');
      const user2StakedValue = ethers.utils.parseEther('72');
      const { PoolInstance, PoolAPR } = await loadFixture(deployContracts);
      // Initial stake
      await PoolInstance.connect(user1).stake({ value: user1StakedValue });
      await PoolInstance.connect(user2).stake({ value: user2StakedValue });
      // Fast forward 1 year
      await time.increase(ONE_YEAR_IN_SECONDS);
      // Withdrawal
      await PoolInstance.connect(user1).withdraw(user1StakedValue.div(2));
      await PoolInstance.connect(user2).withdraw(user2StakedValue.div(2));
      // Fast forward 2 years
      await time.increase(ONE_YEAR_IN_SECONDS * 2);

      const user1Reward = await PoolInstance.rewardOf(user1.address);
      const user2Reward = await PoolInstance.rewardOf(user2.address);
      const user1ExpectedReward = user1StakedValue.mul(PoolAPR).div(100).mul(2);
      const user2ExpectedReward = user2StakedValue.mul(PoolAPR).div(100).mul(2);

      expect(user1Reward).to.equal(user1ExpectedReward);
      expect(user2Reward).to.equal(user2ExpectedReward);
    });

    it('transfers withdrawn liquidity to users', async function () {
      const [deployer, user1, user2] = await ethers.getSigners();
      const user1StakedValue = ethers.utils.parseEther('50');
      const user2StakedValue = ethers.utils.parseEther('100');
      const { PoolInstance, PoolAPR } = await loadFixture(deployContracts);

      await PoolInstance.connect(user1).stake({ value: user1StakedValue });
      await PoolInstance.connect(user2).stake({ value: user2StakedValue });

      const user1InitialBalance = await ethers.provider.getBalance(user1.address);
      const user2InitialBalance = await ethers.provider.getBalance(user2.address);

      await PoolInstance.connect(user1).withdraw(user1StakedValue.div(2));
      await PoolInstance.connect(user2).withdraw(user2StakedValue.div(2));

      const user1Balance = await ethers.provider.getBalance(user1.address);
      const user2Balance = await ethers.provider.getBalance(user2.address);

      // Exact balance can not be checked because of unknown gas usage
      expect(user1Balance).to.be.greaterThan(user1InitialBalance);
      expect(user2Balance).to.be.greaterThan(user2InitialBalance);
    });

    it('reverts when withdraw amount is 0', async function () {
      const [deployer, user1] = await ethers.getSigners();
      const user1StakedValue = ethers.utils.parseEther('10');
      const { PoolInstance } = await loadFixture(deployContracts);

      await PoolInstance.connect(user1).stake({ value: user1StakedValue });

      await expect(PoolInstance.connect(user1).withdraw(ethers.BigNumber.from('0'))).to.be.revertedWith(
        'Withdraw amount can not be 0'
      );
    });

    it("reverts when users don't have enough balance", async function () {
      const [deployer, user1] = await ethers.getSigners();
      const user1StakedValue = ethers.utils.parseEther('10');
      const { PoolInstance } = await loadFixture(deployContracts);

      await PoolInstance.connect(user1).stake({ value: user1StakedValue });

      await expect(PoolInstance.connect(user1).withdraw(user1StakedValue.add(1))).to.be.revertedWith(
        "User doesn't have enough balance"
      );
    });
  });
});
