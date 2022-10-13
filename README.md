# Staking Pool

A naive implementation of a decentralized staking pool running on EVM.

Contracts deployed and verified on Görli testnet:

DevUSDC deployed on: [0xB55886038CD6290318c3998D30009DA416b930a0](https://goerli.etherscan.io/address/0xb55886038cd6290318c3998d30009da416b930a0)

Pool deployed on: [0xea5408f7F4390FB241b92a1AD2FCE7Ed00a97148](https://goerli.etherscan.io/address/0xea5408f7f4390fb241b92a1ad2fce7ed00a97148)

## Functional Requirements

- Write smart contracts for an ETH staking app.
- User can stake their ETH in a vault (Constant APR 10%)
- User gets rewarded in devUSDC (a custom ERC20 token)
- devUSDC is always worth $1
- When a user stakes ETH: all of that ETH will be put as collateral in Compound (v2).
- When a user wants to Withdraw their ETH. The vault will take out the ETH the user staked (without the yields) from Compound and will give it back to the user with the devUSDC rewards
- Minimum amount to stake is 5 ETH
- Use a price oracle from chainlinkTo to get the price of ETH

## Prerequisites

- NodeJs: ^18.9.1
- NPM: ^8.19.1

## Setup

Install dependencies:

```sh
npm install
```

## Run

- Deploy contracts to Görli testnet:

```sh
npm run deploy
```

- Test contracts:

```sh
npm run test
```
