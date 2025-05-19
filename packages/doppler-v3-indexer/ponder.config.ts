import { createConfig, factory } from "ponder";
import { getAbiItem, http } from "viem";
import {
  UniswapV3InitializerABI,
  UniswapV4InitializerABI,
  UniswapV3PoolABI,
  AirlockABI,
  DERC20ABI,
  UniswapV2PairABI,
} from "./src/abis";
import { CHAIN_IDS, configs } from "./addresses";

const { mainnet, baseSepolia } = configs;

export default createConfig({
  database: {
    kind: "postgres",
    connectionString: process.env.DATABASE_URL,
    poolConfig: {
      max: 100,
    },
  },
  ordering: "multichain",
  networks: {
    mainnet: {
      chainId: 1,
      transport: http(process.env.PONDER_RPC_URL_1),
    },
    baseSepolia: {
      chainId: CHAIN_IDS.baseSepolia,
      transport: http(process.env.PONDER_RPC_URL_84532),
    },
  },
  blocks: {
    ChainlinkEthPriceFeed: {
      network: "mainnet",
      startBlock: mainnet.oracleStartBlock,
      interval: (60 * 5) / 12, // every 5 minutes
    },
    MetricRefresherBaseSepolia: {
      network: "baseSepolia",
      startBlock: baseSepolia.startBlock,
      interval: 5000, // every 1000 blocks
    },
  },
  contracts: {
    Airlock: {
      abi: AirlockABI,
      network: {
        baseSepolia: {
          startBlock: baseSepolia.startBlock,
          address: baseSepolia.shared.airlock,
        },
      },
    },
    UniswapV3Initializer: {
      abi: UniswapV3InitializerABI,
      network: {
        baseSepolia: {
          startBlock: baseSepolia.startBlock,
          address: baseSepolia.v3.v3Initializer,
        },
      },
    },
    UniswapV4Initializer: {
      abi: UniswapV4InitializerABI,
      network: {
        baseSepolia: {
          startBlock: baseSepolia.startBlock,
          address: baseSepolia.v4.v4Initializer,
        },
      },
    },
    DERC20: {
      abi: DERC20ABI,
      network: {
        baseSepolia: {
          startBlock: baseSepolia.startBlock,
          address: factory({
            address: baseSepolia.v3.v3Initializer,
            event: getAbiItem({ abi: UniswapV3InitializerABI, name: "Create" }),
            parameter: "asset",
          }),
        },
      },
    },
    UniswapV3Pool: {
      abi: UniswapV3PoolABI,
      network: {
        baseSepolia: {
          startBlock: baseSepolia.startBlock,
          address: factory({
            address: baseSepolia.v3.v3Initializer,
            event: getAbiItem({ abi: UniswapV3InitializerABI, name: "Create" }),
            parameter: "poolOrHook",
          }),
        },
      },
    },
    UniswapV2Pair: {
      abi: UniswapV2PairABI,
      network: {
        baseSepolia: {
          startBlock: baseSepolia.startBlock,
          address: factory({
            address: baseSepolia.shared.airlock,
            event: getAbiItem({
              abi: AirlockABI,
              name: "Migrate",
            }),
            parameter: "pool",
          }),
        },
      },
    },
  },
});
