import { createHash, randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const admin=await requireAdmin();
    const data=await request.formData();
    const classId=z.uuid().parse(data.get("classId"));
    const barcode=z.string().trim().min(3).max(512).parse(data.get("barcode"));
    const file=data.get("file");
    if(!(file instanceof File) || file.size>5_000_000 || file.size<100) return NextResponse.json({error:"PDF harus berukuran 100 B sampai 5 MB."},{status:400});
    const bytes=Buffer.from(await file.arrayBuffer());
    if(bytes.subarray(0,5).toString()!=="%PDF-") return NextResponse.json({error:"File bukan PDF."},{status:400});
    const hash=createHash("sha256").update(bytes).digest("hex");
    const sql=db();
    const [ticketClass]=await sql`SELECT id,capacity FROM ticket_classes WHERE id=${classId} AND mode='VENUE'`;
    if(!ticketClass) return NextResponse.json({error:"Kelas venue tidak ditemukan."},{status:400});
    const [existing]=await sql`SELECT id FROM ticket_inventory WHERE file_hash=${hash} OR barcode=${barcode}`;
    if(existing) return NextResponse.json({error:"PDF atau kode sudah pernah diimpor."},{status:409});
    const key=`tickets/${classId}/${randomUUID()}.pdf`;
    const blob=await put(key,bytes,{access:"private",contentType:"application/pdf",addRandomSuffix:false});
    const [batch]=await sql`INSERT INTO ticket_import_batches(user_id) VALUES (${admin.id}) RETURNING id`;
    await sql`INSERT INTO ticket_inventory(class_id,batch_id,file_key,file_hash,barcode,original_name) VALUES (${classId},${batch.id},${blob.pathname},${hash},${barcode},${file.name})`;
    return NextResponse.json({status:"NEEDS_REVIEW"},{status:201});
  } catch { return NextResponse.json({error:"Impor gagal. Periksa data, kapasitas, dan konfigurasi penyimpanan."},{status:400}); }
}
