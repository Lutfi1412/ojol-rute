/**
 * Mesin perencanaan rute.
 *
 * Aturan main:
 * 1. Urutan stop DI DALAM satu grup tidak boleh diubah (itu urutan order dari
 *    provider, termasuk kalau rutenya melingkar).
 * 2. Yang dicari adalah cara menyelang-seling antar grup (Grab vs Shopee)
 *    dengan total jarak tempuh paling kecil.
 * 3. Semua biaya memakai jarak jalan sungguhan dari matriks jarak
 *    (Google Distance Matrix atau OSRM), bukan jarak garis lurus.
 */

export interface PlannerGroup {
  groupId: string;
  stopIds: string[];
}

export interface DistanceLookup {
  distanceMeters: (fromNodeIndex: number, toNodeIndex: number) => number;
  durationSeconds: (fromNodeIndex: number, toNodeIndex: number) => number;
}

export interface OptimizeInput {
  groups: PlannerGroup[];
  /** stopId -> index node pada matriks jarak. */
  nodeIndexByStopId: Record<string, number>;
  /** Index node titik awal (posisi driver). null = mulai dari stop pertama. */
  startNodeIndex: number | null;
}

export interface PlannedVisit {
  stopId: string;
  groupId: string;
  nodeIndex: number;
  legDistanceMeters: number;
  legDurationSeconds: number;
  cumulativeDistanceMeters: number;
  cumulativeDurationSeconds: number;
}

