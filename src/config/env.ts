/**
 * Konfigurasi environment. Semua akses import.meta.env dibungkus di sini
 * supaya komponen tidak membaca env langsung dan gampang di-mock saat test.
 */

const rawGoogleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? "";
const rawOsrmBaseUrl = import.meta.env.VITE_OSRM_BASE_URL?.trim() ?? "";
const rawNominatimBaseUrl = import.meta.env.VITE_NOMINATIM_BASE_URL?.trim() ?? "";
const rawAppName = import.meta.env.VITE_APP_NAME?.trim() ?? "";

export const env = {
  appName: rawAppName || "Rute Ojol",
  googleMapsApiKey: rawGoogleMapsApiKey,
  osrmBaseUrl: (rawOsrmBaseUrl || "https://router.project-osrm.org").replace(/\/+$/, ""),
  nominatimBaseUrl: (rawNominatimBaseUrl || "https://nominatim.openstreetmap.org").replace(
    /\/+$/,
    "",
  ),
  /** Google dipakai kalau key tersedia; kalau tidak, OSRM (tetap jarak jalan asli). */
  isGoogleEnabled: rawGoogleMapsApiKey.length > 0,
} as const;

export type AppEnv = typeof env;
