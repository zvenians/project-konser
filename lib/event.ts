export const event = {
  title: "Symphony of Faith",
  startsAt: "2027-02-07T19:00:00+07:00",
  endsAt: "2027-02-07T22:00:00+07:00",
  timezone: "Asia/Jakarta",
  venue: "Tiara Convention Hall, Medan",
  instagram: "https://www.instagram.com/symphonyoffaithconcert?cnvx=MWN3ZnViYmMwZWtuYw==",
};

export const officialClasses = [
  { name: "Platinum", capacity: 70, venuePrice: 2000000, streamPrice: 1000000 },
  { name: "Gold", capacity: 170, venuePrice: 1000000, streamPrice: 500000 },
  { name: "Silver", capacity: 270, venuePrice: 500000, streamPrice: 250000 },
  { name: "Bronze", capacity: 570, venuePrice: 250000, streamPrice: 100000 },
  { name: "Reguler", capacity: 770, venuePrice: 100000, streamPrice: 50000 },
];

export function countdown(now: number, start = event.startsAt, end = event.endsAt) {
  const seconds = Math.max(0, Math.floor((Date.parse(start) - now) / 1000));
  return {
    phase: now >= Date.parse(end) ? "ended" : now >= Date.parse(start) ? "live" : "upcoming",
    values: [Math.floor(seconds / 86400), Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60],
  };
}
