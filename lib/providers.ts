import "server-only";

import { createHmac } from "node:crypto";
import { getDownloadUrl } from "@vercel/blob";

export type ProviderMode = "disabled" | "simulation" | "production";
export interface PaymentProvider {
  mode: ProviderMode;
  createPayment(input: { orderId: string; amount: number; customer: { name: string; email: string } }): Promise<{ reference: string; redirectUrl?: string }>;
}
export interface NotificationProvider {
  mode: ProviderMode;
  sendTemplate(input: { recipient: string; template: string; variables: string[] }): Promise<{ reference: string }>;
}
export interface StorageProvider {
  mode: ProviderMode;
  createPrivateDownload(input: { key: string; expiresInSeconds: number }): Promise<{ url: string }>;
}
export interface StreamingProvider {
  mode: ProviderMode;
  createViewerAccess(input: { orderId: string; userId: string }): Promise<{ url: string }>;
}

type ProviderEnvironment = Record<string, string | undefined>;
export function realTransactionsEnabled(env: ProviderEnvironment = process.env) {
  return env.REAL_TRANSACTIONS_ENABLED === "true" && env.VERCEL_ENV === "production" && env.DEMO_MODE !== "true";
}
const disabled = (name: string): never => { throw new Error(`${name} belum diaktifkan oleh penyelenggara.`); };
function required(env: ProviderEnvironment, key: string) {
  const value = env[key]?.trim();
  if (!value) throw new Error(`${key} belum dikonfigurasi.`);
  return value;
}

export function createProviderRegistry(env: ProviderEnvironment = process.env) {
  if (!realTransactionsEnabled(env)) return {
    payment: { mode: "disabled", createPayment: async () => disabled("Midtrans") } satisfies PaymentProvider,
    notification: { mode: "disabled", sendTemplate: async () => disabled("WhatsApp Business API") } satisfies NotificationProvider,
    storage: { mode: "disabled", createPrivateDownload: async () => disabled("Penyimpanan privat") } satisfies StorageProvider,
    streaming: { mode: "disabled", createViewerAccess: async () => disabled("Penyedia livestream privat") } satisfies StreamingProvider,
  };

  const midtransKey = required(env, "MIDTRANS_SERVER_KEY");
  const midtransBase = env.MIDTRANS_IS_PRODUCTION === "true" ? "https://app.midtrans.com" : "https://app.sandbox.midtrans.com";
  const whatsappToken = required(env, "WHATSAPP_ACCESS_TOKEN");
  const whatsappPhoneId = required(env, "WHATSAPP_PHONE_NUMBER_ID");
  const whatsappVersion = env.WHATSAPP_GRAPH_VERSION ?? "v21.0";
  const streamBaseUrl = required(env, "PRIVATE_STREAM_BASE_URL");
  const streamSigningSecret = required(env, "PRIVATE_STREAM_SIGNING_SECRET");

  return {
    payment: {
      mode: "production",
      async createPayment(input) {
        const response = await fetch(`${midtransBase}/snap/v1/transactions`, {
          method: "POST",
          headers: { Authorization: `Basic ${Buffer.from(`${midtransKey}:`).toString("base64")}`, "Content-Type": "application/json" },
          body: JSON.stringify({ transaction_details: { order_id: input.orderId, gross_amount: input.amount }, customer_details: input.customer }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) throw new Error(`Midtrans menolak transaksi (${response.status}).`);
        const payload = (await response.json()) as { token?: string; redirect_url?: string };
        if (!payload.token) throw new Error("Midtrans tidak mengembalikan token transaksi.");
        return { reference: payload.token, redirectUrl: payload.redirect_url };
      },
    } satisfies PaymentProvider,
    notification: {
      mode: "production",
      async sendTemplate(input) {
        const response = await fetch(`https://graph.facebook.com/${whatsappVersion}/${whatsappPhoneId}/messages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${whatsappToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ messaging_product: "whatsapp", to: input.recipient, type: "template", template: { name: input.template, language: { code: "id" }, components: input.variables.length ? [{ type: "body", parameters: input.variables.map((text) => ({ type: "text", text })) }] : [] } }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) throw new Error(`WhatsApp menolak pesan (${response.status}).`);
        const payload = (await response.json()) as { messages?: Array<{ id?: string }> };
        const reference = payload.messages?.[0]?.id;
        if (!reference) throw new Error("WhatsApp tidak mengembalikan ID pesan.");
        return { reference };
      },
    } satisfies NotificationProvider,
    storage: {
      mode: "production",
      async createPrivateDownload(input) {
        if (input.expiresInSeconds < 60 || input.expiresInSeconds > 86_400) throw new Error("Masa berlaku tautan unduhan tidak valid.");
        return { url: await getDownloadUrl(input.key) };
      },
    } satisfies StorageProvider,
    streaming: {
      mode: "production",
      async createViewerAccess(input) {
        const expires = Math.floor(Date.now() / 1000) + 900;
        const payload = `${input.orderId}.${input.userId}.${expires}`;
        const signature = createHmac("sha256", streamSigningSecret).update(payload).digest("base64url");
        const url = new URL(streamBaseUrl);
        url.searchParams.set("order", input.orderId);
        url.searchParams.set("viewer", input.userId);
        url.searchParams.set("expires", String(expires));
        url.searchParams.set("signature", signature);
        return { url: url.toString() };
      },
    } satisfies StreamingProvider,
  };
}

export const productionProviders = createProviderRegistry();
