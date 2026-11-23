import { NextResponse } from "next/server";
import { expireReservations } from "@/lib/orders";
import { processNotifications } from "@/lib/notifications";

export async function GET(request: Request) {
  if (
    !process.env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await expireReservations();
  const notifications = await processNotifications();
  return NextResponse.json({ ok: true, notifications });
}
