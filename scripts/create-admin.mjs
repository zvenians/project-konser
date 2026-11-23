import postgres from "postgres";
import { hash } from "bcryptjs";

const { DATABASE_URL, ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD } = process.env;
if (!DATABASE_URL || !ADMIN_EMAIL || !ADMIN_NAME || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 16) {
  throw new Error("DATABASE_URL, ADMIN_EMAIL, ADMIN_NAME dan ADMIN_PASSWORD (min. 16 karakter) diperlukan");
}
const sql = postgres(DATABASE_URL, { max: 1 });
try {
  const existing = await sql`SELECT id FROM users WHERE email=${ADMIN_EMAIL.toLowerCase()}`;
  if (existing.length) throw new Error("Email sudah digunakan. Perubahan role harus ditinjau secara manual.");
  await sql`INSERT INTO users(email,name,password_hash,role) VALUES (${ADMIN_EMAIL.toLowerCase()},${ADMIN_NAME},${await hash(ADMIN_PASSWORD,12)},'ADMIN')`;
  console.log("Akun admin dibuat.");
} finally { await sql.end(); }
