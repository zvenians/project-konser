import { cookies } from "next/headers";
import type { Locale } from "./locale-format";
export type { Locale } from "./locale-format";
export { formatRupiah, formatEventDate } from "./locale-format";

export async function getLocale(): Promise<Locale> {
  return (await cookies()).get("sof_locale")?.value === "en" ? "en" : "id";
}

export function translate<T extends Record<string, string>>(
  locale: Locale,
  messages: { id: T; en: Partial<T> },
): T {
  return new Proxy(messages.id, {
    get(target, key: string) {
      return (locale === "en" ? messages.en[key] : undefined) ?? target[key];
    },
  });
}
