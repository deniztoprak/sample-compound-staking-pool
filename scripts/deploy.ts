import { ethers } from 'hardhat';

async function main() {
  const RewardToken = await ethers.getContractFactory('DevUSDCToken');
  const RewardTokenInitialSupply = ethers.BigNumber.from('999999999999999999999');
  const RewardTokenInstance = await RewardToken.deploy(RewardTokenInitialSupply);

  await RewardTokenInstance.deployed();

  console.log(`DevUSDC deployed to: ${RewardTokenInstance.address}`);

  const Pool = await ethers.getContractFactory('Pool');
  const CETHTokenAddress = '0x64078a6189Bf45f80091c6Ff2fCEe1B15Ac8dbde';
  const PriceFeedAddress = '0xD4a33860578De61DBAbDc8BFdb98FD742fA7028e';
  const PoolAPR = ethers.BigNumber.from('10');
  const PoolInstance = await Pool.deploy(CETHTokenAddress, RewardTokenInstance.address, PriceFeedAddress, PoolAPR);

  await PoolInstance.deployed();

  console.log(`Pool deployed to: ${PoolInstance.address}`);

  await RewardTokenInstance.approve(PoolInstance.address, RewardTokenInitialSupply);

  console.log('DevUSDC allowance of Pool contract is set');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
