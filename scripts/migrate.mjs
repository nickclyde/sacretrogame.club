// Applies db/schema.sql. Usage: node --env-file=.env.local scripts/migrate.mjs
import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
await sql.query(await readFile(new URL("../db/schema.sql", import.meta.url), "utf8"));
console.log("Schema applied.");
