import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCheckIn } from "@/lib/auth";
import { db } from "@/lib/db";
import { demoModeEnabled } from "@/lib/demo-config";

export async function POST(request: Request) {
  try {
    const staff = await requireCheckIn();
    const demo = demoModeEnabled();
    const input = z
      .object({ barcode: z.string().trim().min(3).max(512) })
      .parse(await request.json());
    const result = await db().begin(async (tx) => {
      const [ticket] = await tx`SELECT t.id,t.status,o.status AS order_status
        FROM ticket_inventory t
        LEFT JOIN ticket_allocations a ON a.ticket_id=t.id
        LEFT JOIN order_items i ON i.id=a.item_id
        LEFT JOIN orders o ON o.id=i.order_id
        WHERE t.barcode=${input.barcode} AND t.is_demo=${demo}
        FOR UPDATE OF t`;
      if (!ticket)
        return { status: 404, code: "INVALID", message: "Kode tiket tidak dikenal." };
      const [existing] =
        await tx`SELECT checked_in_at FROM ticket_checkins WHERE ticket_id=${ticket.id}`;
      if (existing)
        return { status: 409, code: "ALREADY_USED", message: "Tiket sudah digunakan untuk masuk." };
      if (ticket.status !== "SOLD" || ticket.order_status !== "CONFIRMED")
        return { status: 403, code: "DENIED", message: "Tiket tidak memiliki pesanan aktif." };
      await tx`INSERT INTO ticket_checkins(ticket_id,checked_in_by) VALUES (${ticket.id},${staff.id})`;
      await tx`INSERT INTO audit_logs(actor_id,action,resource_id,details)
        VALUES (${staff.id},${demo ? "DEMO_CHECK_IN" : "CHECK_IN"},${ticket.id},${JSON.stringify({ simulated: demo })}::jsonb)`;
      return { status: 200, code: "SUCCESS", message: "Check-in berhasil. Tiket diterima." };
    });
    return NextResponse.json(result, { status: result.status });
  } catch {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "Akses ditolak." },
      { status: 403 },
    );
  }
}