export interface PlanEvaluation {
  visits: PlannedVisit[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
}

interface StopRef {
  groupId: string;
  stopId: string;
  groupIndex: number;
}

interface RecursiveResult {
  costMeters: number;
  order: StopRef[];
}

/** Batas jumlah state DP; di atas ini pakai urutan grup berurutan (heuristik). */
const MAX_SEARCH_STATES = 300_000;

function countCombinations(groupLengths: number[]): number {
  return groupLengths.reduce((total, length) => total * (length + 1), 1);
}

function buildEvaluation(stopOrder: StopRef[], input: OptimizeInput, lookup: DistanceLookup): PlanEvaluation {
  const visits: PlannedVisit[] = [];
  let previousNodeIndex = input.startNodeIndex;
  let cumulativeDistanceMeters = 0;
  let cumulativeDurationSeconds = 0;

  for (const stopRef of stopOrder) {
    const nodeIndex = input.nodeIndexByStopId[stopRef.stopId];
    if (nodeIndex === undefined) continue;

    const legDistanceMeters =
      previousNodeIndex === null ? 0 : lookup.distanceMeters(previousNodeIndex, nodeIndex);
    const legDurationSeconds =
      previousNodeIndex === null ? 0 : lookup.durationSeconds(previousNodeIndex, nodeIndex);

    cumulativeDistanceMeters += legDistanceMeters;
    cumulativeDurationSeconds += legDurationSeconds;

    visits.push({
      stopId: stopRef.stopId,
      groupId: stopRef.groupId,
      nodeIndex,
      legDistanceMeters,
      legDurationSeconds,
      cumulativeDistanceMeters,
      cumulativeDurationSeconds,
    });

    previousNodeIndex = nodeIndex;
  }

  return {
    visits,
    totalDistanceMeters: cumulativeDistanceMeters,
    totalDurationSeconds: cumulativeDurationSeconds,
  };
}

/**
 * Urutan "selesaikan grup satu per satu" — dipakai sebagai pembanding:
 * "kalau Grab dulu semua, baru Shopee" vs "kalau diselang-seling".
 */
export function evaluateSequentialOrder(
  input: OptimizeInput,
  lookup: DistanceLookup,
  groupOrder: number[],
): PlanEvaluation {
  const stopOrder: StopRef[] = [];

  for (const groupIndex of groupOrder) {
    const group = input.groups[groupIndex];
    if (!group) continue;

    group.stopIds.forEach((stopId) => {
      stopOrder.push({ groupId: group.groupId, stopId, groupIndex });
    });
  }

  return buildEvaluation(stopOrder, input, lookup);
}

/** Semua permutasi urutan grup (maksimum 3 grup → 6 kemungkinan). */
export function buildGroupPermutations(groupCount: number): number[][] {
  if (groupCount <= 1) return [Array.from({ length: groupCount }, (_, index) => index)];

  const permutations: number[][] = [];

  const walk = (remaining: number[], current: number[]) => {
    if (remaining.length === 0) {
      permutations.push([...current]);
      return;
    }

    remaining.forEach((value, index) => {
      walk(
        [...remaining.slice(0, index), ...remaining.slice(index + 1)],
        [...current, value],
      );
    });
  };

  walk(
    Array.from({ length: groupCount }, (_, index) => index),
    [],
  );

  return permutations;
}

/**
 * Cari urutan kunjungan dengan total jarak paling kecil, dengan aturan urutan
 * di dalam grup tetap. Memakai dynamic programming atas (jumlah stop yang sudah
 * diambil per grup, grup terakhir yang dikunjungi).
 */
export function optimizeInterleaving(input: OptimizeInput, lookup: DistanceLookup): PlanEvaluation {
  const activeGroups = input.groups.filter((group) => group.stopIds.length > 0);

  if (activeGroups.length === 0) {
    return { visits: [], totalDistanceMeters: 0, totalDurationSeconds: 0 };
  }

  if (activeGroups.length === 1) {
    return evaluateSequentialOrder({ ...input, groups: activeGroups }, lookup, [0]);
  }

  const groupLengths = activeGroups.map((group) => group.stopIds.length);

  if (countCombinations(groupLengths) > MAX_SEARCH_STATES) {
    // Rute sangat besar: pakai urutan grup berurutan sebagai heuristik aman.
    const permutations = buildGroupPermutations(activeGroups.length);
    return permutations
      .map((order) =>
        evaluateSequentialOrder({ ...input, groups: activeGroups }, lookup, order),
      )
      .reduce((best, candidate) =>
        candidate.totalDistanceMeters < best.totalDistanceMeters ? candidate : best,
      );
  }

  const memo = new Map<string, RecursiveResult>();

  const lastNodeIndexOf = (counts: number[], lastGroupIndex: number): number | null => {
    if (lastGroupIndex < 0) return input.startNodeIndex;

    const group = activeGroups[lastGroupIndex];
    const positionInGroup = counts[lastGroupIndex] ?? 0;
    if (!group || positionInGroup === 0) return input.startNodeIndex;

    const stopId = group.stopIds[positionInGroup - 1];
    const nodeIndex = stopId ? input.nodeIndexByStopId[stopId] : undefined;

    return nodeIndex ?? input.startNodeIndex;
  };

  const solve = (counts: number[], lastGroupIndex: number): RecursiveResult => {
    const isComplete = counts.every((count, index) => count === groupLengths[index]);
    if (isComplete) return { costMeters: 0, order: [] };

    const memoKey = `${counts.join(":")}|${lastGroupIndex}`;
    const cached = memo.get(memoKey);
    if (cached) return cached;

    const currentNodeIndex = lastNodeIndexOf(counts, lastGroupIndex);

    let bestResult: RecursiveResult | null = null;

    for (let groupIndex = 0; groupIndex < activeGroups.length; groupIndex += 1) {
      const group = activeGroups[groupIndex];
      const takenCount = counts[groupIndex] ?? 0;
      if (!group || takenCount >= group.stopIds.length) continue;

      const nextStopId = group.stopIds[takenCount];
      if (!nextStopId) continue;

      const nextNodeIndex = input.nodeIndexByStopId[nextStopId];
      if (nextNodeIndex === undefined) continue;

      const legCost =
        currentNodeIndex === null ? 0 : lookup.distanceMeters(currentNodeIndex, nextNodeIndex);

      const nextCounts = [...counts];
      nextCounts[groupIndex] = takenCount + 1;

      const subResult = solve(nextCounts, groupIndex);
      const candidateCost = legCost + subResult.costMeters;

      if (!bestResult || candidateCost < bestResult.costMeters) {
        bestResult = {
          costMeters: candidateCost,
          order: [
            { groupId: group.groupId, stopId: nextStopId, groupIndex },
            ...subResult.order,
          ],
        };
      }
    }

    const result = bestResult ?? { costMeters: 0, order: [] };
    memo.set(memoKey, result);

    return result;
  };

  const solved = solve(
    activeGroups.map(() => 0),
    -1,
  );

  return buildEvaluation(solved.order, { ...input, groups: activeGroups }, lookup);
}
