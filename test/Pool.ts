import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

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

      expect(await PoolInstance.rewardToken()).to.equal(USDCTokenInstance.address);
    });

    it('throws when the reward token address is not provided', async function () {
      const Pool = await ethers.getContractFactory('Pool');
      await expect(Pool.deploy(ethers.constants.AddressZero, '123')).to.be.revertedWith(
        'Reward token address can not be zero'
      );
    });

    it('sets the annual percentage rate', async function () {
      const { PoolInstance, PoolAPR } = await loadFixture(deployContracts);

      expect(await PoolInstance.apr()).to.equal(PoolAPR);
    });

    it('throws when the annual percentage rate is below 1', async function () {
      const Pool = await ethers.getContractFactory('Pool');
      const USDCTokenAddress = '0x1111111111111111111111111111111111111111';
      const PoolAPR = ethers.BigNumber.from('0');
      await expect(Pool.deploy(USDCTokenAddress, PoolAPR)).to.be.revertedWith('APR must be between 1 and 100');
    });

    it('throws when the annual percentage rate is above 100', async function () {
      const Pool = await ethers.getContractFactory('Pool');
      const USDCTokenAddress = '0x1111111111111111111111111111111111111111';
      const PoolAPR = ethers.BigNumber.from('101');
      await expect(Pool.deploy(USDCTokenAddress, PoolAPR)).to.be.revertedWith('APR must be between 1 and 100');
    });
  });
});
