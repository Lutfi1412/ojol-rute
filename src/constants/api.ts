/**
 * Daftar endpoint yang dipakai aplikasi. Saat ini semuanya dilayani lapisan
 * "API palsu" di atas localStorage (src/services/api), tapi path-nya sengaja
 * ditulis seperti REST supaya tinggal dialihkan ke backend nyata.
 */
export const API_ROUTES = {
  list: "/routes",
  detail: (routeId: string) => `/routes/${routeId}`,
  create: "/routes",
  update: (routeId: string) => `/routes/${routeId}`,
  remove: (routeId: string) => `/routes/${routeId}`,
  plan: (routeId: string) => `/routes/${routeId}/plan`,
  addGroup: (routeId: string) => `/routes/${routeId}/groups`,
  updateGroup: (routeId: string, groupId: string) => `/routes/${routeId}/groups/${groupId}`,
  removeGroup: (routeId: string, groupId: string) => `/routes/${routeId}/groups/${groupId}`,
  addStop: (routeId: string, groupId: string) => `/routes/${routeId}/groups/${groupId}/stops`,
  updateStop: (routeId: string, groupId: string, stopId: string) =>
    `/routes/${routeId}/groups/${groupId}/stops/${stopId}`,
  removeStop: (routeId: string, groupId: string, stopId: string) =>
    `/routes/${routeId}/groups/${groupId}/stops/${stopId}`,
  toggleStopComplete: (routeId: string, groupId: string, stopId: string) =>
    `/routes/${routeId}/groups/${groupId}/stops/${stopId}/complete`,
  reorderStops: (routeId: string, groupId: string) =>
    `/routes/${routeId}/groups/${groupId}/stops/reorder`,
  placesSearch: "/places/search",
} as const;

export const API_LATENCY_MS = {
  read: 120,
  write: 220,
} as const;
