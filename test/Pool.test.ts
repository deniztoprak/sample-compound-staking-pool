import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { time } from '@nomicfoundation/hardhat-network-helpers';

describe('Pool', function () {
  const ONE_DAY_IN_SECONDS = 60 * 60 * 24;
  // Assume the APR is for 360 days instead of 365
  const ONE_YEAR_IN_SECONDS = ONE_DAY_IN_SECONDS * 360;

  // Define a fixture to reuse the same setup
  async function deployContracts() {
    const CEthToken = await ethers.getContractFactory('DevCEthToken');
    const CEthTokenInstance = await CEthToken.deploy();

    const RewardToken = await ethers.getContractFactory('DevUSDCToken');
    const RewardTokenInitialSupply = ethers.BigNumber.from('999999999999999999999');
    const RewardTokenInstance = await RewardToken.deploy(RewardTokenInitialSupply);

    const PriceFeed = await ethers.getContractFactory('DevPriceAggregator');
    const PriceFeedInstance = await PriceFeed.deploy();

    const Pool = await ethers.getContractFactory('Pool');
    const PoolAPR = ethers.BigNumber.from('10');
    const PoolInstance = await Pool.deploy(
      CEthTokenInstance.address,
      RewardTokenInstance.address,
      PriceFeedInstance.address,
      PoolAPR
    );

    await PoolInstance.deployed();
    // Allow Pool to spend all issued USDC tokens
    await RewardTokenInstance.approve(PoolInstance.address, RewardTokenInitialSupply);

    return { PoolInstance, CEthTokenInstance, RewardTokenInstance, PoolAPR };
  }

  describe('Deployment', function () {
    it('sets the reward token address', async function () {
      const { PoolInstance, RewardTokenInstance } = await loadFixture(deployContracts);
      const rewardToken = await PoolInstance.rewardToken();

      expect(rewardToken).to.equal(RewardTokenInstance.address);
    });

    it('sets the CEth token address', async function () {
      const { PoolInstance, CEthTokenInstance } = await loadFixture(deployContracts);
      const cEthToken = await PoolInstance.cEthToken();

      expect(cEthToken).to.equal(CEthTokenInstance.address);
    });

    it('reverts when the reward token address is not provided', async function () {
      const Pool = await ethers.getContractFactory('Pool');
      const randomAddress = '0x1111111111111111111111111111111111111111';

      await expect(Pool.deploy(randomAddress, ethers.constants.AddressZero, randomAddress, '123')).to.be.revertedWith(
        'Reward token contract address can not be zero'
      );
    });

    it('reverts when the CEth token address is not provided', async function () {
      const Pool = await ethers.getContractFactory('Pool');
      const randomAddress = '0x1111111111111111111111111111111111111111';

      await expect(Pool.deploy(ethers.constants.AddressZero, randomAddress, randomAddress, '123')).to.be.revertedWith(
        'CEth token contract address can not be zero'
      );
    });

    it('sets the annual percentage rate', async function () {
      const { PoolInstance, PoolAPR } = await loadFixture(deployContracts);
      const apr = await PoolInstance.apr();

      expect(apr).to.equal(PoolAPR);
    });

    it('reverts when the annual percentage rate is below 1', async function () {
      const Pool = await ethers.getContractFactory('Pool');
      const randomAddress = '0x1111111111111111111111111111111111111111';
      const PoolAPR = ethers.BigNumber.from('0');
      await expect(Pool.deploy(randomAddress, randomAddress, randomAddress, PoolAPR)).to.be.revertedWith(
        'APR must be between 1 and 100'
      );
    });

    it('reverts when the annual percentage rate is above 100', async function () {
      const Pool = await ethers.getContractFactory('Pool');
      const randomAddress = '0x1111111111111111111111111111111111111111';
      const PoolAPR = ethers.BigNumber.from('101');
      await expect(Pool.deploy(randomAddress, randomAddress, randomAddress, PoolAPR)).to.be.revertedWith(
        'APR must be between 1 and 100'
      );
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
      const totalBalance = await PoolInstance.totalReserve();

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
      const totalBalance = await PoolInstance.totalReserve();

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

    it('emits "withdrawn" event when users withdrawal', async function () {
      const [deployer, user1] = await ethers.getSigners();
      const user1StakedValue = ethers.utils.parseEther('10');
      const { PoolInstance } = await loadFixture(deployContracts);

      await PoolInstance.connect(user1).stake({ value: user1StakedValue });

      await expect(PoolInstance.connect(user1).withdraw(user1StakedValue.sub(1)))
        .to.emit(PoolInstance, 'Withdrawn')
        .withArgs(user1.address, user1StakedValue.sub(1));
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

  describe('Claim', function () {
    it('sends reward when claimed by users', async function () {
      const [deployer, user1, user2] = await ethers.getSigners();
      const user1StakedValue = ethers.utils.parseEther('36');
      const user2StakedValue = ethers.utils.parseEther('72');
      const { PoolInstance, RewardTokenInstance, PoolAPR } = await loadFixture(deployContracts);

      await PoolInstance.connect(user1).stake({ value: user1StakedValue });
      await PoolInstance.connect(user2).stake({ value: user2StakedValue });

      await time.increase(ONE_YEAR_IN_SECONDS);

      await PoolInstance.connect(user1).claimReward();
      await PoolInstance.connect(user2).claimReward();

      const user1ExpectedReward = user1StakedValue.mul(PoolAPR).div(100);
      const user2ExpectedReward = user2StakedValue.mul(PoolAPR).div(100);

      const user1RemainingReward = await PoolInstance.rewardOf(user1.address);
      const user2RemainingReward = await PoolInstance.rewardOf(user2.address);

      const user1ConvertedReward = await RewardTokenInstance.balanceOf(user1.address);
      const user2ConvertedReward = await RewardTokenInstance.balanceOf(user2.address);

      expect(user1RemainingReward).to.be.equal(ethers.BigNumber.from('0'));
      expect(user2RemainingReward).to.be.equal(ethers.BigNumber.from('0'));

      // PriceFeed -> 1 ETH = 2 USD
      expect(user1ConvertedReward).to.be.equal(user1ExpectedReward.mul(2));
      expect(user2ConvertedReward).to.be.equal(user2ExpectedReward.mul(2));
    });

    it("reverts when users don't have any reward", async function () {
      const [deployer, user1] = await ethers.getSigners();
      const user1StakedValue = ethers.utils.parseEther('10');
      const { PoolInstance } = await loadFixture(deployContracts);

      await expect(PoolInstance.connect(user1).claimReward()).to.be.revertedWith("User doesn't have any reward");
    });
  });

  describe('Fallback', function () {
    it('receives liquidity when users send it directly to the contract address', async function () {
      const [deployer, user1] = await ethers.getSigners();
      const user1StakedValue = ethers.utils.parseEther('5');
      const { PoolInstance } = await loadFixture(deployContracts);
      await user1.sendTransaction({ to: PoolInstance.address, value: user1StakedValue });
      const user1Balance = await PoolInstance.balanceOf(user1.address);

      expect(user1Balance).to.equal(user1StakedValue);
    });
  });
});
