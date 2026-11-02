import type { GeoPoint } from "@/types/route.types";
import type { RoutePlanBounds } from "@/types/route.types";

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Jarak garis lurus (haversine). Hanya dipakai untuk validasi/bounds, bukan estimasi rute. */
export function haversineMeters(first: GeoPoint, second: GeoPoint): number {
  const deltaLatitude = toRadians(second.latitude - first.latitude);
  const deltaLongitude = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);

  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(deltaLongitude / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

export function computeBounds(points: GeoPoint[]): RoutePlanBounds {
  if (points.length === 0) {
    return { south: 0, west: 0, north: 0, east: 0 };
  }

  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);

  return {
    south: Math.min(...latitudes),
    west: Math.min(...longitudes),
    north: Math.max(...latitudes),
    east: Math.max(...longitudes),
  };
}

export function isSamePoint(first: GeoPoint, second: GeoPoint): boolean {
  return (
    Math.abs(first.latitude - second.latitude) < 1e-6 &&
    Math.abs(first.longitude - second.longitude) < 1e-6
  );
}
