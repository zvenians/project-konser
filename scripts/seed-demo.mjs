import { ensureDemoData, resetDemoData } from "../lib/demo-data.ts";
import { db } from "../lib/db.ts";

try {
  if (process.argv.includes("--reset")) await resetDemoData();
  else await ensureDemoData();
  const [summary] = await db()`SELECT count(*)::integer AS inventory FROM ticket_inventory WHERE is_demo=true`;
  console.log(JSON.stringify({ result: "seeded", inventory: summary.inventory }));
} finally {
  await db().end();
}
