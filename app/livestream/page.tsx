import { currentUser } from "@/lib/auth";
import { currentClaim } from "@/lib/guest";
import { requestClaim, verifyClaim } from "@/app/actions";
import { getLocale } from "@/lib/i18n";
import { StreamViewingRoom } from "@/components/stream-viewing-room";

export const dynamic = "force-dynamic";
export default async function LivestreamPage({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const query = await searchParams;
  if (!(await currentUser()) && !(await currentClaim("LIVESTREAM"))) {
    if (query.otp === "1") return <main className="claim-page event-container"><p className="eyebrow">LIVESTREAM ACCESS</p><h1>Verifikasi email</h1><form action={verifyClaim} className="claim-form"><input type="hidden" name="channel" value="EMAIL"/><input type="hidden" name="scope" value="LIVESTREAM"/><label>Email pembelian<input name="destination" type="email" required/></label><label>Kode 6 digit<input name="code" inputMode="numeric" pattern="[0-9]{6}" required/></label>{query.demoCode && <p className="claim-notice">Kode simulasi: <strong>{query.demoCode}</strong></p>}<button>Buka viewing room</button></form></main>;
    return <main className="claim-page event-container"><p className="eyebrow">LIVESTREAM ACCESS</p><h1>Masuk ke viewing room</h1><p>Gunakan email yang tercatat pada pembelian livestream terkonfirmasi.</p><form action={requestClaim} className="claim-form"><input type="hidden" name="channel" value="EMAIL"/><input type="hidden" name="scope" value="LIVESTREAM"/><label>Email pembelian<input name="destination" type="email" required/></label><button>Kirim OTP email</button></form></main>;
  }
  return <StreamViewingRoom locale={await getLocale()} />;
}
