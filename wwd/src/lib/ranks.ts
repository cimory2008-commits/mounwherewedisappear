// Satu-satunya konfigurasi rank. Dipakai semua halaman.
export const RANKS = [
  { id: 1, name: "THE NOVICE", min: 0, max: 2, icon: "/ranks/rank-1.png" },
  { id: 2, name: "THE AMATEUR", min: 3, max: 4, icon: "/ranks/rank-2.png" },
  { id: 3, name: "THE REGULAR", min: 5, max: 7, icon: "/ranks/rank-3.png" },
  { id: 4, name: "THE EXPEDITIONIST", min: 8, max: Infinity, icon: "/ranks/rank-4.png" },
] as const;

export function getRank(summit: number) {
  const s = Math.max(0, Math.floor(summit));
  return RANKS.find((r) => s >= r.min && s <= r.max) ?? RANKS[0];
}
