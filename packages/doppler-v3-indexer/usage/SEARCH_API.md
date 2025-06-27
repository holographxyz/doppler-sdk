# Search API Documentation

## Overview
The search endpoint allows searching for tokens by name, symbol, or address with pagination and customizable sorting.

## Endpoint
```
GET /search/:query
```

## Parameters

### Path Parameters
- `query` (required): Search term to match against token name, symbol, or address

### Query Parameters

#### Filtering
- `chain_ids` (optional): Comma-separated list of chain IDs to filter by
  - Example: `chain_ids=1,8453,84532`
- `promoted` (optional): Filter to show only promoted tokens
  - Values: `true` to show only promoted tokens, omit for all tokens
  - Example: `promoted=true`

#### Pagination
- `page` (optional): Page number (default: 1, minimum: 1)
- `limit` (optional): Results per page (default: 15, maximum: 100, minimum: 1)

#### Sorting
- `sort` (optional): Field to sort by (default: `holderCount`)
- `order` (optional): Sort order - `asc` or `desc` (default: `desc`)

**Available Sort Fields:**
- `holderCount` - Number of token holders
- `volumeUsd` - Trading volume in USD
- `totalSupply` - Total token supply
- `firstSeenAt` - When token was first discovered (timestamp)
- `lastSeenAt` - When token was last seen (timestamp)
- `name` - Token name (alphabetical)
- `symbol` - Token symbol (alphabetical)
- `marketCapUsd` - Market capitalization in USD (from related asset data)

## Search Behavior

### Token Name & Symbol
- Case-insensitive partial matching using wildcards
- Searches for the query anywhere within the field
- Example: `usdc` matches "USDC", "UsdCoin", "MyUSDC", etc.

### Token Address
- Case-insensitive prefix matching
- Searches for addresses that start with the query
- Example: `0x573225b9d4` matches `0x573225b9d473950012c7ad348c334f22bd921265`

### Promoted Token Prioritization
- **Promoted tokens always appear first** in search results
- Within promoted tokens, normal sorting rules apply
- Within non-promoted tokens, normal sorting rules apply
- This prioritization happens automatically for all searches
- Use `promoted=true` parameter to see only promoted tokens

## Response Format

```json
{
  "data": [
    {
      "address": "0x573225b9d473950012c7ad348c334f22bd921265",
      "chainId": "1",
      "name": "Example Token",
      "symbol": "EXT",
      "decimals": 18,
      "totalSupply": "1000000000000000000000000",
      "holderCount": 1250,
      "volumeUsd": "5000000",
      "marketCapUsd": "15000000000",
      "firstSeenAt": "1640995200000",
      "lastSeenAt": "1709251200000",
      "creatorAddress": "0x...",
      "isPromoted": true,
      // ... other token fields
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 15,
    "total": 150,
    "totalPages": 10,
    "hasNext": true,
    "hasPrev": false
  },
  "sort": {
    "field": "holderCount",
    "order": "desc"
  }
}
```

## Example Requests

### Basic Search
```
GET /search/usdc
```
Searches for tokens containing "usdc" in name or symbol, or addresses starting with "usdc", sorted by holder count (desc).

### Search with Chain Filter
```
GET /search/usdc?chain_ids=1,8453
```
Same as above but only on Ethereum (1) and Base (8453).

### Search with Pagination
```
GET /search/usdc?page=2&limit=25
```
Second page with 25 results per page.

### Search with Custom Sort
```
GET /search/usdc?sort=volumeUsd&order=desc
```
Sort by highest trading volume first.

### Search by Address Prefix
```
GET /search/0x573225b9d4?chain_ids=1,8453,84532
```
Find tokens whose address starts with "0x573225b9d4".

### Sort by Market Cap
```
GET /search/usdc?sort=marketCapUsd&order=desc
```
Search for "usdc" tokens sorted by highest market cap first.

### Search Promoted Tokens Only
```
GET /search/usdc?promoted=true
```
Search for "usdc" tokens that are promoted only.

