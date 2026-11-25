import { createHash, randomBytes } from "node:crypto";
import type { StreamingProviderName } from "@/lib/providers";

export const broadcastStates = ["NOT_STARTED", "WAITING", "LIVE", "INTERRUPTED", "ENDED"] as const;
export type BroadcastState = (typeof broadcastStates)[number];
export type StreamConfig = {
  provider: StreamingProviderName;
  state: BroadcastState;
  viewerAccess: boolean;
  videoId?: string;
  scheduledStart: string;
  scheduledEnd: string;
  sessionLimit: number;
  maintenanceMessage?: string;
  sampleUrl?: string;
  targetsPendingConfirmation?: boolean;
};
export const defaultStreamConfig: StreamConfig = {
  provider: "simulation", state: "NOT_STARTED", viewerAccess: false,
  scheduledStart: "2027-02-07T19:00:00+07:00", scheduledEnd: "2027-02-07T22:00:00+07:00",
  sessionLimit: 1, maintenanceMessage: "", targetsPendingConfirmation: true,
};
export function normalizeStreamConfig(value: unknown): StreamConfig {
  if (!value || typeof value !== "object") return defaultStreamConfig;
  const input = value as Partial<StreamConfig>;
  return {
    ...defaultStreamConfig, ...input,
    provider: ["simulation", "youtube", "cloudflare"].includes(String(input.provider)) ? input.provider! : "simulation",
    state: broadcastStates.includes(input.state as BroadcastState) ? input.state! : "NOT_STARTED",
    sessionLimit: Math.min(5, Math.max(1, Number(input.sessionLimit) || 1)),
    viewerAccess: input.viewerAccess === true,
  };
}
export const streamToken = () => randomBytes(32).toString("base64url");
export const streamTokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
