import { create } from "zustand";
import { ApiError } from "@/services/api/apiError";
import { routesApi } from "@/services/api/routes.api";
import type { ProviderId, RoutePlan, RouteRecord } from "@/types/route.types";
import type { CreateRoutePayload, UpdateRoutePayload } from "@/utils/validators";

interface RoutesState {
  routes: RouteRecord[];
  currentRoute: RouteRecord | null;
  plan: RoutePlan | null;
  isLoadingList: boolean;
  isLoadingRoute: boolean;
  isPlanning: boolean;
  isSaving: boolean;
  errorMessage: string | null;

  loadRoutes: () => Promise<void>;
  loadRoute: (routeId: string) => Promise<void>;
  loadPlan: (routeId: string) => Promise<void>;
  clearCurrentRoute: () => void;
  clearError: () => void;

  createRoute: (payload: CreateRoutePayload) => Promise<RouteRecord>;
  updateRoute: (routeId: string, payload: UpdateRoutePayload) => Promise<RouteRecord>;
  deleteRoute: (routeId: string) => Promise<void>;

  addGroup: (
    routeId: string,
    payload: { provider: ProviderId; name?: string; stops: Record<string, unknown>[] },
  ) => Promise<RouteRecord>;
  updateGroup: (
    routeId: string,
    groupId: string,
    payload: { name?: string; provider?: ProviderId },
  ) => Promise<RouteRecord>;
  removeGroup: (routeId: string, groupId: string) => Promise<RouteRecord>;

  addStop: (
    routeId: string,
    groupId: string,
    payload: Record<string, unknown>,
    insertAtPosition?: number,
  ) => Promise<RouteRecord>;
  removeStop: (routeId: string, groupId: string, stopId: string) => Promise<RouteRecord>;
  toggleStopComplete: (routeId: string, groupId: string, stopId: string) => Promise<RouteRecord>;
  reorderStops: (routeId: string, groupId: string, stopIds: string[]) => Promise<RouteRecord>;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const detail = error.fieldErrors.map((fieldError) => fieldError.message).join(", ");
    return detail ? `${error.message}: ${detail}` : error.message;
  }

  if (error instanceof Error) return error.message;

  return "Terjadi kesalahan yang tidak diketahui";
}

export const useRoutesStore = create<RoutesState>((set, get) => ({
  routes: [],
  currentRoute: null,
  plan: null,
  isLoadingList: false,
  isLoadingRoute: false,
  isPlanning: false,
  isSaving: false,
  errorMessage: null,

  clearError: () => set({ errorMessage: null }),

  clearCurrentRoute: () => set({ currentRoute: null, plan: null, errorMessage: null }),

  async loadRoutes() {
    set({ isLoadingList: true, errorMessage: null });

    try {
      const response = await routesApi.list();
      set({ routes: response.data });
    } catch (error) {
      set({ errorMessage: toErrorMessage(error) });
    } finally {
      set({ isLoadingList: false });
    }
  },

  async loadRoute(routeId) {
    set({ isLoadingRoute: true, errorMessage: null, plan: null });

    try {
      const response = await routesApi.get(routeId);
      set({ currentRoute: response.data });
    } catch (error) {
      set({ currentRoute: null, errorMessage: toErrorMessage(error) });
    } finally {
      set({ isLoadingRoute: false });
    }
  },

  async loadPlan(routeId) {
    const route = get().currentRoute;
    if (!route || route.id !== routeId) return;

    set({ isPlanning: true, errorMessage: null });

    try {
      const response = await routesApi.plan(routeId);
      set({ plan: response.data });
    } catch (error) {
      set({ plan: null, errorMessage: toErrorMessage(error) });
    } finally {
      set({ isPlanning: false });
    }
  },

  async createRoute(payload) {
    set({ isSaving: true, errorMessage: null });

    try {
      const response = await routesApi.create(payload);
      set((state) => ({ routes: [response.data, ...state.routes] }));
      return response.data;
    } catch (error) {
      set({ errorMessage: toErrorMessage(error) });
      throw error;
    } finally {
      set({ isSaving: false });
    }
  },

  async updateRoute(routeId, payload) {
    set({ isSaving: true, errorMessage: null });

    try {
      const response = await routesApi.update(routeId, payload);
      set((state) => ({
        currentRoute: response.data,
        routes: state.routes.map((route) =>
          route.id === routeId ? response.data : route,
        ),
        plan: null,
      }));
      return response.data;
    } catch (error) {
      set({ errorMessage: toErrorMessage(error) });
      throw error;
    } finally {
      set({ isSaving: false });
    }
  },

  async deleteRoute(routeId) {
    set({ isSaving: true, errorMessage: null });

    try {
      await routesApi.remove(routeId);
      set((state) => ({
        routes: state.routes.filter((route) => route.id !== routeId),
        currentRoute: state.currentRoute?.id === routeId ? null : state.currentRoute,
        plan: null,
      }));
    } catch (error) {
      set({ errorMessage: toErrorMessage(error) });
      throw error;
    } finally {
      set({ isSaving: false });
    }
  },

  async addGroup(routeId, payload) {
    return runRouteMutation(() => routesApi.addGroup(routeId, payload));
  },

  async updateGroup(routeId, groupId, payload) {
    return runRouteMutation(() => routesApi.updateGroup(routeId, groupId, payload));
  },

  async removeGroup(routeId, groupId) {
    return runRouteMutation(() => routesApi.removeGroup(routeId, groupId));
  },

  async addStop(routeId, groupId, payload, insertAtPosition) {
    return runRouteMutation(() => routesApi.addStop(routeId, groupId, payload, insertAtPosition));
  },

  async removeStop(routeId, groupId, stopId) {
    return runRouteMutation(() => routesApi.removeStop(routeId, groupId, stopId));
  },

  async toggleStopComplete(routeId, groupId, stopId) {
    return runRouteMutation(() => routesApi.toggleStopComplete(routeId, groupId, stopId));
  },

  async reorderStops(routeId, groupId, stopIds) {
    return runRouteMutation(() => routesApi.reorderStops(routeId, groupId, stopIds));
  },
}));

/** Semua mutasi rute punya pola sama: simpan, perbarui cache, reset rencana. */
async function runRouteMutation(
  request: () => Promise<{ data: RouteRecord }>,
): Promise<RouteRecord> {
  useRoutesStore.setState({ isSaving: true, errorMessage: null });

  try {
    const response = await request();

    useRoutesStore.setState((state) => ({
      currentRoute: response.data,
      routes: state.routes.map((item) =>
        item.id === response.data.id ? response.data : item,
      ),
      plan: null,
      isSaving: false,
    }));

    return response.data;
  } catch (error) {
    useRoutesStore.setState({ errorMessage: toErrorMessage(error), isSaving: false });
    throw error;
  }
}
