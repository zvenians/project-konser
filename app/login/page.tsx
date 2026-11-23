import { login, register } from "@/app/actions";

export default function LoginPage() {
  return <main className="wrap section"><h1>Masuk atau buat akun</h1><div className="split">
    <form action={login} className="panel"><h2>Masuk</h2><label>Email<input name="email" type="email" required /></label><label>Kata sandi<input name="password" type="password" required /></label><button type="submit">Masuk</button></form>
    <form action={register} className="panel"><h2>Daftar</h2><label>Nama<input name="name" required minLength={2} /></label><label>Email<input name="email" type="email" required /></label><label>Kata sandi, minimal 12 karakter<input name="password" type="password" required minLength={12} /></label><button type="submit">Buat akun</button></form>
  </div></main>;
}
