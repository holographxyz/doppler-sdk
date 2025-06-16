import { ponder } from "ponder:registry";
import { computeV3Price } from "@app/utils/v3-utils";
import { computeGraduationThresholdDelta } from "@app/utils/v3-utils/computeGraduationThreshold";
import { computeGraduationPercentage } from "@app/utils/computeGraduationPercentage";
import {
  insertPositionIfNotExists,
  updatePosition,
} from "./shared/entities/position";
import { insertTokenIfNotExists } from "./shared/entities/token";
import {
  insertOrUpdateDailyVolume,
  compute24HourPriceChange,
} from "./shared/timeseries";
import {
  insertPoolIfNotExists,
  updatePool,
} from "./shared/entities/pool";
import { insertAssetIfNotExists, updateAsset } from "./shared/entities/asset";
import { computeDollarLiquidity } from "@app/utils/computeDollarLiquidity";
import { insertOrUpdateBuckets } from "./shared/timeseries";
import { computeMarketCap, fetchEthPrice } from "./shared/oracle";
import {
  insertActivePoolsBlobIfNotExists,
  tryAddActivePool,
} from "./shared/scheduledJobs";
import { insertSwapIfNotExists } from "./shared/entities/swap";
import { CHAINLINK_ETH_DECIMALS, WAD } from "@app/utils/constants";

ponder.on("UniswapV3Initializer:Create", async ({ event, context }) => {
  const { poolOrHook, asset, numeraire } = event.args;
  const timestamp = event.block.timestamp;

  const creatorId = event.transaction.from.toLowerCase() as `0x${string}`;
  const numeraireId = numeraire.toLowerCase() as `0x${string}`;
  const assetId = asset.toLowerCase() as `0x${string}`;
  const poolOrHookId = poolOrHook.toLowerCase() as `0x${string}`;

  const ethPrice = await fetchEthPrice(timestamp, context);

  const { price } = await insertPoolIfNotExists({
    poolAddress: poolOrHookId,
    context,
    timestamp,
    ethPrice,
  });

  const { totalSupply } = await insertTokenIfNotExists({
    tokenAddress: assetId,
    creatorAddress: creatorId,
    timestamp,
    context,
    isDerc20: true,
  });

  await insertTokenIfNotExists({
    tokenAddress: numeraireId,
    creatorAddress: creatorId,
    timestamp,
    context,
    isDerc20: false,
  });

  const marketCapUsd = computeMarketCap({
    price,
    ethPrice,
    totalSupply,
  });

  await insertActivePoolsBlobIfNotExists({
    context,
  });
  await insertAssetIfNotExists({
    assetAddress: assetId,
    timestamp,
    context,
  });
  await insertOrUpdateBuckets({
    poolAddress: poolOrHookId,
    price,
    timestamp,
    ethPrice,
    context,
  });

  await insertOrUpdateDailyVolume({
    poolAddress: poolOrHookId,
    amountIn: 0n,
    amountOut: 0n,
    timestamp,
    context,
    tokenIn: assetId,
    tokenOut: numeraireId,
    ethPrice,
    marketCapUsd,
  });
});

ponder.on("UniswapV3Pool:Initialize", async ({ event, context }) => {
  const address = event.log.address.toLowerCase() as `0x${string}`;
  const timestamp = event.block.timestamp;

  const ethPrice = await fetchEthPrice(timestamp, context);

  await insertPoolIfNotExists({
    poolAddress: address,
    timestamp,
    context,
    ethPrice,
  });
});

