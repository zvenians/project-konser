import { ensureDemoData } from "../lib/demo-data.ts";
import { db } from "../lib/db.ts";

try {
  await ensureDemoData();
  const [summary] = await db()`SELECT count(*)::integer AS inventory FROM ticket_inventory WHERE is_demo=true`;
  console.log(JSON.stringify({ result: "seeded", inventory: summary.inventory }));
} finally {
  await db().end();
}
