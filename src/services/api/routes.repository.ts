import {
  MAX_GROUPS_PER_ROUTE,
  MAX_STOPS_PER_GROUP,
  MAX_STOPS_PER_ROUTE,
  PROVIDERS,
} from "@/constants/app";
import type {
  ProviderId,
  RouteGroup,
  RouteRecord,
  RouteStatus,
  RouteStop,
} from "@/types/route.types";
import { createId } from "@/utils/id";
import {
  addGroupSchema,
  addStopSchema,
  createRouteSchema,
  reorderStopsSchema,
  updateRouteSchema,
  updateStopSchema,
  type CreateRoutePayload,
  type UpdateRoutePayload,
} from "@/utils/validators";
import { ApiError } from "./apiError";
import { readDatabase, writeDatabase, type LocalDatabaseShape } from "./localDatabase";

const STOP_ID_PREFIX = "stop";
const GROUP_ID_PREFIX = "grp";
const ROUTE_ID_PREFIX = "rte";

function nowIso(): string {
  return new Date().toISOString();
}

function resequenceStops(stops: RouteStop[]): RouteStop[] {
  return stops.map((stop, index) => ({ ...stop, sequence: index + 1 }));
}

function defaultGroupName(provider: ProviderId, existingGroups: RouteGroup[]): string {
  const sameProviderCount = existingGroups.filter((group) => group.provider === provider).length;
  const providerLabel = PROVIDERS[provider].label;

  return sameProviderCount === 0
    ? providerLabel
    : `${providerLabel} ${sameProviderCount + 1}`;
}

function defaultRouteName(groups: RouteGroup[]): string {
  const labels = Array.from(new Set(groups.map((group) => PROVIDERS[group.provider].label)));

  return labels.length > 0 ? `Rute ${labels.join(" + ")}` : "Rute baru";
}

function countStops(route: Pick<RouteRecord, "groups">): number {
  return route.groups.reduce((total, group) => total + group.stops.length, 0);
}

/** Status mengikuti progres: semua selesai = completed, sebagian = active. */
function resolveStatus(route: RouteRecord): RouteStatus {
  const stops = route.groups.flatMap((group) => group.stops);
  if (stops.length === 0) return route.status === "completed" ? "completed" : "draft";
  if (stops.every((stop) => stop.completedAt !== null)) return "completed";
  if (stops.some((stop) => stop.completedAt !== null)) return "active";
  return route.status === "completed" ? "active" : route.status;
}

function touchRoute(route: RouteRecord): RouteRecord {
  const status = resolveStatus(route);

  return {
    ...route,
    status,
    completedAt: status === "completed" ? (route.completedAt ?? nowIso()) : null,
    updatedAt: nowIso(),
  };
}

function validateOrThrow<TResult>(
  schema: { safeParse: (value: unknown) => { success: boolean; data?: TResult; error?: unknown } },
  payload: unknown,
): TResult {
  const result = schema.safeParse(payload);

  if (!result.success || result.data === undefined) {
    const zodError = result.error as { issues?: Array<{ path?: Array<string | number>; message: string }> };
    const fieldErrors = (zodError.issues ?? []).map((issue) => ({
      field: (issue.path ?? []).join(".") || "payload",
      message: issue.message,
    }));

    throw new ApiError(400, "Payload tidak valid", fieldErrors);
  }

  return result.data;
}

interface MutationContext {
  database: LocalDatabaseShape;
  route: RouteRecord;
}

function runMutation(
  routeId: string,
  mutate: (context: MutationContext) => void,
): RouteRecord {
  const database = readDatabase();
  const routeIndex = database.routes.findIndex((route) => route.id === routeId);

  if (routeIndex === -1) {
    throw new ApiError(404, "Rute tidak ditemukan");
  }

  const route = database.routes[routeIndex];
  if (!route) throw new ApiError(404, "Rute tidak ditemukan");

  mutate({ database, route });

  // Simpan versi yang sudah di-touch supaya status & completedAt ikut terbarui.
  const savedRoute = touchRoute(route);
  database.routes[routeIndex] = savedRoute;
  writeDatabase(database);

  return savedRoute;
}

function requireGroup(route: RouteRecord, groupId: string): RouteGroup {
  const group = route.groups.find((item) => item.id === groupId);
  if (!group) throw new ApiError(404, "Grup rute tidak ditemukan");

  return group;
}

export function listRoutes(): RouteRecord[] {
  return [...readDatabase().routes].sort((first, second) =>
    second.updatedAt.localeCompare(first.updatedAt),
  );
}

export function getRouteById(routeId: string): RouteRecord | null {
  return readDatabase().routes.find((route) => route.id === routeId) ?? null;
}

