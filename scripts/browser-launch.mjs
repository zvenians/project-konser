import fs from "node:fs";

const windowsEdge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

export function browserLaunchOptions(extra = {}) {
  const configured = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
  const executablePath = configured || (process.platform === "win32" && fs.existsSync(windowsEdge) ? windowsEdge : undefined);
  return { headless: true, ...(executablePath ? { executablePath } : {}), ...extra };
}

export function browserContextOptions(extra = {}) {
  const token = process.env.VERCEL_OIDC_TOKEN;
  const extraHTTPHeaders = token ? { "x-vercel-trusted-oidc-idp-token": token } : undefined;
  return { ...(extraHTTPHeaders ? { extraHTTPHeaders } : {}), ...extra };
}
