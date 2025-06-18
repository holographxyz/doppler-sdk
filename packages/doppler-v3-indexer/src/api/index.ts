import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  client,
  desc,
  eq,
  graphql,
} from "ponder";
import { db } from "ponder:api";
import schema, { asset, token } from "ponder:schema";

import { createTokenMetadata } from "./handlers/metadata";
import { searchTokens } from "./handlers/search";

const app = new Hono();

// Add CORS middleware
app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}));

// Add CORS middleware
app.use("/graphql", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}));

app.use("/graphql", graphql({ db, schema }));
app.use("/", graphql({ db, schema }));
app.use("/sql/*", client({ db, schema }));

// Token metadata creation endpoint
app.post("/api/create-token-metadata", createTokenMetadata);

app.get("/search/:query", searchTokens);

export default app;
