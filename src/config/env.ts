/**
 * Konfigurasi environment. Semua akses import.meta.env dibungkus di sini
 * supaya komponen tidak membaca env langsung dan gampang di-mock saat test.
 */

const rawGoogleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? "";
const rawOsrmBaseUrl = import.meta.env.VITE_OSRM_BASE_URL?.trim() ?? "";
const rawNominatimBaseUrl = import.meta.env.VITE_NOMINATIM_BASE_URL?.trim() ?? "";
const rawAppName = import.meta.env.VITE_APP_NAME?.trim() ?? "";
const rawPhotonBaseUrl = import.meta.env.VITE_PHOTON_BASE_URL?.trim() ?? "";
const rawMapTileUrl = import.meta.env.VITE_MAP_TILE_URL?.trim() ?? "";
const rawMapTileAttribution = import.meta.env.VITE_MAP_TILE_ATTRIBUTION?.trim() ?? "";
const rawMaptilerKey = import.meta.env.VITE_MAPTILER_KEY?.trim() ?? "";
const rawLocationIqKey = import.meta.env.VITE_LOCATIONIQ_KEY?.trim() ?? "";

export const env = {
  appName: rawAppName || "Rute Ojol",
  googleMapsApiKey: rawGoogleMapsApiKey,
  locationIqKey: rawLocationIqKey,
  maptilerKey: rawMaptilerKey,
  osrmBaseUrl: (rawOsrmBaseUrl || "https://router.project-osrm.org").replace(/\/+$/, ""),
  nominatimBaseUrl: (rawNominatimBaseUrl || "https://nominatim.openstreetmap.org").replace(
    /\/+$/,
    "",
  ),
  /** Pencarian lokasi berbasis OSM yang jauh lebih pintar dari Nominatim. */
  photonBaseUrl: (rawPhotonBaseUrl || "https://photon.komoot.io").replace(/\/+$/, ""),
  /**
   * Tile peta. Prioritas: VITE_MAPTILER_KEY → VITE_MAP_TILE_URL → CARTO bawaan.
   * MapTiler butuh key gratis; tanpa key aplikasi tetap jalan pakai CARTO.
   */
  mapTileUrl:
    rawMaptilerKey.length > 0
      ? `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${rawMaptilerKey}`
      : rawMapTileUrl ||
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  mapTileAttribution:
    rawMapTileAttribution ||
    (rawMaptilerKey.length > 0
      ? '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'),
  /** Google dipakai kalau key tersedia; kalau tidak, OSRM (tetap jarak jalan asli). */
  isGoogleEnabled: rawGoogleMapsApiKey.length > 0,
} as const;

export type AppEnv = typeof env;
