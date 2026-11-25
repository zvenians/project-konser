import "server-only";
import { getDownloadUrl } from "@vercel/blob";

export type ProviderMode = "disabled" | "simulation" | "production";
export type StreamingProviderName = "simulation" | "youtube" | "cloudflare";
export type PlaybackAccess =
  | { provider: "simulation"; sampleUrl?: string }
  | { provider: "youtube"; videoId: string }
  | { provider: "cloudflare"; iframeUrl: string; expiresAt: string };
export interface PaymentProvider { mode: ProviderMode; createPayment(input: { orderId: string; amount: number; customer: { name: string; email: string; phone?: string } }): Promise<{ reference: string; redirectUrl?: string }> }
export interface NotificationProvider { mode: ProviderMode; sendTemplate(input: { recipient: string; template: string; variables: string[] }): Promise<{ reference: string }>; sendDocument(input: { recipient: string; url: string; filename: string; caption?: string }): Promise<{ reference: string }> }
export interface EmailProvider { mode: ProviderMode; send(input: { recipient: string; subject: string; html: string; attachments?: Array<{ name: string; content: string }> }): Promise<{ reference: string }> }
export interface StorageProvider { mode: ProviderMode; createPrivateDownload(input: { key: string; expiresInSeconds: number }): Promise<{ url: string }> }
export interface StreamingProvider { name: StreamingProviderName; connectionStatus(): Promise<"configured" | "not_configured" | "simulation">; createViewerAccess(input: { videoId?: string; expiresInSeconds?: number }): Promise<PlaybackAccess> }

type ProviderEnvironment = Record<string, string | undefined>;
export function realTransactionsEnabled(env: ProviderEnvironment = process.env) {
  return env.REAL_TRANSACTIONS_ENABLED === "true" && env.VERCEL_ENV === "production" && env.DEMO_MODE !== "true";
}
const disabled = (name: string): never => { throw new Error(`${name} belum diaktifkan oleh penyelenggara.`); };
function required(env: ProviderEnvironment, key: string) { const value = env[key]?.trim(); if (!value) throw new Error(`${key} belum dikonfigurasi.`); return value; }

export function createStreamingProvider(name: StreamingProviderName, env: ProviderEnvironment = process.env): StreamingProvider {
  if (name === "simulation") return {
    name,
    async connectionStatus() { return "simulation"; },
    async createViewerAccess() { return { provider: "simulation", sampleUrl: env.STREAM_SIMULATION_URL }; },
  };
  if (name === "youtube") return {
    name,
    async connectionStatus() { return env.YOUTUBE_LIVE_VIDEO_ID || env.YOUTUBE_LIVE_URL ? "configured" : "not_configured"; },
    async createViewerAccess(input) {
      const source = input.videoId || env.YOUTUBE_LIVE_VIDEO_ID || env.YOUTUBE_LIVE_URL;
      if (!source) throw new Error("Video YouTube Live belum dikonfigurasi.");
      const match = source.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|live\/))([A-Za-z0-9_-]{11})/) || source.match(/^([A-Za-z0-9_-]{11})$/);
      if (!match) throw new Error("URL atau ID YouTube tidak valid.");
      return { provider: "youtube", videoId: match[1] };
    },
  };
  return {
    name,
    async connectionStatus() { return env.CLOUDFLARE_STREAM_ACCOUNT_ID && env.CLOUDFLARE_STREAM_API_TOKEN && env.CLOUDFLARE_STREAM_CUSTOMER_CODE ? "configured" : "not_configured"; },
    async createViewerAccess(input) {
      const account = required(env, "CLOUDFLARE_STREAM_ACCOUNT_ID");
      const token = required(env, "CLOUDFLARE_STREAM_API_TOKEN");
      const customerCode = required(env, "CLOUDFLARE_STREAM_CUSTOMER_CODE");
      const videoId = input.videoId || required(env, "CLOUDFLARE_STREAM_VIDEO_UID");
      const expiresAt = new Date(Date.now() + Math.min(900, Math.max(60, input.expiresInSeconds ?? 300)) * 1000);
      const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/stream/${videoId}/token`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ exp: Math.floor(expiresAt.getTime() / 1000), downloadable: false }), signal: AbortSignal.timeout(10_000),
      });
      const payload = await response.json() as { success?: boolean; result?: { token?: string } };
      if (!response.ok || !payload.success || !payload.result?.token) throw new Error(`Cloudflare Stream token gagal (${response.status}).`);
      return { provider: "cloudflare", iframeUrl: `https://customer-${customerCode}.cloudflarestream.com/${payload.result.token}/iframe`, expiresAt: expiresAt.toISOString() };
    },
  };
}