export function createRoute(payload: CreateRoutePayload): RouteRecord {
  const parsedPayload = validateOrThrow(createRouteSchema, payload);
  const database = readDatabase();
  const timestamp = nowIso();

  const groups: RouteGroup[] = parsedPayload.groups.map((groupInput) => ({
    id: createId(GROUP_ID_PREFIX),
    provider: groupInput.provider,
    name: groupInput.name?.trim() || defaultGroupName(groupInput.provider, []),
    stops: groupInput.stops.map((stopInput, index) => ({
      id: createId(STOP_ID_PREFIX),
      sequence: index + 1,
      label: stopInput.label,
      address: stopInput.address,
      latitude: stopInput.latitude,
      longitude: stopInput.longitude,
      note: stopInput.note,
      completedAt: null,
    })),
  }));

  const route: RouteRecord = {
    id: createId(ROUTE_ID_PREFIX),
    name: parsedPayload.name?.trim() || defaultRouteName(groups),
    status: "draft",
    startPoint: parsedPayload.startPoint ?? null,
    groups,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
  };

  database.routes.push(route);
  writeDatabase(database);

  return route;
}

export function updateRoute(routeId: string, payload: UpdateRoutePayload): RouteRecord {
  const parsedPayload = validateOrThrow(updateRouteSchema, payload);

  return runMutation(routeId, ({ route }) => {
    if (parsedPayload.name !== undefined) {
      const trimmedName = parsedPayload.name.trim();
      if (trimmedName.length === 0) throw new ApiError(400, "Nama rute tidak boleh kosong");
      route.name = trimmedName;
    }

    if (parsedPayload.startPoint !== undefined) {
      route.startPoint = parsedPayload.startPoint;
    }

    if (parsedPayload.status !== undefined) {
      route.status = parsedPayload.status;
    }

    if (parsedPayload.groups) {
      const totalStops = parsedPayload.groups.reduce(
        (total, group) => total + group.stops.length,
        0,
      );

      if (parsedPayload.groups.length > MAX_GROUPS_PER_ROUTE) {
        throw new ApiError(422, `Maksimal ${MAX_GROUPS_PER_ROUTE} grup per rute`);
      }

      if (totalStops > MAX_STOPS_PER_ROUTE) {
        throw new ApiError(422, `Total titik maksimal ${MAX_STOPS_PER_ROUTE} per rute`);
      }

      route.groups = parsedPayload.groups.map((groupInput) => ({
        id: createId(GROUP_ID_PREFIX),
        provider: groupInput.provider,
        name: groupInput.name?.trim() || defaultGroupName(groupInput.provider, []),
        stops: resequenceStops(
          groupInput.stops.map((stopInput) => ({
            id: createId(STOP_ID_PREFIX),
            sequence: 0,
            label: stopInput.label,
            address: stopInput.address,
            latitude: stopInput.latitude,
            longitude: stopInput.longitude,
            note: stopInput.note,
            completedAt: null,
          })),
        ),
      }));
    }
  });
}

export function deleteRoute(routeId: string): { id: string } {
  const database = readDatabase();
  const routeIndex = database.routes.findIndex((route) => route.id === routeId);

  if (routeIndex === -1) throw new ApiError(404, "Rute tidak ditemukan");

  database.routes.splice(routeIndex, 1);
  writeDatabase(database);

  return { id: routeId };
}

export function addGroup(
  routeId: string,
  payload: { provider: ProviderId; name?: string; stops: Array<Record<string, unknown>> },
): RouteRecord {
  const parsedPayload = validateOrThrow(addGroupSchema, payload);

  return runMutation(routeId, ({ database, route }) => {
    if (route.groups.length >= MAX_GROUPS_PER_ROUTE) {
      throw new ApiError(422, `Maksimal ${MAX_GROUPS_PER_ROUTE} grup per rute`);
    }

    if (countStops(route) + parsedPayload.stops.length > MAX_STOPS_PER_ROUTE) {
      throw new ApiError(422, `Total titik maksimal ${MAX_STOPS_PER_ROUTE} per rute`);
    }

    const group: RouteGroup = {
      id: createId(GROUP_ID_PREFIX),
      provider: parsedPayload.provider,
      name:
        parsedPayload.name?.trim() || defaultGroupName(parsedPayload.provider, route.groups),
      stops: resequenceStops(
        parsedPayload.stops.map((stopInput) => ({
          id: createId(STOP_ID_PREFIX),
          sequence: 0,
          label: stopInput.label,
          address: stopInput.address,
          latitude: stopInput.latitude,
          longitude: stopInput.longitude,
          note: stopInput.note,
          completedAt: null,
        })),
      ),
    };

    route.groups.push(group);
    const routeIndex = database.routes.findIndex((item) => item.id === routeId);
    database.routes[routeIndex] = route;

    return route;
  });
}

export function updateGroup(
  routeId: string,
  groupId: string,
  payload: { name?: string; provider?: ProviderId },
): RouteRecord {
  return runMutation(routeId, ({ database, route }) => {
    const group = requireGroup(route, groupId);

    if (payload.name !== undefined) {
      const trimmedName = payload.name.trim();
      if (trimmedName.length === 0) throw new ApiError(400, "Nama grup tidak boleh kosong");
      group.name = trimmedName;
    }

    if (payload.provider) {
      group.provider = payload.provider;
    }

    const routeIndex = database.routes.findIndex((item) => item.id === routeId);
    database.routes[routeIndex] = route;

    return route;
  });
}

