import fs from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const target=process.env.DB_TARGET ?? "development";
const url=target === "demo" ? (process.env.DEMO_DATABASE_URL || process.env.DEMO_DATABASE_DATABASE_URL) : process.env.DATABASE_URL;
if (!url) throw new Error(target === "demo" ? "DEMO_DATABASE_URL diperlukan" : "DATABASE_URL diperlukan");
if (target === "production" && process.env.CONFIRM_PRODUCTION_MIGRATION !== "APPLY")
  throw new Error("Set CONFIRM_PRODUCTION_MIGRATION=APPLY setelah backup diverifikasi");
const sql=postgres(url,{max:1});
try {
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
  const directory=path.join(process.cwd(),"db","migrations");
  for(const name of (await fs.readdir(directory)).filter(name=>name.endsWith(".sql")).sort()) {
    const [done]=await sql`SELECT 1 FROM schema_migrations WHERE name=${name}`;
    if(done) continue;
    await sql.unsafe(await fs.readFile(path.join(directory,name),"utf8"));
    await sql`INSERT INTO schema_migrations(name) VALUES (${name})`;
    console.log(`Applied ${name}`);
  }
} finally { await sql.end(); }