export function createProviderRegistry(env: ProviderEnvironment = process.env) {
  const enabled = realTransactionsEnabled(env);
  return {
    payment: { mode: enabled ? "production" : "disabled", async createPayment(input) {
      if (!enabled) return disabled("Midtrans");
      const key = required(env, "MIDTRANS_SERVER_KEY");
      const base = env.MIDTRANS_IS_PRODUCTION === "true" ? "https://app.midtrans.com" : "https://app.sandbox.midtrans.com";
      const origin = env.NEXT_PUBLIC_APP_URL || "https://symphonyoffaith.vercel.app";
      const response = await fetch(`${base}/snap/v1/transactions`, { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`, "Content-Type": "application/json" }, body: JSON.stringify({ transaction_details: { order_id: input.orderId, gross_amount: input.amount }, customer_details: input.customer, callbacks: { finish: `${origin}/orders/${input.orderId}` } }), signal: AbortSignal.timeout(10_000) });
      const payload = await response.json() as { token?: string; redirect_url?: string };
      if (!response.ok || !payload.token) throw new Error(`Midtrans menolak transaksi (${response.status}).`);
      return { reference: payload.token, redirectUrl: payload.redirect_url };
    }} satisfies PaymentProvider,
    notification: { mode: enabled ? "production" : "disabled", async sendTemplate(input) {
      if (!enabled) return disabled("WhatsApp Business API");
      const token = required(env, "WHATSAPP_ACCESS_TOKEN"), phone = required(env, "WHATSAPP_PHONE_NUMBER_ID"), version = env.WHATSAPP_GRAPH_VERSION ?? "v21.0";
      const response = await fetch(`https://graph.facebook.com/${version}/${phone}/messages`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", to: input.recipient, type: "template", template: { name: input.template, language: { code: "id" }, components: input.variables.length ? [{ type: "body", parameters: input.variables.map((text) => ({ type: "text", text })) }] : [] } }), signal: AbortSignal.timeout(10_000) });
      const payload = await response.json() as { messages?: Array<{ id?: string }> }; const reference = payload.messages?.[0]?.id;
      if (!response.ok || !reference) throw new Error(`WhatsApp menolak pesan (${response.status}).`); return { reference };
    }, async sendDocument(input) {
      if (!enabled) return disabled("WhatsApp Business API");
      const token = required(env, "WHATSAPP_ACCESS_TOKEN"), phone = required(env, "WHATSAPP_PHONE_NUMBER_ID"), version = env.WHATSAPP_GRAPH_VERSION ?? "v21.0";
      const response = await fetch(`https://graph.facebook.com/${version}/${phone}/messages`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", to: input.recipient, type: "document", document: { link: input.url, filename: input.filename, caption: input.caption } }), signal: AbortSignal.timeout(10_000) });
      const payload = await response.json() as { messages?: Array<{ id?: string }> }; const reference = payload.messages?.[0]?.id;
      if (!response.ok || !reference) throw new Error(`WhatsApp menolak dokumen (${response.status}).`); return { reference };
    }} satisfies NotificationProvider,
    email: { mode: enabled ? "production" : "disabled", async send(input) {
      if (!enabled) return disabled("Brevo");
      const apiKey = required(env, "BREVO_API_KEY");
      const senderEmail = required(env, "BREVO_SENDER_EMAIL");
      const senderName = env.BREVO_SENDER_NAME || "Symphony of Faith";
      const response = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", headers: { "api-key": apiKey, "Content-Type": "application/json", accept: "application/json" }, body: JSON.stringify({ sender: { email: senderEmail, name: senderName }, to: [{ email: input.recipient }], subject: input.subject, htmlContent: input.html, attachment: input.attachments?.map(item => ({ name: item.name, content: item.content })) }), signal: AbortSignal.timeout(15_000) });
      const payload = await response.json().catch(() => ({})) as { messageId?: string };
      if (!response.ok || !payload.messageId) throw new Error(`Brevo menolak email (${response.status}).`);
      return { reference: payload.messageId };
    }} satisfies EmailProvider,
    storage: { mode: enabled ? "production" : "disabled", async createPrivateDownload(input) { if (!enabled) return disabled("Penyimpanan privat"); if (input.expiresInSeconds < 60 || input.expiresInSeconds > 86_400) throw new Error("Masa berlaku tautan unduhan tidak valid."); return { url: await getDownloadUrl(input.key) }; }} satisfies StorageProvider,
  };
}

export const productionProviders = createProviderRegistry();