export function removeGroup(routeId: string, groupId: string): RouteRecord {
  return runMutation(routeId, ({ database, route }) => {
    if (route.groups.length <= 1) {
      throw new ApiError(422, "Rute harus punya minimal satu grup. Hapus rutenya kalau mau membuang semua.");
    }

    const groupIndex = route.groups.findIndex((group) => group.id === groupId);
    if (groupIndex === -1) throw new ApiError(404, "Grup rute tidak ditemukan");

    route.groups.splice(groupIndex, 1);
    const routeIndex = database.routes.findIndex((item) => item.id === routeId);
    database.routes[routeIndex] = route;

    return route;
  });
}

export function addStop(
  routeId: string,
  groupId: string,
  payload: Record<string, unknown>,
  insertAtPosition?: number,
): RouteRecord {
  const parsedPayload = validateOrThrow(addStopSchema, payload);

  return runMutation(routeId, ({ database, route }) => {
    const group = requireGroup(route, groupId);

    if (group.stops.length >= MAX_STOPS_PER_GROUP) {
      throw new ApiError(422, `Maksimal ${MAX_STOPS_PER_GROUP} titik per grup`);
    }

    if (countStops(route) + 1 > MAX_STOPS_PER_ROUTE) {
      throw new ApiError(422, `Total titik maksimal ${MAX_STOPS_PER_ROUTE} per rute`);
    }

    const newStop: RouteStop = {
      id: createId(STOP_ID_PREFIX),
      sequence: group.stops.length + 1,
      label: parsedPayload.label,
      address: parsedPayload.address,
      latitude: parsedPayload.latitude,
      longitude: parsedPayload.longitude,
      note: parsedPayload.note,
      completedAt: null,
    };

    const insertIndex =
      insertAtPosition === undefined
        ? group.stops.length
        : Math.min(Math.max(insertAtPosition, 0), group.stops.length);

    group.stops.splice(insertIndex, 0, newStop);
    group.stops = resequenceStops(group.stops);

    const routeIndex = database.routes.findIndex((item) => item.id === routeId);
    database.routes[routeIndex] = route;

    return route;
  });
}

export function updateStop(
  routeId: string,
  groupId: string,
  stopId: string,
  payload: Record<string, unknown>,
): RouteRecord {
  const parsedPayload = validateOrThrow(updateStopSchema, payload);

  return runMutation(routeId, ({ database, route }) => {
    const group = requireGroup(route, groupId);
    const stop = group.stops.find((item) => item.id === stopId);

    if (!stop) throw new ApiError(404, "Titik tidak ditemukan");

    group.stops = group.stops.map((item) =>
      item.id === stopId ? { ...item, ...parsedPayload } : item,
    );

    const routeIndex = database.routes.findIndex((item) => item.id === routeId);
    database.routes[routeIndex] = route;

    return route;
  });
}

export function removeStop(routeId: string, groupId: string, stopId: string): RouteRecord {
  return runMutation(routeId, ({ database, route }) => {
    const group = requireGroup(route, groupId);

    if (group.stops.length <= 1) {
      throw new ApiError(422, "Grup harus punya minimal satu titik");
    }

    const stopIndex = group.stops.findIndex((stop) => stop.id === stopId);
    if (stopIndex === -1) throw new ApiError(404, "Titik tidak ditemukan");

    group.stops.splice(stopIndex, 1);
    group.stops = resequenceStops(group.stops);

    const routeIndex = database.routes.findIndex((item) => item.id === routeId);
    database.routes[routeIndex] = route;

    return route;
  });
}

export function toggleStopComplete(
  routeId: string,
  groupId: string,
  stopId: string,
): RouteRecord {
  return runMutation(routeId, ({ database, route }) => {
    const group = requireGroup(route, groupId);
    const stop = group.stops.find((item) => item.id === stopId);

    if (!stop) throw new ApiError(404, "Titik tidak ditemukan");

    group.stops = group.stops.map((item) =>
      item.id === stopId
        ? { ...item, completedAt: item.completedAt === null ? nowIso() : null }
        : item,
    );

    const routeIndex = database.routes.findIndex((item) => item.id === routeId);
    database.routes[routeIndex] = route;

    return route;
  });
}

export function reorderStops(
  routeId: string,
  groupId: string,
  stopIds: string[],
): RouteRecord {
  const parsedPayload = validateOrThrow(reorderStopsSchema, { stopIds });

  return runMutation(routeId, ({ database, route }) => {
    const group = requireGroup(route, groupId);

    if (parsedPayload.stopIds.length !== group.stops.length) {
      throw new ApiError(422, "Jumlah titik pada payload tidak sama dengan data grup");
    }

    const stopsById = new Map(group.stops.map((stop) => [stop.id, stop]));
    const reorderedStops = parsedPayload.stopIds.map((stopId) => {
      const stop = stopsById.get(stopId);
      if (!stop) throw new ApiError(422, `Titik ${stopId} bukan bagian dari grup ini`);
      return stop;
    });

    group.stops = resequenceStops(reorderedStops);

    const routeIndex = database.routes.findIndex((item) => item.id === routeId);
    database.routes[routeIndex] = route;

    return route;
  });
}
