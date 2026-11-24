import "server-only";

export type ProviderMode = "disabled" | "simulation" | "production";

export interface PaymentProvider {
  mode: ProviderMode;
  createPayment(input: { orderId: string; amount: number }): Promise<{ reference: string }>;
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

const disabled = (name: string): never => {
  throw new Error(`${name} belum diaktifkan oleh penyelenggara.`);
};

export const productionProviders = {
  payment: {
    mode: "disabled",
    createPayment: async () => disabled("Midtrans"),
  } satisfies PaymentProvider,
  notification: {
    mode: "disabled",
    sendTemplate: async () => disabled("WhatsApp Business API"),
  } satisfies NotificationProvider,
  storage: {
    mode: "disabled",
    createPrivateDownload: async () => disabled("Penyimpanan privat"),
  } satisfies StorageProvider,
  streaming: {
    mode: "disabled",
    createViewerAccess: async () => disabled("Penyedia livestream privat"),
  } satisfies StreamingProvider,
};
