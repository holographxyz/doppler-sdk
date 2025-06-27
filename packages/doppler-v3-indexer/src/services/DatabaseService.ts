import { Pool, PoolClient } from 'pg';

class DatabaseService {
  private pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    const schema = process.env.DATABASE_SCHEMA || 'public';

    console.log(`schema = ${schema}`)

    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    this.pool = new Pool({
      connectionString,
      max: 10, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      options: `-c search_path=${schema}`, // Set the schema search path
    });

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle database client', err);
    });
  }

  /**
   * Get a client from the pool for transaction management
   */
  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  /**
   * Execute a query with automatic client management
   */
  async query(text: string, params?: unknown[]) {
    const client = await this.getClient();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  /**
   * Promote a token by setting isPromoted to true
   */
  async promoteToken(tokenAddress: string): Promise<void> {
    const normalizedAddress = tokenAddress.toLowerCase();

    const query = `
      UPDATE token 
      SET is_promoted = true 
      WHERE address = $1
    `;

    const result = await this.query(query, [normalizedAddress]);

    if (result.rowCount === 0) {
      throw new Error(`Token with address ${normalizedAddress} not found`);
    }
  }

  /**
   * Unpromote a token by setting isPromoted to false
   */
  async unpromoteToken(tokenAddress: string): Promise<void> {
    const normalizedAddress = tokenAddress.toLowerCase();

    const query = `
      UPDATE token 
      SET is_promoted = false 
      WHERE address = $1
    `;

    const result = await this.query(query, [normalizedAddress]);

    if (result.rowCount === 0) {
      throw new Error(`Token with address ${normalizedAddress} not found`);
    }
  }

  /**
   * Get all promoted tokens with pagination
   */
  async getPromotedTokens(page: number, limit: number): Promise<{
    tokens: any[];
    total: number;
  }> {
    const offset = (page - 1) * limit;

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM token 
      WHERE is_promoted = true
    `;

    const countResult = await this.query(countQuery);
    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    // Get paginated results
    const tokensQuery = `
      SELECT 
        address,
        chain_id,
        name,
        symbol,
        decimals,
        token_uri_data,
        total_supply,
        image,
        is_derc20,
        derc20_data,
        first_seen_at,
        last_seen_at,
        pool,
        volume_usd,
        holder_count,
        creator_address,
        is_promoted
      FROM token 
      WHERE is_promoted = true 
      ORDER BY first_seen_at DESC
      LIMIT $1 OFFSET $2
    `;

    const tokensResult = await this.query(tokensQuery, [limit, offset]);

    // Convert snake_case to camelCase to match Ponder's format
    const tokens = tokensResult.rows.map(row => ({
      address: row.address,
      chainId: row.chain_id,
      name: row.name,
      symbol: row.symbol,
      decimals: row.decimals,
      tokenUriData: row.token_uri_data,
      totalSupply: row.total_supply,
      image: row.image,
      isDerc20: row.is_derc20,
      derc20Data: row.derc20_data,
      firstSeenAt: row.first_seen_at,
      lastSeenAt: row.last_seen_at,
      pool: row.pool,
      volumeUsd: row.volume_usd,
      holderCount: row.holder_count,
      creatorAddress: row.creator_address,
      isPromoted: row.is_promoted,
    }));

    return {
      tokens,
      total,
    };
  }

  /**
   * Check if a token exists
   */
  async tokenExists(tokenAddress: string): Promise<boolean> {
    const normalizedAddress = tokenAddress.toLowerCase();

    const query = `
      SELECT 1 FROM token WHERE address = $1 LIMIT 1
    `;

    const result = await this.query(query, [normalizedAddress]);
    return result.rows.length > 0;
  }

  /**
   * Close the database pool
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}

// Create a singleton instance
export const databaseService = new DatabaseService();

// Export the class for testing purposes
export { DatabaseService };
