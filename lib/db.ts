import postgres from "postgres";

let connection: ReturnType<typeof postgres> | undefined;

export function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL belum dikonfigurasi");
  connection ??= postgres(url, { max: 10, prepare: false });
  return connection;
}
