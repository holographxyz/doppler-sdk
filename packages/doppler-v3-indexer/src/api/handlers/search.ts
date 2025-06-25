import type { Context } from 'hono';
import {
  and,
  asc,
  count,
  desc,
  eq,
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
  "symbol",
  "marketCapUsd"
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

    // Check if we should filter by promoted status
    const promotedParam = c.req.query("promoted");
    const filterPromoted = promotedParam === "true";
    
    // For asset fields like marketCapUsd, we'll need to handle sorting differently
    const isAssetField = validSortField === "marketCapUsd";
    
    let results;
    if (isAssetField) {
      // For asset fields, we'll get more results and sort post-query
      // This is a limitation of the relations API for sorting by related fields
      const extendedLimit = Math.min(limit * 10, 1000); // Get more results for sorting
      
      results = await db.query.token.findMany({
        where: or(
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
        ),
        with: {
          derc20Data: true,
        },
        limit: extendedLimit,
      });
      
      // Sort by isPromoted first, then by marketCapUsd
      results.sort((a, b) => {
        // First, sort by isPromoted (promoted tokens first)
        if (a.isPromoted && !b.isPromoted) return -1;
        if (!a.isPromoted && b.isPromoted) return 1;
        
        // Then sort by marketCapUsd
        const aValue = a.derc20Data?.marketCapUsd || 0n;
        const bValue = b.derc20Data?.marketCapUsd || 0n;
        if (validSortOrder === "desc") {
          return Number(bValue - aValue);
        } else {
          return Number(aValue - bValue);
        }
      });
      
      // Apply promoted filter if requested
      if (filterPromoted) {
        results = results.filter(t => t.isPromoted);
      }
      
      // Apply pagination manually
      results = results.slice(offset, offset + limit);
    } else {
      // For token fields, we need to fetch in two queries to prioritize promoted tokens
      const promotedResults = await db.query.token.findMany({
        where: and(
          eq(token.isPromoted, true),
          or(
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
          )
        ),
        with: {
          derc20Data: true,
        },
        orderBy: validSortOrder === "desc" 
          ? desc(token[validSortField])
          : asc(token[validSortField]),
      });
      
      let regularResults = [];
      if (!filterPromoted) {
        regularResults = await db.query.token.findMany({
          where: and(
            eq(token.isPromoted, false),
            or(
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
            )
          ),
          with: {
            derc20Data: true,
          },
          orderBy: validSortOrder === "desc" 
            ? desc(token[validSortField])
            : asc(token[validSortField]),
        });
      }
      
      // Combine results: promoted first, then regular
      const allResults = [...promotedResults, ...regularResults];
      
      // Apply pagination
      results = allResults.slice(offset, offset + limit);
    }

    // Transform results to include marketCapUsd from related asset data
    const transformedResults = results.map(tokenItem => ({
      ...tokenItem,
      marketCapUsd: tokenItem.derc20Data?.marketCapUsd || null,
      derc20Data: tokenItem.derc20Data?.address || tokenItem.derc20Data, // Keep original field format
    }));

    return c.json({
      data: replaceBigInts(transformedResults, (v) => String(v)),
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