### Search with Promoted Filter and Chain
```
GET /search/token?promoted=true&chain_ids=1,8453
```
Search for "token" among promoted tokens on Ethereum and Base only.

### Advanced Example
```
GET /search/token?chain_ids=1,8453&page=1&limit=50&sort=firstSeenAt&order=asc
```
Search for "token", on Ethereum and Base, first page of 50 results, sorted by oldest tokens first (promoted tokens will still appear first).

## Error Handling

### Invalid Parameters
- Invalid `sort` field → defaults to `holderCount`
- Invalid `order` → defaults to `desc`
- Invalid `page` or `limit` → uses safe defaults (page: 1, limit: 15)
- Invalid `chain_ids` → may cause database errors

### Error Response Format
```json
{
  "error": "Internal Server Error"
}
```

## Implementation Notes

### Frontend Integration
1. Build query strings dynamically based on user selections
2. Handle pagination state for "Load More" or pagination controls
3. Display applied sort configuration from response metadata
4. Provide sort options in UI matching available fields

### Performance Considerations
- Use reasonable page limits (15-50 typically)
- Consider debouncing search input to avoid excessive requests
- Cache results when appropriate
- Sort by indexed fields (`holderCount`, `volumeUsd`) for better performance

### Data Types
- All numeric fields are returned as strings to avoid JavaScript precision issues
- Timestamps are Unix timestamps as strings
- Addresses are lowercase hex strings with "0x" prefix
- Chain IDs are numeric strings
- `marketCapUsd` may be `null` for tokens without associated asset data
- `isPromoted` is a boolean indicating if the token is promoted

## Admin API for Token Promotion

### Authentication
All admin endpoints require authentication via Bearer token in the Authorization header:
```
Authorization: Bearer YOUR_TOKEN_HERE
```

### Promote a Token
```
PUT /api/admin/tokens/:address/promote
```

**Example:**
```bash
curl -X PUT "http://localhost:42069/api/admin/tokens/0x573225b9d473950012c7ad348c334f22bd921265/promote" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "tokenAddress": "0x573225b9d473950012c7ad348c334f22bd921265",
  "isPromoted": true
}
```

### Remove Token Promotion
```
DELETE /api/admin/tokens/:address/promote
```

**Example:**
```bash
curl -X DELETE "http://localhost:42069/api/admin/tokens/0x573225b9d473950012c7ad348c334f22bd921265/promote" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "tokenAddress": "0x573225b9d473950012c7ad348c334f22bd921265",
  "isPromoted": false
}
```

### List All Promoted Tokens
```
GET /api/admin/tokens/promoted?page=1&limit=20
```

**Example:**
```bash
curl "http://localhost:42069/api/admin/tokens/promoted?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "tokens": [
    {
      "address": "0x573225b9d473950012c7ad348c334f22bd921265",
      "chainId": "1",
      "name": "Example Token",
      "symbol": "EXT",
      "isPromoted": true,
      // ... other token fields
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5
  }
}
```

### Admin API Error Responses
- **401 Unauthorized**: Missing or invalid authentication token
- **400 Bad Request**: Invalid token address format or parameters
- **500 Internal Server Error**: Database or server error

## GraphQL Integration

The promoted tokens feature is automatically available in GraphQL queries:

### Query Promoted Tokens via GraphQL
```graphql
query GetPromotedTokens {
  tokens(where: { isPromoted: true }, limit: 10) {
    address
    name
    symbol
    isPromoted
    chainId
    holderCount
  }
}
```

### Filter Tokens by Promotion Status
```graphql
query GetTokensWithFilter($promoted: Boolean) {
  tokens(where: { isPromoted: $promoted }, limit: 20) {
    address
    name
    symbol
    isPromoted
  }
}
```

**Variables:**
```json
{
  "promoted": true
}
```

## Future Enhancements
- Relevance scoring for text search
- Multiple sort fields support
- Search suggestions/autocomplete
- Advanced filtering options
- Promotion tiers and metadata
- Promotion expiration dates
- Bulk promotion management