import { userActivity, token } from "ponder.schema";
import { Context } from "ponder:registry";
import { Address } from "viem";
import { DERC20ABI } from "@app/abis";

export interface CreateUserActivityParams {
  userId: Address;
  chainId: bigint;
  type: "create" | "stake" | "sell" | "buy" | "unstake" | "claim";
  timestamp: bigint;
  txHash: string;
  logIndex: bigint;
  usdValue?: bigint;
  amountIn?: bigint;
  amountOut?: bigint;
  tokenAddress?: string;
  tokenSymbol?: string;
  tokenAmount?: bigint;
  poolAddress?: string;
  assetAddress?: string;
  metadata?: Record<string, any>;
  context: Context;
}

export async function insertUserActivity({
  userId,
  chainId,
  type,
  timestamp,
  txHash,
  logIndex,
  usdValue = 0n,
  amountIn,
  amountOut,
  tokenAddress,
  tokenSymbol,
  tokenAmount,
  poolAddress,
  assetAddress,
  metadata,
  context,
}: CreateUserActivityParams): Promise<typeof userActivity.$inferSelect> {
  const { db } = context;

  // Create composite ID: {chainId}-{txHash}-{logIndex}
  const id = `${chainId}-${txHash}-${logIndex}`;

  try {
    const userActivityRecord = await db.insert(userActivity).values({
      id,
      userId: userId.toLowerCase(),
      chainId,
      type,
      timestamp,
      txHash,
      usdValue,
      amountIn,
      amountOut,
      tokenAddress: tokenAddress?.toLowerCase(),
      tokenSymbol,
      tokenAmount,
      poolAddress: poolAddress?.toLowerCase(),
      assetAddress: assetAddress?.toLowerCase(),
      metadata: metadata ? JSON.stringify(metadata) : undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return userActivityRecord;
  } catch (error) {
    console.error(`Failed to insert userActivity for user ${userId}, tx ${txHash}:`, error);
    throw error;
  }
}

export interface UpdateUserActivityParams {
  id: string;
  context: Context;
  update: Partial<Omit<typeof userActivity.$inferInsert, 'id' | 'createdAt'>>;
}

export async function updateUserActivity({
  id,
  context,
  update,
}: UpdateUserActivityParams): Promise<typeof userActivity.$inferSelect> {
  const { db } = context;

  try {
    const updatedRecord = await db.update(userActivity, {
      id,
    }).set({
      ...update,
      updatedAt: BigInt(Math.floor(Date.now() / 1000)),
    });

    return updatedRecord;
  } catch (error) {
    console.error(`Failed to update userActivity ${id}:`, error);
    throw error;
  }
}

export async function findUserActivity(
  id: string,
  context: Context
): Promise<typeof userActivity.$inferSelect | undefined> {
  const { db } = context;

  try {
    return await db.find(userActivity, { id });
  } catch (error) {
    console.error(`Failed to find userActivity ${id}:`, error);
    return undefined;
  }
}

/**
 * Get token symbol from database or fallback to on-chain call
 */
export async function getTokenSymbol(
  tokenAddress: string,
  context: Context
): Promise<string | undefined> {
  const { db } = context;

  try {
    // First try to get from database
    const existingToken = await db.find(token, {
      address: tokenAddress.toLowerCase() as Address,
    });

    if (existingToken?.symbol) {
      return existingToken.symbol;
    }

    // Fallback to on-chain call
    const symbolResult = await context.client.readContract({
      abi: DERC20ABI,
      address: tokenAddress as Address,
      functionName: "symbol",
    });

    return symbolResult as string;
  } catch (error) {
    console.error(`Failed to get token symbol for ${tokenAddress}:`, error);
    return undefined;
  }
}
