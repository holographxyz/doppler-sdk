import type { Context } from 'hono';
import {
  and,
  asc,
  count,
  desc,
  ilike,
  inArray,
  or,
  replaceBigInts,
} from "ponder";
import { db } from "ponder:api";
import { token } from "ponder:schema";

// Define allowed sort fields
const ALLOWED_SORT_FIELDS = [
  "holderCount",
  "volumeUsd",
  "totalSupply",
  "firstSeenAt",
  "lastSeenAt",
  "name",
  "symbol"
] as const;

type SortField = typeof ALLOWED_SORT_FIELDS[number];

// Default sort configuration
const DEFAULT_SORT_FIELD: SortField = "holderCount";
const DEFAULT_SORT_ORDER = "desc";

export async function searchTokens(c: Context) {
  try {
    const query = c.req.param("query");

    // Parse pagination parameters
    const pageParam = c.req.query("page");
    const limitParam = c.req.query("limit");

    const page = Math.max(1, parseInt(pageParam || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitParam || "15") || 15));
    const offset = (page - 1) * limit;

    // Parse sort parameters
    const sortField = c.req.query("sort") || DEFAULT_SORT_FIELD;
    const sortOrder = c.req.query("order") || DEFAULT_SORT_ORDER;

    // Validate sort field
    const validSortField = ALLOWED_SORT_FIELDS.includes(sortField as any) 
      ? sortField as SortField 
      : DEFAULT_SORT_FIELD;

    // Validate sort order
    const validSortOrder = sortOrder === "asc" || sortOrder === "desc" 
      ? sortOrder 
      : DEFAULT_SORT_ORDER;

    const chainIds = c.req
      .query("chain_ids")
      ?.split(",")
      .map((id) => BigInt(id));

    // Build where clause
    const whereClause = or(
      and(
        inArray(token.chainId, chainIds || []),
        or(
          ilike(token.name, `%${query}%`),
          ilike(token.symbol, `%${query}%`)
        )
      ),
      and(
        inArray(token.chainId, chainIds || []),
        ilike(token.address, `${query}%`)
      )
    );

    // Get total count
    const countResult = await db
      .select({ count: count() })
      .from(token)
      .where(whereClause);
    
    const total = Number(countResult[0]?.count || 0);
    const totalPages = Math.ceil(total / limit);

    // Create the orderBy clause based on validated parameters
    const orderByClause = validSortOrder === "desc" 
      ? desc(token[validSortField])
      : asc(token[validSortField]);

    // Get paginated results
    const results = await db
      .select()
      .from(token)
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    return c.json({
      data: replaceBigInts(results, (v) => String(v)),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      sort: {
        field: validSortField,
        order: validSortOrder
      }
    });
  } catch (error) {
    console.error("Error in /search/:query", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
}