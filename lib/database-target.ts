function demoDatabaseEnabled(env: NodeJS.ProcessEnv) {
  if (env.DEMO_MODE !== "true") return false;
  if (env.VERCEL_ENV === "production") return env.DEMO_PRODUCTION === "true";
  if (env.VERCEL_ENV === "preview") return true;
  if (env.NODE_ENV === "development" || env.NODE_ENV === "test") return true;
  return env.DEMO_LOCAL === "true";
}

export function resolveDatabaseUrl(env: NodeJS.ProcessEnv) {
  if (demoDatabaseEnabled(env)) {
    if (!env.DEMO_DATABASE_URL)
      throw new Error("DEMO_DATABASE_URL belum dikonfigurasi untuk lingkungan demo");
    if (env.DEMO_DATABASE_URL === env.DATABASE_URL)
      throw new Error("Database demo dan produksi harus berbeda");
    return env.DEMO_DATABASE_URL;
  }
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL belum dikonfigurasi");
  return env.DATABASE_URL;
}