ponder.on("UniswapV3Pool:Mint", async ({ event, context }) => {
  const address = event.log.address.toLowerCase() as `0x${string}`;
  const { tickLower, tickUpper, amount, owner, amount0, amount1 } = event.args;
  const timestamp = event.block.timestamp;

  const ethPrice = await fetchEthPrice(timestamp, context);

  const {
    baseToken,
    isToken0,
    price,
    liquidity,
    reserves0,
    reserves1,
    graduationThreshold,
    graduationBalance,
  } = await insertPoolIfNotExists({
    poolAddress: address,
    timestamp,
    context,
    ethPrice,
  });

  const reserveAssetBefore = isToken0 ? reserves0 : reserves1;
  const reserveQuoteBefore = isToken0 ? reserves1 : reserves0;

  const reserveAssetDelta = isToken0 ? amount0 : amount1;
  const reserveQuoteDelta = isToken0 ? amount1 : amount0;

  const nextReservesAsset = reserveAssetBefore + reserveAssetDelta;
  const nextReservesQuote = reserveQuoteBefore + reserveQuoteDelta;

  await insertAssetIfNotExists({
    assetAddress: baseToken,
    timestamp,
    context,
  });

  const liquidityUsd = computeDollarLiquidity({
    assetBalance: nextReservesAsset,
    quoteBalance: nextReservesQuote,
    price,
    ethPrice,
  });

  const graduationThresholdDelta = computeGraduationThresholdDelta({
    tickLower,
    tickUpper,
    liquidity: amount,
    isToken0,
  });

  await insertAssetIfNotExists({
    assetAddress: baseToken,
    timestamp,
    context,
  });

  await updateAsset({
    assetAddress: baseToken,
    context,
    update: {
      liquidityUsd,
    },
  });

  const newGraduationThreshold = graduationThreshold + graduationThresholdDelta;
  const graduationPercentage = computeGraduationPercentage(
    graduationBalance,
    newGraduationThreshold
  );

  await updatePool({
    poolAddress: address,
    context,
    update: {
      graduationThreshold: newGraduationThreshold,
      graduationPercentage,
      liquidity: liquidity + amount,
      dollarLiquidity: liquidityUsd,
      reserves0: reserves0 + amount0,
      reserves1: reserves1 + amount1,
    },
  });

  const positionEntity = await insertPositionIfNotExists({
    poolAddress: address,
    tickLower,
    tickUpper,
    liquidity: amount,
    owner,
    timestamp,
    context,
  });

  if (positionEntity.createdAt != timestamp) {
    await updatePosition({
      poolAddress: address,
      tickLower,
      tickUpper,
      context,
      update: {
        liquidity: positionEntity.liquidity + amount,
      },
    });
  }
});

ponder.on("UniswapV3Pool:Burn", async ({ event, context }) => {
  const address = event.log.address.toLowerCase() as `0x${string}`;
  const timestamp = event.block.timestamp;
  const { tickLower, tickUpper, owner, amount, amount0, amount1 } = event.args;

  const ethPrice = await fetchEthPrice(timestamp, context);

  const {
    baseToken,
    isToken0,
    price,
    liquidity,
    reserves0,
    reserves1,
    graduationThreshold,
    graduationBalance,
  } = await insertPoolIfNotExists({
    poolAddress: address,
    timestamp,
    context,
    ethPrice,
  });

  const reserveAssetBefore = isToken0 ? reserves0 : reserves1;
  const reserveQuoteBefore = isToken0 ? reserves1 : reserves0;

  const reserveAssetDelta = isToken0 ? amount0 : amount1;
  const reserveQuoteDelta = isToken0 ? amount1 : amount0;

  const nextReservesAsset = reserveAssetBefore - reserveAssetDelta;
  const nextReservesQuote = reserveQuoteBefore - reserveQuoteDelta;

  const liquidityUsd = computeDollarLiquidity({
    assetBalance: nextReservesAsset,
    quoteBalance: nextReservesQuote,
    price,
    ethPrice,
  });

  const graduationThresholdDelta = computeGraduationThresholdDelta({
    tickLower,
    tickUpper,
    liquidity,
    isToken0,
  });

  const positionEntity = await insertPositionIfNotExists({
    poolAddress: address,
    tickLower,
    tickUpper,
    liquidity: amount,
    owner,
    timestamp,
    context,
  });

  await updateAsset({
    assetAddress: baseToken,
    context,
    update: {
      liquidityUsd,
    },
  });
  const newGraduationThreshold = graduationThreshold - graduationThresholdDelta;
  const graduationPercentage = computeGraduationPercentage(
    graduationBalance,
    newGraduationThreshold
  );

  await updatePool({
    poolAddress: address,
    context,
    update: {
      liquidity: liquidity - amount,
      dollarLiquidity: liquidityUsd,
      graduationThreshold: newGraduationThreshold,
      graduationPercentage,
      reserves0: reserves0 - amount0,
      reserves1: reserves1 - amount1,
    },
  });
  await updatePosition({
    poolAddress: address,
    tickLower,
    tickUpper,
    context,
    update: {
      liquidity: positionEntity.liquidity - amount,
    },
  });
});

