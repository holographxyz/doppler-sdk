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

## Search Behavior

### Token Name & Symbol
- Case-insensitive partial matching using wildcards
- Searches for the query anywhere within the field
- Example: `usdc` matches "USDC", "UsdCoin", "MyUSDC", etc.

### Token Address
- Case-insensitive prefix matching
- Searches for addresses that start with the query
- Example: `0x573225b9d4` matches `0x573225b9d473950012c7ad348c334f22bd921265`

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
      "firstSeenAt": "1640995200000",
      "lastSeenAt": "1709251200000",
      "creatorAddress": "0x...",
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

### Advanced Example
```
GET /search/token?chain_ids=1,8453&page=1&limit=50&sort=firstSeenAt&order=asc
```
Search for "token", on Ethereum and Base, first page of 50 results, sorted by oldest tokens first.

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

## Future Enhancements
- Relevance scoring for text search
- Multiple sort fields support
- Search suggestions/autocomplete
- Advanced filtering options