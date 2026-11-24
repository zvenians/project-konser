export const event = {
  title: "Symphony of Faith",
  startsAt: "2027-02-07T19:00:00+07:00",
  endsAt: "2027-02-07T22:00:00+07:00",
  timezone: "Asia/Jakarta",
  venue: "Tiara Convention Hall, Medan",
  instagram: "https://www.instagram.com/symphonyoffaithconcert?cnvx=MWN3ZnViYmMwZWtuYw==",
};

export const venueClasses = [
  { name: "VVIP", capacity: 77, price: 2000000 },
  { name: "VIP", capacity: 77, price: 1000000 },
  { name: "GOLD", capacity: 177, price: 500000 },
  { name: "SILVER", capacity: 577, price: 250000 },
  { name: "REGULER", capacity: 777, price: 100000 },
] as const;

export const livestreamPackages = [
  { name: "Simfoni Iman", price: 2000000 },
  { name: "Simfoni Agung", price: 1000000 },
  { name: "Simfoni Harapan", price: 750000 },
  { name: "Simfoni Pujian", price: 500000 },
  { name: "Simfoni Syukur", price: 250000 },
  { name: "Simfoni Kasih", price: 100000 },
  { name: "Simfoni Setia", price: 50000 },
] as const;

export const contributionTiers = [
  { name: "Pilar Iman", price: 2000000 },
  { name: "Sahabat Pembangunan", price: 1000000 },
  { name: "Tangan Kasih", price: 750000 },
  { name: "Iman yang Membangun", price: 500000 },
  { name: "Benih Berkat", price: 250000 },
  { name: "Semangat Membangun", price: 100000 },
] as const;

/** @deprecated Use venueClasses or livestreamPackages for new code. */
export const officialClasses = venueClasses;

export function countdown(now: number, start = event.startsAt, end = event.endsAt) {
  const seconds = Math.max(0, Math.floor((Date.parse(start) - now) / 1000));
  return {
    phase: now >= Date.parse(end) ? "ended" : now >= Date.parse(start) ? "live" : "upcoming",
    values: [Math.floor(seconds / 86400), Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60],
  };
}
