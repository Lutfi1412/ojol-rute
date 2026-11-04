import { env } from "@/config/env";
import { MAX_STOPS_PER_ROUTE } from "@/constants/app";
import {
  buildGroupPermutations,
  evaluateSequentialOrder,
  optimizeInterleaving,
  type DistanceLookup,
  type PlannerGroup,
} from "@/features/routes/planning/optimizeRoute";
import type { GeoPoint, RoutePlan, RoutePlanStep, RouteRecord } from "@/types/route.types";
import { computeBounds } from "@/utils/geo";
import { decodePolyline } from "@/utils/polyline";
import { encodePolyline } from "@/utils/polylineEncoder";
import {
  fetchGoogleDirections,
  fetchGoogleDistanceMatrix,
  fetchOsrmDirections,
  fetchOsrmDistanceMatrix,
  RoutingError,
  type DirectionsResult,
} from "./routingClient";

function buildDistanceLookup(distances: number[][], durations: number[][]): DistanceLookup {
  return {
    distanceMeters: (fromNodeIndex, toNodeIndex) =>
      distances[fromNodeIndex]?.[toNodeIndex] ?? 0,
    durationSeconds: (fromNodeIndex, toNodeIndex) =>
      durations[fromNodeIndex]?.[toNodeIndex] ?? 0,
  };
}

export interface BuildRoutePlanOptions {
  /**
   * Titik 0 pengganti, biasanya posisi driver saat ini. Kalau diisi, rencana
   * dihitung dari titik ini dan bukan dari `route.startPoint` yang tersimpan.
   */
  origin?: GeoPoint | null;
  /** Lewati titik yang sudah ditandai selesai (dipakai saat rute berjalan). */
  skipCompletedStops?: boolean;
}

/**
 * Susun rencana rute lengkap: matriks jarak -> urutan selang-seling terbaik ->
 * polyline + total jarak/waktu, plus pembanding "kalau per provider".
 */
