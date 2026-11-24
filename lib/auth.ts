import "server-only";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { demoModeEnabled } from "@/lib/demo-config";
import { hasCapability } from "@/lib/permissions";

const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export async function currentUser() {
  const token = (await cookies()).get("sof_session")?.value;
  if (!token || !process.env.DATABASE_URL) return null;
  const demo = demoModeEnabled();
  const [user] =
    await db()`SELECT u.id,u.name,u.email,u.role,u.is_demo FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=${digest(token)} AND s.expires_at>now() AND u.is_demo=${demo}`;
  return user ?? null;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new Error("Silakan masuk ke akun Anda.");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!hasCapability(user.role, "settings")) throw new Error("Akses ditolak.");
  return user;
}

export async function requireFinance() {
  const user = await requireUser();
  if (!hasCapability(user.role, "finance"))
    throw new Error("Akses ditolak.");
  return user;
}

export async function requireCheckIn() {
  const user = await requireUser();
  if (!hasCapability(user.role, "checkin"))
    throw new Error("Akses ditolak.");
  return user;
}

export async function requireStreamOperator() {
  const user = await requireUser();
  if (!hasCapability(user.role, "stream"))
    throw new Error("Akses ditolak.");
  return user;
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  await db()`INSERT INTO sessions(token_hash,user_id,expires_at) VALUES (${digest(token)},${userId},now()+interval '7 days')`;
  (await cookies()).set("sof_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 604800,
  });
}

export async function endSession() {
  const token = (await cookies()).get("sof_session")?.value;
  if (token && process.env.DATABASE_URL)
    await db()`DELETE FROM sessions WHERE token_hash=${digest(token)}`;
  (await cookies()).delete("sof_session");
}
