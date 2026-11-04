import type { GeoPoint } from "@/types/route.types";

/** Posisi driver yang terbaca dari GPS perangkat. */
export interface DriverFix {
  latitude: number;
  longitude: number;
  /** Radius ketelitian dalam meter; makin kecil makin akurat. */
  accuracyMeters: number;
  /** Waktu posisi diambil, ISO 8601. */
  capturedAt: string;
}

export type PlanOriginSource = "driver" | "route-start" | "first-stop";

export interface PlanOrigin {
  /** Titik 0 rencana rute; null berarti rute dimulai dari stop pertama. */
  point: GeoPoint | null;
  source: PlanOriginSource;
}

export const DRIVER_ORIGIN_LABEL = "Lokasi saya";

/**
 * Batas umur posisi yang masih dianggap mewakili "sekarang". Lewat dari ini,
 * kartu lokasi menandai posisi perlu diperbarui.
 */
export const DRIVER_FIX_MAX_AGE_MS = 3 * 60 * 1000;

/** Posisi GPS diubah jadi titik rute supaya bisa dipakai planner dan peta. */
export function toGeoPoint(fix: DriverFix, label: string = DRIVER_ORIGIN_LABEL): GeoPoint {
  return {
    label,
    address: `${fix.latitude.toFixed(5)}, ${fix.longitude.toFixed(5)}`,
    latitude: fix.latitude,
    longitude: fix.longitude,
  };
}

/**
 * Titik 0 rencana rute: posisi driver sekarang kalau ada, lalu titik awal yang
 * tersimpan di rute, dan terakhir mulai dari stop pertama.
 */
export function resolvePlanOrigin(
  routeStartPoint: GeoPoint | null,
  driverFix: DriverFix | null,
): PlanOrigin {
  if (driverFix) {
    return { point: toGeoPoint(driverFix), source: "driver" };
  }

  if (routeStartPoint) {
    return { point: routeStartPoint, source: "route-start" };
  }

  return { point: null, source: "first-stop" };
}

export function isDriverFixStale(
  fix: DriverFix | null,
  now: number = Date.now(),
  maxAgeMs: number = DRIVER_FIX_MAX_AGE_MS,
): boolean {
  if (!fix) return true;

  const capturedAt = Date.parse(fix.capturedAt);

  return Number.isNaN(capturedAt) || now - capturedAt > maxAgeMs;
}
