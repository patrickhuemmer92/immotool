#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL env var is required");
  process.exit(1);
}

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/run-migration.mjs <path/to/migration.sql>");
  process.exit(1);
}

const sql = fs.readFileSync(path.resolve(process.cwd(), file), "utf8");

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log(`→ executing ${file} ...`);
  await client.query(sql);
  console.log("✓ migration applied");
} catch (err) {
  console.error("✗ migration failed:");
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
