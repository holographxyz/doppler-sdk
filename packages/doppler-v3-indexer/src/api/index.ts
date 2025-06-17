import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  and,
  client,
  desc,
  graphql,
  ilike,
  inArray,
  like,
  or,
  replaceBigInts,
} from "ponder";
import { db } from "ponder:api";
import schema, { token } from "ponder:schema";

import { createTokenMetadata } from "./handlers/metadata";

const app = new Hono();

// Add CORS middleware
app.use("*", cors({
  origin: (origin) => {
    console.log(`origin = ${origin}`)
    if (!origin) {
      console.log(`no origin provided`);
      return true
    }
    console.log(`origin check: ${origin.startsWith('https://holograph-launchpad')} + ${origin.endsWith('holograph.vercel.app')}`)
    return true;
  },
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}));

app.use("/graphql", graphql({ db, schema }));
app.use("/", graphql({ db, schema }));
app.use("/sql/*", client({ db, schema }));

// Token metadata creation endpoint
app.post("/api/create-token-metadata", createTokenMetadata);

app.get("/search/:query", async (c) => {
  try {
    const query = c.req.param("query");

    const chainIds = c.req
      .query("chain_ids")
      ?.split(",")
      .map((id) => BigInt(id));

    const results = await db
      .select()
      .from(token)
      .where(
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
            like(token.address, query)
          )
        )
      )
      .orderBy(desc(token.holderCount))
      .limit(15);

    return c.json(replaceBigInts(results, (v) => String(v)));
  } catch (error) {
    console.error("Error in /search/:query");
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

export default app;
