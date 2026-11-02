/** Pembuat id sederhana yang cukup unik untuk data lokal (rute, grup, stop). */
export function createId(prefix: string): string {
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);

  return `${prefix}_${randomPart}`;
}
