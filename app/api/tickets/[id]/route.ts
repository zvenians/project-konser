import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
  try {
    const user=await requireUser();
    const id=z.uuid().parse((await params).id);
    const [ticket]=await db()`SELECT t.file_key,t.original_name FROM ticket_inventory t JOIN ticket_allocations a ON a.ticket_id=t.id JOIN order_items i ON i.id=a.item_id JOIN orders o ON o.id=i.order_id WHERE t.id=${id} AND o.user_id=${user.id} AND o.status='CONFIRMED' AND t.status='SOLD'`;
    if(!ticket) return NextResponse.json({error:"Tiket tidak ditemukan."},{status:404});
    const blob=await get(ticket.file_key,{access:"private"});
    if(!blob?.stream) return NextResponse.json({error:"File tiket tidak tersedia."},{status:404});
    return new Response(blob.stream,{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="${id}.pdf"`,"Cache-Control":"private, no-store"}});
  } catch { return NextResponse.json({error:"Akses ditolak."},{status:403}); }
}
