import postgres from "postgres";
import { resolveDatabaseUrl } from "@/lib/database-target";

let connection: ReturnType<typeof postgres> | undefined;
let connectionUrl: string | undefined;

export function db() {
  const url = resolveDatabaseUrl(process.env);
  if (connection && connectionUrl !== url)
    throw new Error("Database target berubah selama proses berjalan");
  connectionUrl = url;
  connection ??= postgres(url, { max: 10, prepare: false });
  return connection;
}
