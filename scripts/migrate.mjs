import fs from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL diperlukan");
const sql=postgres(process.env.DATABASE_URL,{max:1});
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
