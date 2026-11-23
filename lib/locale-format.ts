export type Locale = "id" | "en";

export const formatRupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

export function formatEventDate(locale: Locale) {
  return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date("2027-02-07T19:00:00+07:00"));
}
