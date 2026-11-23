import { createHash, randomUUID } from "node:crypto";
import { del, put } from "@vercel/blob";
import { parse } from "csv-parse/sync";
import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";

const rowSchema = z.object({
  filename: z.string().min(1).max(180),
  barcode: z.string().min(3).max(512),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
});
class ImportError extends Error {}

export async function POST(request: Request) {
  let uploaded: string[] = [];
  try {
    const admin = await currentUser();
    if (admin?.role !== "ADMIN")
      return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
    const data = await request.formData();
    const classId = z.uuid().parse(data.get("classId"));
    const manifest = data.get("manifest");
    const files = data.getAll("files");
    if (
      !(manifest instanceof File) ||
      manifest.size > 100_000 ||
      manifest.size === 0
    )
      throw new ImportError("Manifest CSV tidak valid.");
    if (
      files.length < 1 ||
      files.length > 20 ||
      files.some((file) => !(file instanceof File))
    )
      throw new ImportError("Pilih 1–20 PDF.");
    const pdfs = files as File[];
    if (pdfs.reduce((sum, file) => sum + file.size, 0) > 3_500_000)
      throw new ImportError("Total PDF melebihi 3,5 MB.");
    const rows = rowSchema
      .array()
      .min(1)
      .max(20)
      .parse(
        parse(await manifest.text(), {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          bom: true,
        }),
      );
    if (rows.length !== pdfs.length)
      throw new ImportError("Jumlah manifest dan PDF tidak cocok.");
    if (
      new Set(rows.map((row) => row.filename)).size !== rows.length ||
      new Set(rows.map((row) => row.barcode)).size !== rows.length ||
      new Set(rows.map((row) => row.sha256.toLowerCase())).size !== rows.length
    )
      throw new ImportError("Manifest memiliki duplikasi.");
    const entries: {
      filename: string;
      barcode: string;
      hash: string;
      bytes: Buffer;
      fileKey?: string;
    }[] = [];
    for (const file of pdfs) {
      if (file.size < 100 || file.size > 3_500_000)
        throw new ImportError("Ukuran PDF tidak valid.");
      const bytes = Buffer.from(await file.arrayBuffer());
      if (bytes.subarray(0, 5).toString() !== "%PDF-")
        throw new ImportError(`${file.name} bukan PDF.`);
      const hash = createHash("sha256").update(bytes).digest("hex");
      const row = rows.find((item) => item.filename === file.name);
      if (!row || row.sha256.toLowerCase() !== hash)
        throw new ImportError(
          `Hash PDF ${file.name} tidak cocok dengan manifest.`,
        );
      entries.push({ filename: file.name, barcode: row.barcode, hash, bytes });
    }
    if (new Set(entries.map((entry) => entry.filename)).size !== entries.length)
      throw new ImportError("Nama PDF duplikat.");
    const sql = db();
    const [ticketClass] =
      await sql`SELECT id FROM ticket_classes WHERE id=${classId} AND mode='VENUE'`;
    if (!ticketClass) throw new ImportError("Kelas venue tidak ditemukan.");
    for (const entry of entries) {
      const blob = await put(
        `tickets/${classId}/${randomUUID()}.pdf`,
        entry.bytes,
        {
          access: "private",
          contentType: "application/pdf",
          addRandomSuffix: false,
        },
      );
      uploaded.push(blob.url);
      entry.fileKey = blob.pathname;
    }
    const batch = await sql.begin(async (tx) => {
      const [locked] =
        await tx`SELECT capacity FROM ticket_classes WHERE id=${classId} FOR UPDATE`;
      const [counts] =
        await tx`SELECT count(*)::integer AS total FROM ticket_inventory WHERE class_id=${classId} AND status<>'VOIDED'`;
      if (counts.total + entries.length > locked.capacity)
        throw new ImportError("Impor melebihi kapasitas resmi.");
      const [created] =
        await tx`INSERT INTO ticket_import_batches(user_id) VALUES (${admin.id}) RETURNING id`;
      for (const entry of entries) {
        await tx`INSERT INTO ticket_inventory(class_id,batch_id,file_key,file_hash,barcode,original_name) VALUES (${classId},${created.id},${entry.fileKey!},${entry.hash},${entry.barcode},${entry.filename})`;
      }
      return created.id;
    });
    uploaded = [];
    return NextResponse.json(
      { batchId: batch, imported: entries.length, status: "NEEDS_REVIEW" },
      { status: 201 },
    );
  } catch (error) {
    await Promise.all(uploaded.map((url) => del(url).catch(() => {})));
    return NextResponse.json(
      {
        error:
          error instanceof ImportError
            ? error.message
            : "Impor gagal. Periksa format, duplikasi, dan konfigurasi penyimpanan.",
      },
      { status: 400 },
    );
  }
}
