import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { demoModeEnabled } from "@/lib/demo-config";
import { demoTicketTitle } from "@/lib/demo-ticket";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import QRCode from "qrcode";

async function createDemoTicket(ticket: {
  id: string;
  name: string;
  barcode: string;
  order_id: string;
}) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(demoTicketTitle(ticket.name));
  const page = pdf.addPage([720, 360]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawRectangle({ x: 0, y: 0, width: 720, height: 360, color: rgb(0.055, 0.14, 0.12) });
  page.drawRectangle({ x: 18, y: 18, width: 684, height: 324, borderColor: rgb(0.93, 0.62, 0.08), borderWidth: 2 });
  page.drawText("SYMPHONY OF FAITH", { x: 42, y: 302, size: 25, font: bold, color: rgb(0.96, 0.74, 0.18) });
  page.drawText(ticket.name.toUpperCase(), { x: 42, y: 246, size: 34, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Sunday, 7 February 2027 · 19:00–22:00 WIB", { x: 42, y: 210, size: 13, font: regular, color: rgb(0.88, 0.91, 0.89) });
  page.drawText("Tiara Convention Hall, Medan", { x: 42, y: 187, size: 13, font: regular, color: rgb(0.88, 0.91, 0.89) });
  page.drawText(`Ticket ID  ${ticket.id}`, { x: 42, y: 125, size: 10, font: regular, color: rgb(0.74, 0.8, 0.77) });
  page.drawText(`Order  ${ticket.order_id}`, { x: 42, y: 105, size: 10, font: regular, color: rgb(0.74, 0.8, 0.77) });
  const qrData = await QRCode.toDataURL(ticket.barcode, { margin: 1, width: 420 });
  const qr = await pdf.embedPng(qrData);
  page.drawImage(qr, { x: 520, y: 76, width: 145, height: 145 });
  page.drawText("DEMO TICKET — NOT VALID FOR ENTRY", {
    x: 108,
    y: 52,
    size: 22,
    font: bold,
    color: rgb(0.94, 0.24, 0.18),
    rotate: degrees(8),
    opacity: 0.88,
  });
  return pdf.save();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const id = z.uuid().parse((await params).id);
    const [ticket] =
      await db()`SELECT t.id,t.file_key,t.original_name,t.barcode,t.is_demo,c.name,o.id AS order_id FROM ticket_inventory t JOIN ticket_allocations a ON a.ticket_id=t.id JOIN order_items i ON i.id=a.item_id JOIN orders o ON o.id=i.order_id JOIN ticket_classes c ON c.id=i.class_id WHERE t.id=${id} AND o.user_id=${user.id} AND o.status='CONFIRMED' AND t.status='SOLD'`;
    if (!ticket)
      return NextResponse.json(
        { error: "Tiket tidak ditemukan." },
        { status: 404 },
      );
    if (ticket.is_demo) {
      if (!demoModeEnabled()) return NextResponse.json({ error: "Demo tidak aktif." }, { status: 404 });
      const bytes = await createDemoTicket(ticket);
      return new Response(Buffer.from(bytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="Symphony-of-Faith-${ticket.name}-${id}.pdf"`,
          "Cache-Control": "private, no-store",
        },
      });
    }
    const blob = await get(ticket.file_key, { access: "private" });
    if (!blob?.stream)
      return NextResponse.json(
        { error: "File tiket tidak tersedia." },
        { status: 404 },
      );
    return new Response(blob.stream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${id}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }
}
