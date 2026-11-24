import { NextResponse } from "next/server";
import { requireFinance } from "@/lib/auth";
import { db } from "@/lib/db";
import { demoModeEnabled } from "@/lib/demo-config";

const field = (value: unknown) => {
  const raw = String(value ?? "");
  const safe = /^[=+@\-\t\r\n]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
};
export async function GET(request: Request) {
  try {
    await requireFinance();
    const demo = demoModeEnabled();
    const kind = new URL(request.url).searchParams.get("kind");
    let headers: string[];
    let rows: Record<string, unknown>[];
    if (kind === "orders") {
      headers = [
        "id",
        "created_at",
        "buyer",
        "email",
        "status",
        "total",
        "payment_reference",
        "bank_reference",
      ];
      rows =
        await db()`SELECT o.id,o.created_at,u.name AS buyer,u.email,o.status,o.total,p.transfer_reference AS payment_reference,p.bank_reference FROM orders o JOIN users u ON u.id=o.user_id LEFT JOIN payment_claims p ON p.order_id=o.id WHERE o.is_demo=${demo} ORDER BY o.created_at DESC`;
    } else if (kind === "donations") {
      headers = [
        "id",
        "created_at",
        "donor_name",
        "anonymous",
        "status",
        "amount",
        "payment_reference",
        "bank_reference",
      ];
      rows =
        await db()`SELECT id,created_at,donor_name,anonymous,status,amount,payment_reference,bank_reference FROM donations WHERE is_demo=${demo} ORDER BY created_at DESC`;
    } else
      return NextResponse.json(
        { error: "Jenis laporan tidak dikenal." },
        { status: 400 },
      );
    const csv =
      "\uFEFF" +
      [
        headers.join(","),
        ...rows.map((row) => headers.map((key) => field(row[key])).join(",")),
      ].join("\r\n");
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="sof-${kind}.csv"`,
        "cache-control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }
}
