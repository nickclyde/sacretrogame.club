// Applies db/schema.sql. Usage: node --env-file=.env.local scripts/migrate.mjs
import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
// The HTTP driver runs one statement per query, so split on the semicolons that end a line
// and apply them all in one transaction.
const statements = schema
  .split(/;\s*$/m)
  .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
  .filter(Boolean);
await sql.transaction(statements.map((s) => sql.query(s)));
console.log(`Schema applied (${statements.length} statements).`);
