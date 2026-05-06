#!/usr/bin/env node
import pg from "pg";

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const tables = await client.query(`
  select table_name
  from information_schema.tables
  where table_schema = 'public'
  order by table_name
`);
console.log("Tables in public:");
for (const r of tables.rows) console.log(" -", r.table_name);

const policies = await client.query(`
  select tablename, count(*) as policy_count
  from pg_policies
  where schemaname = 'public'
  group by tablename
  order by tablename
`);
console.log("\nRLS policies per table:");
for (const r of policies.rows) console.log(` - ${r.tablename}: ${r.policy_count}`);

const fns = await client.query(`
  select proname
  from pg_proc p
  join pg_namespace n on p.pronamespace = n.oid
  where n.nspname = 'public' and proname in ('has_object_access','set_updated_at','handle_new_user')
  order by proname
`);
console.log("\nHelper functions:");
for (const r of fns.rows) console.log(" -", r.proname);

await client.end();