ponder.on("UniswapV3Pool:Swap", async ({ event, context }) => {
  const { chain } = context;
  const address = event.log.address.toLowerCase() as `0x${string}`;
  const timestamp = event.block.timestamp;
  const { amount0, amount1, sqrtPriceX96 } = event.args;

  const ethPrice = await fetchEthPrice(event.block.timestamp, context);

  const chainId = chain.id;

  const {
    isToken0,
    baseToken,
    quoteToken,
    reserves0,
    reserves1,
    fee,
    totalFee0,
    totalFee1,
    graduationBalance,
    graduationThreshold,
  } = await insertPoolIfNotExists({
    poolAddress: address,
    timestamp,
    context,
    ethPrice,
  });

  const asset = await insertAssetIfNotExists({
    assetAddress: baseToken.toLowerCase() as `0x${string}`,
    timestamp,
    context,
  });

  const price = computeV3Price({
    sqrtPriceX96,
    isToken0,
    decimals: 18,
  });

  const reserveAssetBefore = isToken0 ? reserves0 : reserves1;
  const reserveQuoteBefore = isToken0 ? reserves1 : reserves0;

  const reserveAssetDelta = isToken0 ? amount0 : amount1;
  const reserveQuoteDelta = isToken0 ? amount1 : amount0;

  const nextReservesAsset = reserveAssetBefore + reserveAssetDelta;
  const nextReservesQuote = reserveQuoteBefore + reserveQuoteDelta;

  const token0 = isToken0 ? baseToken : quoteToken;
  const token1 = isToken0 ? quoteToken : baseToken;

  const tokenIn = amount0 > 0n ? token0 : token1;
  const tokenOut = amount0 > 0n ? token1 : token0;

  let amountIn;
  let amountOut;
  let fee0;
  let fee1;
  if (amount0 > 0n) {
    amountIn = amount0;
    amountOut = amount1;
    fee0 = (amountIn * BigInt(fee)) / BigInt(1_000_000);
    fee1 = 0n;
  } else {
    amountIn = amount1;
    amountOut = amount0;
    fee1 = (amountIn * BigInt(fee)) / BigInt(1_000_000);
    fee0 = 0n;
  }

  let type = "buy";
  if (isToken0 && amount0 > 0n) {
    type = "buy";
  } else if (!isToken0 && amount0 > 0n) {
    type = "sell";
  } else if (isToken0 && amount0 < 0n) {
    type = "sell";
  } else if (!isToken0 && amount0 < 0n) {
    type = "buy";
  }

  const quoteDelta = isToken0 ? amount1 - fee1 : amount0 - fee0;

  const dollarLiquidity = computeDollarLiquidity({
    assetBalance: nextReservesAsset,
    quoteBalance: nextReservesQuote,
    price,
    ethPrice,
  });

  const { totalSupply } = await insertTokenIfNotExists({
    tokenAddress: baseToken,
    creatorAddress: address,
    timestamp,
    context,
    isDerc20: true,
    poolAddress: address,
  });

  const marketCapUsd = computeMarketCap({
    price,
    ethPrice,
    totalSupply,
  });

  const swapValueUsd = reserveQuoteDelta * ethPrice / CHAINLINK_ETH_DECIMALS;

  const priceChangeInfo = await compute24HourPriceChange({
    poolAddress: address,
    marketCapUsd,
    context,
  });

  await tryAddActivePool({
    poolAddress: address,
    lastSwapTimestamp: Number(timestamp),
    context,
  });
  await insertOrUpdateBuckets({
    poolAddress: address,
    price,
    timestamp,
    ethPrice,
    context,
  });
  await insertOrUpdateDailyVolume({
    poolAddress: address,
    amountIn,
    amountOut,
    timestamp,
    context,
    tokenIn,
    tokenOut,
    ethPrice,
    marketCapUsd,
  });
  const newGraduationBalance = graduationBalance + quoteDelta;
  const graduationPercentage = computeGraduationPercentage(
    newGraduationBalance,
    graduationThreshold
  );

  await updatePool({
    poolAddress: address,
    context,
    update: {
      sqrtPrice: sqrtPriceX96,
      price,
      dollarLiquidity,
      totalFee0: totalFee0 + fee0,
      totalFee1: totalFee1 + fee1,
      graduationBalance: newGraduationBalance,
      graduationPercentage,
      lastRefreshed: timestamp,
      lastSwapTimestamp: timestamp,
      marketCapUsd,
      percentDayChange: priceChangeInfo,
      reserves0: reserves0 + amount0,
      reserves1: reserves1 + amount1,
    },
  });
  await insertSwapIfNotExists({
    txHash: event.transaction.hash,
    timestamp,
    context,
    pool: address,
    asset: baseToken,
    chainId: BigInt(chainId),
    type,
    user: event.transaction.from,
    amountIn,
    amountOut,
    usdPrice: swapValueUsd,
  });
  await updateAsset({
    assetAddress: asset.address,
    context,
    update: {
      liquidityUsd: dollarLiquidity,
      percentDayChange: priceChangeInfo,
      marketCapUsd,
    },
  });
});
