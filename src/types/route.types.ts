/**
 * Tipe domain untuk rute ojol.
 *
 * Satu rute = satu "batch" perjalanan. Di dalamnya ada 1..n grup, dan setiap
 * grup milik SATU provider. Urutan stop di dalam grup bersifat TETAP (tidak
 * boleh diacak oleh optimizer) karena mengikuti urutan order yang diberikan
 * provider. Yang dioptimalkan adalah cara menyelang-seling stop antar grup.
 */

export type ProviderId = "grab" | "shopee";

export type RouteStatus = "draft" | "active" | "completed";

export type RoutingEngine = "google" | "osrm";

export interface GeoPoint {
  label: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface RouteStop extends GeoPoint {
  id: string;
  /** Nomor urut TETAP di dalam grupnya (1..n). */
  sequence: number;
  /** Waktu stop ditandai selesai (ISO 8601) atau null bila belum. */
  completedAt: string | null;
  note: string;
}

export interface RouteGroup {
  id: string;
  provider: ProviderId;
  name: string;
  stops: RouteStop[];
}

export interface RouteRecord {
  id: string;
  name: string;
  status: RouteStatus;
  /** Titik awal perjalanan (mis. lokasi driver saat ini). Boleh null. */
  startPoint: GeoPoint | null;
  groups: RouteGroup[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

/** Satu langkah pada rute hasil optimasi. */
export interface RoutePlanStep {
  stopId: string;
  groupId: string;
  provider: ProviderId;
  /** Urutan kunjungan pada rute gabungan (1..N). */
  visitOrder: number;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  legDistanceMeters: number;
  legDurationSeconds: number;
  cumulativeDistanceMeters: number;
  cumulativeDurationSeconds: number;
  completedAt: string | null;
}

export interface RoutePlanComparison {
  /** Total kalau semua grup diselang-seling (rekomendasi). */
  interleavedDistanceMeters: number;
  interleavedDurationSeconds: number;
  /** Total kalau tiap grup dikerjakan terpisah (bolak-balik dari titik awal). */
  separateDistanceMeters: number;
  separateDurationSeconds: number;
  savedDistanceMeters: number;
  savedDurationSeconds: number;
}

export interface RoutePlanBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface RoutePlan {
  routeId: string;
  engine: RoutingEngine;
  generatedAt: string;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  /** Polyline ter-encode (presisi 5) untuk digambar di peta. */
  polyline: string;
  bounds: RoutePlanBounds;
  startPoint: GeoPoint | null;
  steps: RoutePlanStep[];
  comparison: RoutePlanComparison;
  /** Catatan kondisi data (mis. fallback OSRM, garis lurus karena layanan rute gagal). */
  notes: string[];
}
