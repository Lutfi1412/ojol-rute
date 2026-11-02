import { describe, expect, it } from "vitest";
import {
  buildGroupPermutations,
  evaluateSequentialOrder,
  optimizeInterleaving,
  type DistanceLookup,
  type OptimizeInput,
} from "@/features/routes/planning/optimizeRoute";

/** Jarak "jalan" disimulasikan dengan jarak Euclidean pada grid 1 km. */
const gridNodes: Record<string, [number, number]> = {
  "g1-a": [0, 0],
  "g1-b": [0, 1],
  "s1-a": [1, 0],
  "s1-b": [1, 1],
  "g2-a": [2, 0],
  "s2-a": [3, 0],
  start: [-1, 0],
};

const nodeIndexByStopId: Record<string, number> = Object.fromEntries(
  Object.keys(gridNodes).map((stopId, index) => [stopId, index]),
);

const nodeCoordinates = Object.entries(nodeIndexByStopId).map(
  ([stopId, index]) => [index, gridNodes[stopId] ?? [0, 0]] as const,
);

const lookup: DistanceLookup = {
  distanceMeters: (fromNodeIndex, toNodeIndex) => {
    const from = nodeCoordinates.find(([index]) => index === fromNodeIndex)?.[1] ?? [0, 0];
    const to = nodeCoordinates.find(([index]) => index === toNodeIndex)?.[1] ?? [0, 0];
    return Math.hypot(from[0] - to[0], from[1] - to[1]) * 1000;
  },
  durationSeconds: (fromNodeIndex, toNodeIndex) => {
    const from = nodeCoordinates.find(([index]) => index === fromNodeIndex)?.[1] ?? [0, 0];
    const to = nodeCoordinates.find(([index]) => index === toNodeIndex)?.[1] ?? [0, 0];
    return Math.hypot(from[0] - to[0], from[1] - to[1]) * 120;
  },
};

const baseInput: OptimizeInput = {
  groups: [
    { groupId: "grab-1", stopIds: ["g1-a", "g1-b"] },
    { groupId: "shopee-1", stopIds: ["s1-a", "s1-b"] },
  ],
  nodeIndexByStopId,
  startNodeIndex: null,
};

describe("optimizeInterleaving", () => {
  it("menyelang-seling grup kalau itu lebih dekat", () => {
    const result = optimizeInterleaving(baseInput, lookup);

    // Jalur optimal: (0,0) -> (1,0) -> (1,1) -> (0,1) = 3 km,
    // sedangkan menyelesaikan Grab dulu = 3,41 km.
    expect(result.visits.map((visit) => visit.stopId)).toEqual([
      "g1-a",
      "s1-a",
      "s1-b",
      "g1-b",
    ]);
  });

  it("tidak pernah mengubah urutan stop di dalam grup", () => {
    const result = optimizeInterleaving(baseInput, lookup);

    const grabOrder = result.visits
      .filter((visit) => visit.groupId === "grab-1")
      .map((visit) => visit.stopId);
    const shopeeOrder = result.visits
      .filter((visit) => visit.groupId === "shopee-1")
      .map((visit) => visit.stopId);

    expect(grabOrder).toEqual(["g1-a", "g1-b"]);
    expect(shopeeOrder).toEqual(["s1-a", "s1-b"]);
  });

  it("tidak lebih buruk daripada menyelesaikan per provider", () => {
    const interleaved = optimizeInterleaving(baseInput, lookup);
    const sequentialBest = buildGroupPermutations(2)
      .map((order) => evaluateSequentialOrder(baseInput, lookup, order))
      .reduce((best, candidate) =>
        candidate.totalDistanceMeters < best.totalDistanceMeters ? candidate : best,
      );

    expect(interleaved.totalDistanceMeters).toBeLessThanOrEqual(
      sequentialBest.totalDistanceMeters,
    );
  });

  it("menghormati titik awal driver sebagai titik pertama", () => {
    const inputWithStart: OptimizeInput = {
      ...baseInput,
      nodeIndexByStopId,
      startNodeIndex: nodeIndexByStopId.start ?? null,
    };

    const result = optimizeInterleaving(inputWithStart, lookup);

    expect(result.visits[0]?.legDistanceMeters).toBeGreaterThan(0);
    expect(result.visits).toHaveLength(4);
  });

  it("menangani rute dengan satu grup", () => {
    const singleGroupInput: OptimizeInput = {
      ...baseInput,
      groups: [{ groupId: "grab-1", stopIds: ["g1-a", "g1-b"] }],
    };

    const result = optimizeInterleaving(singleGroupInput, lookup);

    expect(result.visits.map((visit) => visit.stopId)).toEqual(["g1-a", "g1-b"]);
  });

  it("menangani tiga grup tanpa menggandakan atau menghilangkan titik", () => {
    const threeGroupInput: OptimizeInput = {
      ...baseInput,
      groups: [
        ...baseInput.groups,
        { groupId: "grab-2", stopIds: ["g2-a"] },
        { groupId: "shopee-2", stopIds: ["s2-a"] },
      ],
    };

    const result = optimizeInterleaving(threeGroupInput, lookup);
    const visitedStopIds = result.visits.map((visit) => visit.stopId);

    expect(visitedStopIds).toHaveLength(6);
    expect(new Set(visitedStopIds).size).toBe(6);
  });
});
