import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export const tokenDigest = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export function normalizePhone(value: string) {
  const digits = value.replace(/[^0-9+]/g, "");
  const normalized = digits.startsWith("+")
    ? `+${digits.slice(1).replace(/\D/g, "")}`
    : digits.startsWith("0")
      ? `+62${digits.slice(1)}`
      : digits.startsWith("62")
        ? `+${digits}`
        : `+${digits}`;
  if (!/^\+[1-9][0-9]{7,14}$/.test(normalized))
    throw new Error("Nomor WhatsApp tidak valid.");
  return normalized;
}

export async function setGuestOrderToken(token: string) {
  (await cookies()).set("sof_guest_order", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function guestOrderTokenHash() {
  const token = (await cookies()).get("sof_guest_order")?.value;
  return token ? tokenDigest(token) : null;
}

export const newGuestToken = () => randomBytes(32).toString("base64url");

export async function currentClaim(scope: "TICKET" | "LIVESTREAM") {
  const token = (await cookies()).get("sof_claim")?.value;
  if (!token) return null;
  const [session] = await db()`SELECT id,destination_hash FROM claim_sessions WHERE token_hash=${tokenDigest(token)} AND scope=${scope} AND revoked_at IS NULL AND expires_at>now()`;
  return session ?? null;
}