export async function buildRoutePlan(
  route: RouteRecord,
  options: BuildRoutePlanOptions = {},
): Promise<RoutePlan> {
  const notes: string[] = [];

  const origin = options.origin ?? route.startPoint;

  const allGroupsWithStops = route.groups.filter((group) => group.stops.length > 0);
  const totalStopsInRoute = allGroupsWithStops.reduce(
    (total, group) => total + group.stops.length,
    0,
  );

  const hasPendingStops = allGroupsWithStops.some((group) =>
    group.stops.some((stop) => stop.completedAt === null),
  );
  const shouldSkipCompleted = options.skipCompletedStops === true && hasPendingStops;

  const groupsWithStops = shouldSkipCompleted
    ? allGroupsWithStops
        .map((group) => ({
          ...group,
          stops: group.stops.filter((stop) => stop.completedAt === null),
        }))
        .filter((group) => group.stops.length > 0)
    : allGroupsWithStops;

  const totalStops = groupsWithStops.reduce((total, group) => total + group.stops.length, 0);
  const skippedCompletedStops = totalStopsInRoute - totalStops;

  if (skippedCompletedStops > 0) {
    notes.push(
      `${skippedCompletedStops} titik yang sudah selesai tidak dihitung lagi; rencana dimulai dari titik berikutnya.`,
    );
  }

  if (options.skipCompletedStops === true && !hasPendingStops && totalStopsInRoute > 0) {
    notes.push("Semua titik sudah ditandai selesai. Rencana ditampilkan lengkap sebagai arsip.");
  }

  if (totalStops === 0) {
    throw new RoutingError("Rute belum punya titik. Tambahkan minimal satu titik dulu.");
  }

  if (totalStops > MAX_STOPS_PER_ROUTE) {
    throw new RoutingError(
      `Terlalu banyak titik (${totalStops}). Maksimal ${MAX_STOPS_PER_ROUTE} titik per rute.`,
    );
  }

  const orderedStops = groupsWithStops.flatMap((group) =>
    group.stops.map((stop) => ({ groupId: group.id, provider: group.provider, stop })),
  );

  const points: GeoPoint[] = [
    ...(origin ? [origin] : []),
    ...orderedStops.map((entry) => ({
      label: entry.stop.label,
      address: entry.stop.address,
      latitude: entry.stop.latitude,
      longitude: entry.stop.longitude,
    })),
  ];

  const pointOffset = origin ? 1 : 0;

  const nodeIndexByStopId: Record<string, number> = {};
  orderedStops.forEach((entry, index) => {
    nodeIndexByStopId[entry.stop.id] = index + pointOffset;
  });

  // Satu titik belum punya etape apa pun: layanan rute butuh minimal 2 koordinat.
  if (points.length < 2) {
    const singleStop = orderedStops[0];

    return {
      routeId: route.id,
      engine: env.isGoogleEnabled ? "google" : "osrm",
      generatedAt: new Date().toISOString(),
      totalDistanceMeters: 0,
      totalDurationSeconds: 0,
      polyline: encodePolyline(points),
      bounds: computeBounds(points),
      startPoint: origin,
      steps: singleStop
        ? [
            {
              stopId: singleStop.stop.id,
              groupId: singleStop.groupId,
              provider: singleStop.provider,
              visitOrder: 1,
              label: singleStop.stop.label,
              address: singleStop.stop.address,
              latitude: singleStop.stop.latitude,
              longitude: singleStop.stop.longitude,
              legDistanceMeters: 0,
              legDurationSeconds: 0,
              cumulativeDistanceMeters: 0,
              cumulativeDurationSeconds: 0,
              completedAt: singleStop.stop.completedAt,
            },
          ]
        : [],
      comparison: {
        interleavedDistanceMeters: 0,
        interleavedDurationSeconds: 0,
        separateDistanceMeters: 0,
        separateDurationSeconds: 0,
        savedDistanceMeters: 0,
        savedDurationSeconds: 0,
      },
      notes: [
        "Rute baru punya satu titik. Tambahkan titik kedua supaya jarak & waktu bisa dihitung.",
      ],
    };
  }

  let matrix = null as Awaited<ReturnType<typeof fetchOsrmDistanceMatrix>> | null;

  if (env.isGoogleEnabled) {
    try {
      matrix = await fetchGoogleDistanceMatrix(points);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "tidak diketahui";
      notes.push(`Google tidak merespons (${reason}). Jarak dihitung ulang dengan OSRM.`);
    }
  }

  if (!matrix) {
    matrix = await fetchOsrmDistanceMatrix(points);
    if (!env.isGoogleEnabled) {
      notes.push(
        "Jarak & waktu memakai OSRM (data OpenStreetMap), bukan Google Maps.",
      );
    }
  }

  const distanceLookup = buildDistanceLookup(matrix.distances, matrix.durations);
  const plannerGroups: PlannerGroup[] = groupsWithStops.map((group) => ({
    groupId: group.id,
    stopIds: group.stops.map((stop) => stop.id),
  }));

  const optimizeInput = {
    groups: plannerGroups,
    nodeIndexByStopId,
    startNodeIndex: origin ? 0 : null,
  };

  const optimized = optimizeInterleaving(optimizeInput, distanceLookup);

  const sequentialOptions = buildGroupPermutations(plannerGroups.length).map((groupOrder) =>
    evaluateSequentialOrder(optimizeInput, distanceLookup, groupOrder),
  );

  const separateBest = sequentialOptions.reduce(
    (best, candidate) =>
      candidate.totalDistanceMeters < best.totalDistanceMeters ? candidate : best,
    sequentialOptions[0] ?? { visits: [], totalDistanceMeters: 0, totalDurationSeconds: 0 },
  );

  const orderedPointsForDirections: GeoPoint[] = [
    ...(origin ? [origin] : []),
    ...optimized.visits.map((visit) => {
      const stopEntry = orderedStops.find((entry) => entry.stop.id === visit.stopId);
      return {
        label: stopEntry?.stop.label ?? "",
        address: stopEntry?.stop.address ?? "",
        latitude: stopEntry?.stop.latitude ?? 0,
        longitude: stopEntry?.stop.longitude ?? 0,
      } as GeoPoint;
    }),
  ];

  let directions: DirectionsResult | null = null;

  try {
    directions =
      matrix.engine === "google"
        ? await fetchGoogleDirections(orderedPointsForDirections)
        : await fetchOsrmDirections(orderedPointsForDirections);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "tidak diketahui";
    notes.push(`Garis rute detail gagal diambil (${reason}). Peta memakai garis lurus antar titik.`);
  }

  const legs = directions?.legs ?? [];
  const steps: RoutePlanStep[] = optimized.visits.map((visit, index) => {
    const stopEntry = orderedStops.find((entry) => entry.stop.id === visit.stopId);
    const legIndex = origin ? index : index - 1;
    const leg = legIndex >= 0 ? legs[legIndex] : undefined;

    return {
      stopId: visit.stopId,
      groupId: visit.groupId,
      provider: stopEntry?.provider ?? "grab",
      visitOrder: index + 1,
      label: stopEntry?.stop.label ?? "",
      address: stopEntry?.stop.address ?? "",
      latitude: stopEntry?.stop.latitude ?? 0,
      longitude: stopEntry?.stop.longitude ?? 0,
      legDistanceMeters: leg?.distanceMeters ?? visit.legDistanceMeters,
      legDurationSeconds: leg?.durationSeconds ?? visit.legDurationSeconds,
      cumulativeDistanceMeters: 0,
      cumulativeDurationSeconds: 0,
      completedAt: stopEntry?.stop.completedAt ?? null,
    };
  });

  let runningDistance = 0;
  let runningDuration = 0;
  steps.forEach((step) => {
    runningDistance += step.legDistanceMeters;
    runningDuration += step.legDurationSeconds;
    step.cumulativeDistanceMeters = runningDistance;
    step.cumulativeDurationSeconds = runningDuration;
  });

  const totalDistanceMeters = directions?.distanceMeters ?? runningDistance;
  const totalDurationSeconds = directions?.durationSeconds ?? runningDuration;

  const polyline =
    directions?.polyline && directions.polyline.length > 0
      ? directions.polyline
      : encodePolyline(orderedPointsForDirections);

  const decodedPoints = decodePolyline(polyline);
  const bounds =
    decodedPoints.length > 0
      ? computeBounds(
          decodedPoints.map((point) => ({
            label: "",
            address: "",
            latitude: point.latitude,
            longitude: point.longitude,
          })),
        )
      : computeBounds(points);

  return {
    routeId: route.id,
    engine: directions?.engine ?? matrix.engine,
    generatedAt: new Date().toISOString(),
    totalDistanceMeters,
    totalDurationSeconds,
    polyline,
    bounds,
    startPoint: origin,
    steps,
    comparison: {
      interleavedDistanceMeters: optimized.totalDistanceMeters,
      interleavedDurationSeconds: optimized.totalDurationSeconds,
      separateDistanceMeters: separateBest.totalDistanceMeters,
      separateDurationSeconds: separateBest.totalDurationSeconds,
      savedDistanceMeters: Math.max(
        0,
        separateBest.totalDistanceMeters - optimized.totalDistanceMeters,
      ),
      savedDurationSeconds: Math.max(
        0,
        separateBest.totalDurationSeconds - optimized.totalDurationSeconds,
      ),
    },
    notes,
  };
}

export { RoutingError };
