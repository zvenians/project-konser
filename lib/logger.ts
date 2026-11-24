import "server-only";

type LogLevel = "info" | "warning" | "error";

export function serverLog(
  level: LogLevel,
  event: string,
  details: Record<string, unknown> = {},
) {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    service: "symphony-of-faith",
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    ...details,
  });
  if (level === "error") console.error(entry);
  else if (level === "warning") console.warn(entry);
  else console.info(entry);
}
