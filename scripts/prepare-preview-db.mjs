import fs from "node:fs/promises";
import postgres from "postgres";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
const database = process.argv[2] ?? "sof_preview";
if (!["sof_preview", "sof_test"].includes(database))
  throw new Error("Unsupported database name");
const source = new URL(process.env.DATABASE_URL);
const target = new URL(process.env.DATABASE_URL);
target.pathname = `/${database}`;
const root = postgres(source.toString(), { max: 1, prepare: false });
try {
  const found = await root`SELECT 1 FROM pg_database WHERE datname=${database}`;
  if (!found.length) await root.unsafe(`CREATE DATABASE ${database}`);
} finally {
  await root.end();
}
const client = postgres(target.toString(), { max: 1, prepare: false });
try {
  console.log((await client`SELECT current_database() AS database`)[0]);
} finally {
  await client.end();
}
await fs.writeFile(
  database === "sof_preview" ? ".env.preview-db.local" : ".env.test-db.local",
  `DATABASE_URL=${target.toString()}\n`,
  { mode: 0o600 },
);
