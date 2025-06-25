import { Context } from "hono";
import { databaseService } from "../../services/DatabaseService";

// Authentication check using environment variable
const isAuthenticated = (c: Context): boolean => {
  const authHeader = c.req.header("Authorization");
  const adminSecret = process.env.HOLOGRAPH_DOPPLER_ADMIN_SECRET;
  
  // Check if admin secret is configured
  if (!adminSecret) {
    console.error("HOLOGRAPH_DOPPLER_ADMIN_SECRET environment variable not set");
    return false;
  }
  
  // Check if Authorization header exists and has Bearer format
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  
  // Extract token from "Bearer TOKEN"
  const token = authHeader.substring(7); // Remove "Bearer " prefix
  
  // Securely compare tokens
  return token === adminSecret;
};

export const handlePromoteToken = async (c: Context) => {
  // Check authentication
  if (!isAuthenticated(c)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const { address } = c.req.param();
  
  if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
    return c.json({ error: "Invalid token address" }, 400);
  }

  try {
    const normalizedAddress = address.toLowerCase();
    
    // Check if token exists first
    const exists = await databaseService.tokenExists(normalizedAddress);
    if (!exists) {
      return c.json({ error: "Token not found" }, 404);
    }
    
    await databaseService.promoteToken(normalizedAddress);
    
    return c.json({
      success: true,
      tokenAddress: normalizedAddress,
      isPromoted: true,
    });
  } catch (error) {
    console.error("Failed to promote token:", error);
    return c.json({ error: "Failed to promote token" }, 500);
  }
};

export const handleUnpromoteToken = async (c: Context) => {
  // Check authentication
  if (!isAuthenticated(c)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const { address } = c.req.param();
  
  if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
    return c.json({ error: "Invalid token address" }, 400);
  }

  try {
    const normalizedAddress = address.toLowerCase();
    
    // Check if token exists first
    const exists = await databaseService.tokenExists(normalizedAddress);
    if (!exists) {
      return c.json({ error: "Token not found" }, 404);
    }
    
    await databaseService.unpromoteToken(normalizedAddress);
    
    return c.json({
      success: true,
      tokenAddress: normalizedAddress,
      isPromoted: false,
    });
  } catch (error) {
    console.error("Failed to unpromote token:", error);
    return c.json({ error: "Failed to unpromote token" }, 500);
  }
};

export const handleGetPromotedTokens = async (c: Context) => {
  // Check authentication
  if (!isAuthenticated(c)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const page = parseInt(c.req.query("page") || "1", 10);
  const limit = parseInt(c.req.query("limit") || "20", 10);

  if (isNaN(page) || page < 1) {
    return c.json({ error: "Invalid page parameter" }, 400);
  }

  if (isNaN(limit) || limit < 1 || limit > 100) {
    return c.json({ error: "Invalid limit parameter (1-100)" }, 400);
  }

  try {
    const result = await databaseService.getPromotedTokens(page, limit);
    
    // Convert bigint values to strings for JSON serialization
    const tokensWithStringifiedBigInts = result.tokens.map((token: any) => ({
      ...token,
      chainId: String(token.chainId),
      totalSupply: String(token.totalSupply),
      firstSeenAt: String(token.firstSeenAt),
      lastSeenAt: String(token.lastSeenAt),
      volumeUsd: String(token.volumeUsd),
    }));
    
    return c.json({
      tokens: tokensWithStringifiedBigInts,
      pagination: {
        page,
        limit,
        total: result.total,
      },
    });
  } catch (error) {
    console.error("Failed to get promoted tokens:", error);
    return c.json({ error: "Failed to get promoted tokens" }, 500);
  }
};