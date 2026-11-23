import { demoLogin, login, register } from "@/app/actions";
import Link from "next/link";
import { getLocale } from "@/lib/i18n";
import { demoModeEnabled } from "@/lib/demo-config";
import { ensureDemoData } from "@/lib/demo-data";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const locale = await getLocale();
  const demo = demoModeEnabled();
  if (demo) await ensureDemoData();
  const next =
    (await searchParams).next === "checkout" ? "/checkout" : "/account";
  const en = locale === "en";
  return (
    <>
      <main className="auth-page event-container">
        <Link
          className="back-link"
          href={next === "/checkout" ? "/checkout" : "/"}
        >
          ← {en ? "Back" : "Kembali"}
        </Link>
        <div className="auth-heading">
          <span>SYMPHONY OF FAITH</span>
          <h1>{en ? "Welcome back" : "Selamat datang"}</h1>
          <p>
            {en
              ? "Sign in or create an account to manage your tickets."
              : "Masuk atau buat akun untuk mengelola tiket."}
          </p>
        </div>
        <div className="auth-grid">
          {demo && (
            <section className="panel demo-login-panel">
              <span className="eyebrow">DEMO PREVIEW</span>
              <h2>{en ? "Instant demo access" : "Akses demo instan"}</h2>
              <p>
                {en
                  ? "Use an isolated account. No real payment or message will be sent."
                  : "Gunakan akun terisolasi. Tidak ada pembayaran atau pesan nyata yang dikirim."}
              </p>
              {(["customer", "admin", "finance"] as const).map((role) => (
                <form action={demoLogin} key={role}>
                  <input type="hidden" name="role" value={role} />
                  <input type="hidden" name="next" value={next} />
                  <button type="submit" className={role === "customer" ? "" : "secondary-button"}>
                    {en ? "Sign in as" : "Masuk sebagai"} Demo {role === "customer" ? "Customer" : role === "admin" ? "Administrator" : "Finance"}
                  </button>
                </form>
              ))}
            </section>
          )}
          <form action={login} className="panel">
            <h2>{en ? "Sign in" : "Masuk"}</h2>
            <input type="hidden" name="next" value={next} />
            <label>
              {en ? "Email address" : "Alamat email"}
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              {en ? "Password" : "Kata sandi"}
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <button type="submit">{en ? "Sign in" : "Masuk"}</button>
          </form>
          <form action={register} className="panel">
            <h2>{en ? "Create an account" : "Buat akun"}</h2>
            <input type="hidden" name="next" value={next} />
            <label>
              {en ? "Full name" : "Nama lengkap"}
              <input name="name" autoComplete="name" required minLength={2} />
            </label>
            <label>
              {en ? "Email address" : "Alamat email"}
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              {en
                ? "Password (at least 12 characters)"
                : "Kata sandi (minimal 12 karakter)"}
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
              />
            </label>
            <label>
              {en
                ? "WhatsApp number, international format (optional)"
                : "Nomor WhatsApp, format internasional (opsional)"}
              <input
                name="phone"
                type="tel"
                placeholder="+628123456789"
                pattern="\+[1-9][0-9]{7,14}"
              />
            </label>
            <label className="check">
              <input type="checkbox" name="whatsappConsent" />{" "}
              {en
                ? "I agree to receive transaction updates on WhatsApp."
                : "Saya setuju menerima informasi transaksi melalui WhatsApp."}
            </label>
            <button type="submit">{en ? "Create account" : "Buat akun"}</button>
          </form>
        </div>
      </main>
    </>
  );
}
