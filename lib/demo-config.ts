export function demoModeEnabled(env = process.env) {
  if (env.DEMO_MODE !== "true") return false;
  if (env.VERCEL_ENV === "production") return env.DEMO_PRODUCTION === "true";
  if (env.VERCEL_ENV === "preview") return true;
  if (env.NODE_ENV === "development" || env.NODE_ENV === "test") return true;
  return env.DEMO_LOCAL === "true";
}

export function requireDemoMode() {
  if (!demoModeEnabled()) throw new Error("Demo mode is not enabled.");
}
