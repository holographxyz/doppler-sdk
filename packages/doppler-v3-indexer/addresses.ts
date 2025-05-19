import { Address, zeroAddress } from "viem";

export type Network = "mainnet" | "baseSepolia";

export const CHAIN_IDS = {
  mainnet: 1,
  baseSepolia: 84532,
} as const;

const mainnetStartBlock = 22516004;

const baseSepoliaStartBlock = 25938595;

export type IndexerConfigs = Record<Network, DopplerConfig>;

export type DopplerConfig = {
  v2: V2Addresses;
  v3: V3Addresses;
  v4: V4Addresses;
  shared: SharedAddresses;
  oracle: OracleAddresses;
  startBlock: number;
  oracleStartBlock: number;
};

export type SharedAddresses = {
  airlock: Address;
  tokenFactory: Address;
  universalRouter: Address;
  governanceFactory: Address;
  migrator: Address;
  weth: Address;
};

export type V4Addresses = {
  dopplerDeployer: Address;
  v4Initializer: Address;
  stateView: Address;
  poolManager: Address;
};

export type V3Addresses = {
  v3Initializer: Address;
};

export type V2Addresses = {
  factory: Address;
};

export type OracleAddresses = {
  mainnetEthUsdc: Address;
  weth: Address;
  usdc: Address;
  chainlinkEth: Address;
};

export const oracleAddresses: OracleAddresses = {
  mainnetEthUsdc: "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640" as Address,
  weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as Address,
  usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address,
  chainlinkEth: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419" as Address,
};

export const configs: IndexerConfigs = {
  mainnet: {
    v2: {
      factory: zeroAddress as Address,
    },
    v3: {
      v3Initializer: zeroAddress as Address,
    },
    v4: {
      poolManager: zeroAddress as Address,
      dopplerDeployer: zeroAddress as Address,
      v4Initializer: zeroAddress as Address,
      stateView: zeroAddress as Address,
    },
    shared: {
      airlock: zeroAddress as Address,
      tokenFactory: zeroAddress as Address,
      universalRouter: zeroAddress as Address,
      governanceFactory: zeroAddress as Address,
      migrator: zeroAddress as Address,
      weth: zeroAddress as Address,
    },
    oracle: oracleAddresses,
    startBlock: mainnetStartBlock,
    oracleStartBlock: mainnetStartBlock,
  },
  baseSepolia: {
    v2: {
      factory: "0x7Ae58f10f7849cA6F5fB71b7f45CB416c9204b1e" as Address,
    },
    v3: {
      v3Initializer: "0x70d20cd48791E527036491dc464C8Dc58351Dd93" as Address,
    },
    v4: {
      poolManager: "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408" as Address,
      dopplerDeployer: "0xe6946cFa2816BfA083512a9B9b623adAe3062f43" as Address,
      v4Initializer: "0x9b60411Aee66a13eF803f2215EF27D5F9a9052C8" as Address,
      stateView: "0x571291b572ed32ce6751a2cb2486ebee8defb9b4" as Address,
    },
    shared: {
      airlock: "0x193F48A45B6025dDeD10bc4BaeEF65c833696387" as Address,
      tokenFactory: "0x77B5F559EE9cf3bfcf2fFf5731a84332D8eECAC9" as Address,
      universalRouter: "0x95273d871c8156636e114b63797d78D7E1720d81" as Address,
      governanceFactory:
        "0x61096F3179b6AE91bA23BcA1aDbBF26C1744b26e" as Address,
      migrator: "0xb6D69eAA98E657bEEFF7ca4452768e6f707aa6b1" as Address,
      weth: "0x4200000000000000000000000000000000000006" as Address,
    },
    oracle: oracleAddresses,
    startBlock: baseSepoliaStartBlock,
    oracleStartBlock: mainnetStartBlock,
  },
};
