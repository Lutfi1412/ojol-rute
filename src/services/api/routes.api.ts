import { API_LATENCY_MS } from "@/constants/api";
import { buildRoutePlan } from "@/services/routing/routing.service";
import type { ApiSuccess } from "@/types/api.types";
import type { ProviderId, RoutePlan, RouteRecord } from "@/types/route.types";
import type { CreateRoutePayload, UpdateRoutePayload } from "@/utils/validators";
import { ApiError } from "./apiError";
import {
  addGroup as addGroupRecord,
  addStop as addStopRecord,
  createRoute as createRouteRecord,
  deleteRoute as deleteRouteRecord,
  getRouteById,
  listRoutes,
  removeGroup as removeGroupRecord,
  removeStop as removeStopRecord,
  reorderStops as reorderStopsRecord,
  toggleStopComplete,
  updateGroup as updateGroupRecord,
  updateRoute as updateRouteRecord,
  updateStop as updateStopRecord,
} from "./routes.repository";

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function success<TData>(
  data: TData,
  message: string,
  statusCode = 200,
): ApiSuccess<TData> {
  return { success: true, statusCode, message, data };
}

function requireRoute(routeId: string): RouteRecord {
  const route = getRouteById(routeId);

  if (!route) {
    throw new ApiError(404, "Rute tidak ditemukan");
  }

  return route;
}

/**
 * Lapisan API. Nama fungsi, bentuk payload, dan bentuk respons sengaja
 * menyerupai REST (lihat README bagian "Kontrak API"), jadi saat backend
 * sungguhan siap, cukup ganti implementasi di file ini.
 */
export const routesApi = {
  async list(): Promise<ApiSuccess<RouteRecord[]>> {
    await wait(API_LATENCY_MS.read);
    return success(listRoutes(), "Daftar rute berhasil diambil");
  },

  async get(routeId: string): Promise<ApiSuccess<RouteRecord>> {
    await wait(API_LATENCY_MS.read);
    return success(requireRoute(routeId), "Rute berhasil diambil");
  },

  async create(payload: CreateRoutePayload): Promise<ApiSuccess<RouteRecord>> {
    await wait(API_LATENCY_MS.write);
    const route = createRouteRecord(payload);
    return success(route, "Rute berhasil dibuat", 201);
  },

  async update(routeId: string, payload: UpdateRoutePayload): Promise<ApiSuccess<RouteRecord>> {
    await wait(API_LATENCY_MS.write);
    const route = updateRouteRecord(routeId, payload);
    return success(route, "Rute berhasil diperbarui");
  },

  async remove(routeId: string): Promise<ApiSuccess<{ id: string }>> {
    await wait(API_LATENCY_MS.write);
    return success(deleteRouteRecord(routeId), "Rute berhasil dihapus");
  },

  async addGroup(
    routeId: string,
    payload: { provider: ProviderId; name?: string; stops: Record<string, unknown>[] },
  ): Promise<ApiSuccess<RouteRecord>> {
    await wait(API_LATENCY_MS.write);
    return success(addGroupRecord(routeId, payload), "Grup berhasil ditambahkan", 201);
  },

  async updateGroup(
    routeId: string,
    groupId: string,
    payload: { name?: string; provider?: ProviderId },
  ): Promise<ApiSuccess<RouteRecord>> {
    await wait(API_LATENCY_MS.write);
    return success(updateGroupRecord(routeId, groupId, payload), "Grup berhasil diperbarui");
  },

  async removeGroup(routeId: string, groupId: string): Promise<ApiSuccess<RouteRecord>> {
    await wait(API_LATENCY_MS.write);
    return success(removeGroupRecord(routeId, groupId), "Grup berhasil dihapus");
  },

  async addStop(
    routeId: string,
    groupId: string,
    payload: Record<string, unknown>,
    insertAtPosition?: number,
  ): Promise<ApiSuccess<RouteRecord>> {
    await wait(API_LATENCY_MS.write);
    return success(
      addStopRecord(routeId, groupId, payload, insertAtPosition),
      "Titik berhasil ditambahkan",
      201,
    );
  },

  async updateStop(
    routeId: string,
    groupId: string,
    stopId: string,
    payload: Record<string, unknown>,
  ): Promise<ApiSuccess<RouteRecord>> {
    await wait(API_LATENCY_MS.write);
    return success(updateStopRecord(routeId, groupId, stopId, payload), "Titik berhasil diperbarui");
  },

  async removeStop(
    routeId: string,
    groupId: string,
    stopId: string,
  ): Promise<ApiSuccess<RouteRecord>> {
    await wait(API_LATENCY_MS.write);
    return success(removeStopRecord(routeId, groupId, stopId), "Titik berhasil dihapus");
  },

  async toggleStopComplete(
    routeId: string,
    groupId: string,
    stopId: string,
  ): Promise<ApiSuccess<RouteRecord>> {
    await wait(API_LATENCY_MS.write);
    return success(toggleStopComplete(routeId, groupId, stopId), "Status titik diperbarui");
  },

  async reorderStops(
    routeId: string,
    groupId: string,
    stopIds: string[],
  ): Promise<ApiSuccess<RouteRecord>> {
    await wait(API_LATENCY_MS.write);
    return success(reorderStopsRecord(routeId, groupId, stopIds), "Urutan titik diperbarui");
  },

  /** Endpoint khusus: hitung rencana rute (urutan selang-seling + jarak nyata). */
  async plan(routeId: string): Promise<ApiSuccess<RoutePlan>> {
    const route = requireRoute(routeId);
    const plan = await buildRoutePlan(route);

    return success(plan, "Rencana rute berhasil dihitung");
  },
};
