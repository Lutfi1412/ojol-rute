import { env } from "@/config/env";
import type { GeoPoint, RoutingEngine } from "@/types/route.types";

/** Jarak & waktu antar semua titik, dalam meter dan detik. */
export interface DistanceMatrixResult {
  engine: RoutingEngine;
  distances: number[][];
  durations: number[][];
}

/** Satu leg perjalanan antar dua titik berurutan. */
export interface DirectionsLeg {
  distanceMeters: number;
  durationSeconds: number;
}

export interface DirectionsResult {
  engine: RoutingEngine;
  distanceMeters: number;
  durationSeconds: number;
  polyline: string;
  legs: DirectionsLeg[];
}

export class RoutingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoutingError";
  }
}

const REQUEST_TIMEOUT_MS = 15_000;

async function fetchJson<TResponse>(url: string): Promise<TResponse> {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: abortController.signal });

    if (!response.ok) {
      throw new RoutingError(`Layanan rute menolak permintaan (HTTP ${response.status})`);
    }

    return (await response.json()) as TResponse;
  } catch (error) {
    if (error instanceof RoutingError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new RoutingError("Layanan rute tidak merespons (timeout)");
    }
    throw new RoutingError("Tidak bisa menghubungi layanan rute. Periksa koneksi internet.");
  } finally {
    clearTimeout(timeoutId);
  }
}

function toCoordinateString(point: GeoPoint): string {
  return `${point.latitude},${point.longitude}`;
}

interface GoogleDistanceMatrixResponse {
  status: string;
  error_message?: string;
  rows?: Array<{
    elements: Array<{
      status: string;
      distance?: { value: number };
      duration?: { value: number };
    }>;
  }>;
}

interface GoogleDirectionsResponse {
  status: string;
  error_message?: string;
  routes?: Array<{
    overview_polyline?: { points: string };
    legs?: Array<{
      distance?: { value: number };
      duration?: { value: number };
    }>;
  }>;
}

/** Matriks jarak Google. Batas resmi: 25 origin x 25 destination per request. */
export async function fetchGoogleDistanceMatrix(points: GeoPoint[]): Promise<DistanceMatrixResult> {
  const coordinates = points.map(toCoordinateString).join("|");
  const url =
    "https://maps.googleapis.com/maps/api/distancematrix/json" +
    `?origins=${encodeURIComponent(coordinates)}` +
    `&destinations=${encodeURIComponent(coordinates)}` +
    "&mode=driving&language=id" +
    `&key=${env.googleMapsApiKey}`;

  const payload = await fetchJson<GoogleDistanceMatrixResponse>(url);

  if (payload.status !== "OK" || !payload.rows) {
    throw new RoutingError(
      `Google Distance Matrix gagal: ${payload.error_message ?? payload.status}`,
    );
  }

  const distances: number[][] = [];
  const durations: number[][] = [];

  payload.rows.forEach((row, rowIndex) => {
    const distanceRow: number[] = [];
    const durationRow: number[] = [];

    row.elements.forEach((element, columnIndex) => {
      if (rowIndex === columnIndex) {
        distanceRow[columnIndex] = 0;
        durationRow[columnIndex] = 0;
        return;
      }

      distanceRow[columnIndex] = element.distance?.value ?? 0;
      durationRow[columnIndex] = element.duration?.value ?? 0;
    });

    distances.push(distanceRow);
    durations.push(durationRow);
  });

  return { engine: "google", distances, durations };
}

/** Rute + polyline Google Directions. */
export async function fetchGoogleDirections(
  orderedPoints: GeoPoint[],
): Promise<DirectionsResult> {
  if (orderedPoints.length < 2) {
    return { engine: "google", distanceMeters: 0, durationSeconds: 0, polyline: "", legs: [] };
  }

  const origin = orderedPoints[0];
  const destination = orderedPoints[orderedPoints.length - 1];
  const waypointPoints = orderedPoints.slice(1, -1);

  if (!origin || !destination) {
    throw new RoutingError("Titik rute tidak lengkap");
  }

  const waypoints = waypointPoints.map(toCoordinateString).join("|");
  const url =
    "https://maps.googleapis.com/maps/api/directions/json" +
    `?origin=${encodeURIComponent(toCoordinateString(origin))}` +
    `&destination=${encodeURIComponent(toCoordinateString(destination))}` +
    (waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : "") +
    "&mode=driving&language=id" +
    `&key=${env.googleMapsApiKey}`;

  const payload = await fetchJson<GoogleDirectionsResponse>(url);
  const route = payload.routes?.[0];

  if (payload.status !== "OK" || !route) {
    throw new RoutingError(`Google Directions gagal: ${payload.error_message ?? payload.status}`);
  }

  const legs = (route.legs ?? []).map((leg) => ({
    distanceMeters: leg.distance?.value ?? 0,
    durationSeconds: leg.duration?.value ?? 0,
  }));

  return {
    engine: "google",
    distanceMeters: legs.reduce((total, leg) => total + leg.distanceMeters, 0),
    durationSeconds: legs.reduce((total, leg) => total + leg.durationSeconds, 0),
    polyline: route.overview_polyline?.points ?? "",
    legs,
  };
}

interface OsrmTableResponse {
  code: string;
  distances?: number[][];
  durations?: number[][];
}

interface OsrmRouteResponse {
  code: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: string;
    legs?: Array<{ distance: number; duration: number }>;
  }>;
}

/** Matriks jarak OSRM (gratis, tanpa key, tetap mengikuti jalan). */
export async function fetchOsrmDistanceMatrix(points: GeoPoint[]): Promise<DistanceMatrixResult> {
  const coordinates = points
    .map((point) => `${point.longitude},${point.latitude}`)
    .join(";");

  const url =
    `${env.osrmBaseUrl}/table/v1/driving/${coordinates}` +
    "?annotations=distance,duration";

  const payload = await fetchJson<OsrmTableResponse>(url);

  if (payload.code !== "Ok" || !payload.distances || !payload.durations) {
    throw new RoutingError(`OSRM gagal menghitung matriks jarak (${payload.code})`);
  }

  return {
    engine: "osrm",
    distances: payload.distances,
    durations: payload.durations.map((row) => row.map((value) => value ?? 0)),
  };
}

export async function fetchOsrmDirections(orderedPoints: GeoPoint[]): Promise<DirectionsResult> {
  if (orderedPoints.length < 2) {
    return { engine: "osrm", distanceMeters: 0, durationSeconds: 0, polyline: "", legs: [] };
  }

  const coordinates = orderedPoints
    .map((point) => `${point.longitude},${point.latitude}`)
    .join(";");

  const url =
    `${env.osrmBaseUrl}/route/v1/driving/${coordinates}` +
    "?overview=full&geometries=polyline&steps=false";

  const payload = await fetchJson<OsrmRouteResponse>(url);
  const route = payload.routes?.[0];

  if (payload.code !== "Ok" || !route) {
    throw new RoutingError(`OSRM gagal menghitung rute (${payload.code})`);
  }

  return {
    engine: "osrm",
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    polyline: route.geometry,
    legs: (route.legs ?? []).map((leg) => ({
      distanceMeters: leg.distance,
      durationSeconds: leg.duration,
    })),
  };
}
