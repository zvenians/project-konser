import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String(error.digest)
      : undefined;
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      event: "request_error",
      service: "symphony-of-faith",
      message: error instanceof Error ? error.message : String(error),
      digest,
      method: request.method,
      path: request.path,
      route: context.routePath,
      routeType: context.routeType,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    }),
  );
};
