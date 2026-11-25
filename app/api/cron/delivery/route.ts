import { NextResponse } from "next/server";
import { processDeliveryJobs } from "@/lib/delivery-worker";

async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await processDeliveryJobs());
}

export const GET = run;
export const POST = run;
