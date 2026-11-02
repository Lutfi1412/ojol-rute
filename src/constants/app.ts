import type { ProviderId, RouteStatus } from "@/types/route.types";

export interface ProviderMeta {
  id: ProviderId;
  label: string;
  shortLabel: string;
  description: string;
  /** Warna hex untuk marker/peta (harus sama dengan CSS var di index.css). */
  color: string;
  softColor: string;
}

export const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  grab: {
    id: "grab",
    label: "Grab",
    shortLabel: "G",
    description: "Order dari aplikasi Grab",
    color: "#00b14f",
    softColor: "#e8f8ee",
  },
  shopee: {
    id: "shopee",
    label: "Shopee",
    shortLabel: "S",
    description: "Order dari aplikasi Shopee",
    color: "#ee4d2d",
    softColor: "#fdecea",
  },
};

export const PROVIDER_LIST: ProviderMeta[] = [PROVIDERS.grab, PROVIDERS.shopee];

export const ROUTE_STATUS_LABEL: Record<RouteStatus, string> = {
  draft: "Draft",
  active: "Berjalan",
  completed: "Selesai",
};

/** Batas aman: Directions API Google hanya menerima 25 waypoint per request. */
export const MAX_STOPS_PER_ROUTE = 25;
export const MAX_STOPS_PER_GROUP = 15;
export const MAX_GROUPS_PER_ROUTE = 3;

/** Jeda debounce pencarian alamat (ms) — Nominatim membatasi 1 request/detik. */
export const PLACE_SEARCH_DEBOUNCE_MS = 600;
export const PLACE_SEARCH_MIN_CHARS = 3;

/** Dianggap "searah" bila penghematan minimal sekian meter. */
export const MEANINGFUL_SAVING_METERS = 300;
