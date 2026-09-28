/**
 * Deterministic, validly-shaped v4 UUIDs from a human-readable seed, so
 * fixture files can write `fixtureId("worker-ramesh")` instead of a hand-typed
 * UUID: stable across reloads, cross-referenceable between fixture files
 * (a worker's id here is the same string an attendance record points at),
 * and shaped to pass contracts' `IdSchema` (`z.string().uuid()`).
 */
export function fixtureId(seed: string): string {
  const bytes: number[] = [];
  for (let round = 0; round < 16; round++) {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i) + round * 97;
      h = Math.imul(h, 16777619);
    }
    bytes.push((h >>> 0) & 0xff);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
