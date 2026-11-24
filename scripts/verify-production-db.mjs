import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL diperlukan");
const sql = postgres(url, { max: 1, prepare: false });

const expectedVenue = new Map([
  ["VVIP", [77, 2000000]], ["VIP", [77, 1000000]],
  ["GOLD", [177, 500000]], ["SILVER", [577, 250000]],
  ["REGULER", [777, 100000]],
]);
const expectedStreams = new Map([
  ["Simfoni Iman", 2000000], ["Simfoni Agung", 1000000],
  ["Simfoni Harapan", 750000], ["Simfoni Pujian", 500000],
  ["Simfoni Syukur", 250000], ["Simfoni Kasih", 100000],
  ["Simfoni Setia", 50000],
]);

try {
  const migrations = await sql`SELECT name FROM schema_migrations WHERE name IN ('012-official-catalog.sql','013-contribution-tiers.sql','014-production-readiness.sql') ORDER BY name`;
  if (migrations.length !== 3) throw new Error("Migrasi 012, 013, atau 014 belum lengkap");
  const classes = await sql`SELECT name,mode,price,capacity,purchase_limit FROM ticket_classes ORDER BY mode,name`;
  for (const [name, [capacity, price]] of expectedVenue) {
    const row = classes.find((item) => item.mode === "VENUE" && item.name === name);
    if (!row || Number(row.capacity) !== capacity || Number(row.price) !== price)
      throw new Error(`Katalog venue ${name} tidak sesuai`);
  }
  for (const [name, price] of expectedStreams) {
    const row = classes.find((item) => item.mode === "LIVESTREAM" && item.name === name);
    if (!row || Number(row.price) !== price || Number(row.purchase_limit ?? row.capacity) <= 0)
      throw new Error(`Katalog livestream ${name} tidak sesuai`);
  }
  console.log(JSON.stringify({ status: "ok", migrations: migrations.map((row) => row.name), venueCapacity: 1685, livestreamPackages: 7 }));
} finally {
  await sql.end();
}
