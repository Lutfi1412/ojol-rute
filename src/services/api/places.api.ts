import { env } from "@/config/env";
import type { ApiSuccess, PlaceSearchResult } from "@/types/api.types";
import { ApiError } from "./apiError";

const SEARCH_RESULT_LIMIT = 8;
const CANDIDATE_LIMIT = 20;
const REQUEST_TIMEOUT_MS = 12_000;

async function fetchJson<TResponse>(url: string): Promise<TResponse> {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: abortController.signal,
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new ApiError(502, `Pencarian lokasi gagal (HTTP ${response.status})`);
    }

    return (await response.json()) as TResponse;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(504, "Pencarian lokasi tidak merespons. Coba lagi sebentar.");
  } finally {
    clearTimeout(timeoutId);
  }
}

function isCoordinate(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  );
}

/** Buang hasil ganda (nama + titik hampir sama) lalu potong ke batas tampil. */
function finalizeResults(results: PlaceSearchResult[]): PlaceSearchResult[] {
  const seen = new Set<string>();
  const unique: PlaceSearchResult[] = [];

  for (const result of results) {
    if (!isCoordinate(result.latitude, result.longitude)) continue;

    const key = `${result.label.toLowerCase()}|${result.latitude.toFixed(3)}|${result.longitude.toFixed(3)}`;
    if (seen.has(key)) continue;

    seen.add(key);
    unique.push(result);

    if (unique.length >= SEARCH_RESULT_LIMIT) break;
  }

  return unique;
}

/* ------------------------------------------------------------------ */
/* 1. Google Places (paling akurat untuk Indonesia, butuh API key)     */
/* ------------------------------------------------------------------ */

interface GoogleAutocompleteResponse {
  status: string;
  error_message?: string;
  predictions?: Array<{
    place_id: string;
    description: string;
    structured_formatting?: { main_text?: string; secondary_text?: string };
  }>;
}

interface GooglePlaceDetailsResponse {
  status: string;
  result?: {
    geometry?: { location?: { lat: number; lng: number } };
    formatted_address?: string;
    name?: string;
  };
}

async function searchWithGoogle(query: string): Promise<PlaceSearchResult[]> {
  const url =
    "https://maps.googleapis.com/maps/api/place/autocomplete/json" +
    `?input=${encodeURIComponent(query)}` +
    "&components=country:id&language=id" +
    `&key=${env.googleMapsApiKey}`;

  const payload = await fetchJson<GoogleAutocompleteResponse>(url);

  if (payload.status !== "OK" && payload.status !== "ZERO_RESULTS") {
    throw new ApiError(502, `Google Places gagal: ${payload.error_message ?? payload.status}`);
  }

  const predictions = (payload.predictions ?? []).slice(0, SEARCH_RESULT_LIMIT);

  const results = await Promise.all(
    predictions.map(async (prediction) => {
      const detailsUrl =
        "https://maps.googleapis.com/maps/api/place/details/json" +
        `?place_id=${encodeURIComponent(prediction.place_id)}` +
        "&fields=geometry,formatted_address,name&language=id" +
        `&key=${env.googleMapsApiKey}`;

      const details = await fetchJson<GooglePlaceDetailsResponse>(detailsUrl);
      const location = details.result?.geometry?.location;

      if (!location) return null;

      return {
        placeId: prediction.place_id,
        label: details.result?.name ?? prediction.structured_formatting?.main_text ?? "",
        address: details.result?.formatted_address ?? prediction.description,
        latitude: location.lat,
        longitude: location.lng,
      } satisfies PlaceSearchResult;
    }),
  );

  return finalizeResults(results.filter((item): item is PlaceSearchResult => item !== null));
}

/* ------------------------------------------------------------------ */
/* 2. LocationIQ autocomplete (gratis 5.000 request/hari)              */
/* ------------------------------------------------------------------ */

interface LocationIqItem {
  place_id?: string;
  display_name?: string;
  display_place?: string;
  display_address?: string;
  lat?: string;
  lon?: string;
}

async function searchWithLocationIq(query: string): Promise<PlaceSearchResult[]> {
  const url =
    `https://api.locationiq.com/v1/autocomplete?key=${env.locationIqKey}` +
    `&q=${encodeURIComponent(query)}&countrycodes=id&limit=${CANDIDATE_LIMIT}` +
    "&dedupe=1&addressdetails=1&normalizecity=1&format=json";

  const payload = await fetchJson<LocationIqItem[]>(url);

  const results = payload.map((item) => ({
    placeId: `locationiq-${item.place_id ?? item.display_name ?? query}`,
    label: item.display_place?.trim() || item.display_name?.split(",")[0]?.trim() || "Lokasi",
    address: item.display_address?.trim() || item.display_name?.trim() || "",
    latitude: Number(item.lat),
    longitude: Number(item.lon),
  }));

  return finalizeResults(results);
}

/* ------------------------------------------------------------------ */
/* 3. MapTiler Geocoding (satu key untuk peta + pencarian)             */
/* ------------------------------------------------------------------ */

interface MaptilerFeature {
  text?: string;
  place_name?: string;
  center?: [number, number];
  geometry?: { coordinates?: [number, number] };
  properties?: { name?: string; address?: string };
}

async function searchWithMaptiler(query: string): Promise<PlaceSearchResult[]> {
  const url =
    `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json` +
    `?key=${env.maptilerKey}&country=id&limit=${CANDIDATE_LIMIT}&language=id`;

  const payload = await fetchJson<{ features?: MaptilerFeature[] }>(url);

  const results = (payload.features ?? []).map((feature) => {
    const coordinates = feature.geometry?.coordinates ?? feature.center ?? [0, 0];
    const label = feature.properties?.name ?? feature.text ?? feature.place_name ?? "Lokasi";

    return {
      placeId: `maptiler-${label}-${coordinates[0]}-${coordinates[1]}`,
      label,
      address: feature.place_name ?? feature.properties?.address ?? "",
      latitude: coordinates[1],
      longitude: coordinates[0],
    };
  });

  return finalizeResults(results);
}

/* ------------------------------------------------------------------ */
/* 4. OpenStreetMap tanpa key: Photon + Nominatim digabung & diurutkan */
/* ------------------------------------------------------------------ */

interface OsmCandidate {
  result: PlaceSearchResult;
  score: number;
}

/** Bounding box Indonesia, supaya hasil tidak melompat ke luar negeri. */
const INDONESIA_BBOX = "94.9,-11.1,141.1,6.2";

/** Kategori yang biasanya jadi tujuan kiriman, bukan nama desa/kecamatan. */
const DESTINATION_OSM_KEYS = new Set([
  "amenity",
  "shop",
  "tourism",
  "leisure",
  "highway",
  "railway",
  "building",
  "office",
  "historic",
  "man_made",
  "craft",
  "healthcare",
]);

/**
 * Nama yang persis/berawalan sama dengan kata kunci dapat nilai lebih besar.
 * `maxScore` dipakai untuk menahan kategori yang gampang "menang" hanya karena
 * namanya mirip, misal nama jalan.
 */
function scoreByName(name: string, normalizedQuery: string, maxScore = 6): number {
  const normalizedName = name.trim().toLowerCase();
  const score = (() => {
    if (normalizedName === normalizedQuery) return 6;
    if (normalizedName.startsWith(normalizedQuery)) return 4;
    if (normalizedName.includes(normalizedQuery)) return 2;
    return 0;
  })();

  return Math.min(score, maxScore);
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id?: number;
    osm_type?: string;
    osm_key?: string;
    osm_value?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    county?: string;
    district?: string;
    state?: string;
    countrycode?: string;
  };
}

function buildPhotonLabel(properties: PhotonFeature["properties"]): string {
  if (properties.name?.trim()) return properties.name.trim();

  const street = [properties.street, properties.housenumber]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ");

  return (
    street ||
    properties.district?.trim() ||
    properties.city?.trim() ||
    properties.county?.trim() ||
    "Lokasi"
  );
}

function buildPhotonAddress(properties: PhotonFeature["properties"], label: string): string {
  const street = [properties.street, properties.housenumber]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ");

  const parts = [street, properties.district, properties.city, properties.county, properties.state]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  const uniqueParts = parts.filter((part, index) => part !== label && parts.indexOf(part) === index);

  return uniqueParts.join(", ") || label;
}

async function collectPhotonCandidates(query: string): Promise<OsmCandidate[]> {
  const buildUrl = (withBbox: boolean) =>
    `${env.photonBaseUrl}/api?q=${encodeURIComponent(query)}` +
    `&limit=${CANDIDATE_LIMIT}&lang=en` +
    (withBbox ? `&bbox=${INDONESIA_BBOX}` : "");

  const payload = await fetchJson<{ features?: PhotonFeature[] }>(buildUrl(true));
  const normalizedQuery = query.trim().toLowerCase();

  return (payload.features ?? [])
    .filter((feature) => feature.properties.countrycode === "ID")
    .map((feature) => {
      const [longitude, latitude] = feature.geometry.coordinates;
      const label = buildPhotonLabel(feature.properties);
      const osmKey = feature.properties.osm_key ?? "";

      // Nama jalan/bus stop jangan mengalahkan tempat terkenal hanya karena namanya sama.
      let score = scoreByName(label, normalizedQuery, osmKey === "highway" ? 3 : 6);
      if (DESTINATION_OSM_KEYS.has(osmKey)) score += 2;
      if (osmKey === "place") score -= 3;
      if (feature.properties.street) score += 1;
      if (feature.properties.city) score += 1;

      return {
        score,
        result: {
          placeId: `photon-${feature.properties.osm_type ?? "osm"}-${feature.properties.osm_id ?? label}`,
          label,
          address: buildPhotonAddress(feature.properties, label),
          latitude,
          longitude,
        },
      };
    });
}

interface NominatimSearchItem {
  place_id: number;
  display_name: string;
  name?: string;
  lat: string;
  lon: string;
  class?: string;
  type?: string;
  importance?: number;
}

async function collectNominatimCandidates(query: string): Promise<OsmCandidate[]> {
  const url =
    `${env.nominatimBaseUrl}/search?format=jsonv2&addressdetails=0&limit=${CANDIDATE_LIMIT}` +
    `&countrycodes=id&accept-language=id&q=${encodeURIComponent(query)}`;

  const payload = await fetchJson<NominatimSearchItem[]>(url);
  const normalizedQuery = query.trim().toLowerCase();

  return payload.map((item) => {
    const label = item.name?.trim() || item.display_name.split(",")[0]?.trim() || "Lokasi";
    const osmKey = item.class ?? "";

    let score = scoreByName(label, normalizedQuery);
    if (DESTINATION_OSM_KEYS.has(osmKey)) score += 2;
    if (osmKey === "place") score -= 3;
    if (typeof item.importance === "number") score += item.importance * 12;

    return {
      score,
      result: {
        placeId: `osm-${item.place_id}`,
        label,
        address: item.display_name,
        latitude: Number(item.lat),
        longitude: Number(item.lon),
      },
    };
  });
}

/**
 * Ambil kandidat dari Photon dan Nominatim sekaligus, gabungkan, lalu urutkan
 * ulang: nama yang cocok + kategori tempat menang; nama desa/administratif
 * turun. Dua sumber ini saling melengkapi untuk alamat Indonesia.
 */
async function searchWithOpenStreetMap(query: string): Promise<PlaceSearchResult[]> {
  // "pasar baru jakarta" -> juga cari "pasar baru"; hasil yang cocok dengan
  // seluruh kata kunci tetap diberi nilai lebih supaya tidak kalah.
  const words = query.trim().split(/\s+/);
  const queryVariants = words.length > 1 ? [query, words.slice(0, -1).join(" ")] : [query];

  const collected = await Promise.allSettled(
    queryVariants.flatMap((variant, variantIndex) => [
      collectPhotonCandidates(variant).then((candidates) =>
        candidates.map((candidate) => ({
          ...candidate,
          score: candidate.score + (variantIndex === 0 ? 2 : 0),
        })),
      ),
      collectNominatimCandidates(variant).then((candidates) =>
        candidates.map((candidate) => ({
          ...candidate,
          score: candidate.score + (variantIndex === 0 ? 2 : 0),
        })),
      ),
    ]),
  );

  const candidates = collected.flatMap((outcome) =>
    outcome.status === "fulfilled" ? outcome.value : [],
  );

  const ranked = candidates
    .sort((first, second) => second.score - first.score)
    .map((candidate) => candidate.result);

  return finalizeResults(ranked);
}

/* ------------------------------------------------------------------ */

/**
 * Urutan percobaan pencarian lokasi:
 * Google → LocationIQ → MapTiler → Photon → Nominatim.
 * Yang tidak punya key otomatis dilewati, jadi tanpa key pun tetap jalan.
 */
export async function searchPlaces(query: string): Promise<ApiSuccess<PlaceSearchResult[]>> {
  const trimmedQuery = query.trim();

  let results: PlaceSearchResult[] = [];

  if (trimmedQuery.length >= 2) {
    const providers: Array<() => Promise<PlaceSearchResult[]>> = [];

    if (env.isGoogleEnabled) providers.push(() => searchWithGoogle(trimmedQuery));
    if (env.locationIqKey) providers.push(() => searchWithLocationIq(trimmedQuery));
    if (env.maptilerKey) providers.push(() => searchWithMaptiler(trimmedQuery));

    providers.push(() => searchWithOpenStreetMap(trimmedQuery));

    for (const provider of providers) {
      try {
        const providerResults = await provider();

        if (providerResults.length > 0) {
          results = providerResults;
          break;
        }
      } catch {
        // Provider ini gagal: lanjut ke berikutnya, jangan bikin UI error.
      }
    }
  }

  return {
    success: true,
    statusCode: 200,
    message: results.length > 0 ? "Lokasi ditemukan" : "Lokasi tidak ditemukan",
    data: results,
  };
}

/* ------------------------------------------------------------------ */
/* Reverse geocode: koordinat -> alamat                                */
/* ------------------------------------------------------------------ */

const reverseCache = new Map<string, PlaceSearchResult>();
const REVERSE_CACHE_LIMIT = 200;

function rememberReverseResult(cacheKey: string, place: PlaceSearchResult) {
  if (reverseCache.size >= REVERSE_CACHE_LIMIT) {
    const oldestKey = reverseCache.keys().next().value;
    if (oldestKey) reverseCache.delete(oldestKey);
  }

  reverseCache.set(cacheKey, place);
}

async function reverseWithGoogle(latitude: number, longitude: number): Promise<PlaceSearchResult> {
  const url =
    "https://maps.googleapis.com/maps/api/geocode/json" +
    `?latlng=${latitude},${longitude}&language=id&key=${env.googleMapsApiKey}`;

  const payload = await fetchJson<{
    results?: Array<{
      formatted_address: string;
      address_components?: Array<{ long_name: string }>;
    }>;
  }>(url);

  const firstResult = payload.results?.[0];

  return {
    placeId: `${latitude},${longitude}`,
    label: firstResult?.address_components?.[0]?.long_name ?? "Titik peta",
    address: firstResult?.formatted_address ?? `${latitude}, ${longitude}`,
    latitude,
    longitude,
  };
}

async function reverseWithLocationIq(latitude: number, longitude: number): Promise<PlaceSearchResult> {
  const url =
    `https://us1.locationiq.com/v1/reverse?key=${env.locationIqKey}` +
    `&lat=${latitude}&lon=${longitude}&format=json&accept-language=id`;

  const payload = await fetchJson<{
    display_name?: string;
    address?: { road?: string; suburb?: string; neighbourhood?: string; city?: string };
  }>(url);

  return {
    placeId: `${latitude},${longitude}`,
    label:
      payload.address?.road ??
      payload.address?.neighbourhood ??
      payload.address?.suburb ??
      payload.address?.city ??
      "Titik peta",
    address: payload.display_name ?? `${latitude}, ${longitude}`,
    latitude,
    longitude,
  };
}

async function reverseWithNominatim(latitude: number, longitude: number): Promise<PlaceSearchResult> {
  const url =
    `${env.nominatimBaseUrl}/reverse?format=jsonv2&addressdetails=1&accept-language=id` +
    `&lat=${latitude}&lon=${longitude}`;

  const payload = await fetchJson<{
    display_name?: string;
    name?: string;
    address?: {
      road?: string;
      neighbourhood?: string;
      suburb?: string;
      village?: string;
      city?: string;
    };
  }>(url);

  const label =
    payload.name?.trim() ||
    payload.address?.road ||
    payload.address?.neighbourhood ||
    payload.address?.suburb ||
    payload.address?.village ||
    payload.address?.city ||
    "Titik peta";

  return {
    placeId: `${latitude},${longitude}`,
    label,
    address: payload.display_name ?? `${latitude}, ${longitude}`,
    latitude,
    longitude,
  };
}

async function reverseWithPhoton(latitude: number, longitude: number): Promise<PlaceSearchResult> {
  const url = `${env.photonBaseUrl}/reverse?lat=${latitude}&lon=${longitude}&lang=en&limit=1`;
  const payload = await fetchJson<{ features?: PhotonFeature[] }>(url);
  const feature = payload.features?.[0];

  if (!feature) throw new ApiError(404, "Alamat tidak ditemukan");

  const label = buildPhotonLabel(feature.properties);

  return {
    placeId: `${latitude},${longitude}`,
    label,
    address: buildPhotonAddress(feature.properties, label),
    latitude,
    longitude,
  };
}

/**
 * Ubah koordinat jadi alamat. Dipakai tombol "Saya" dan input link Maps.
 *
 * Provider dicoba berurutan dan hasilnya di-cache, karena reverse geocoding
 * publik (Nominatim) punya batas request dan bisa menolak kalau dipanggil
 * berulang dalam waktu singkat.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<PlaceSearchResult> {
  const cacheKey = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  const cachedResult = reverseCache.get(cacheKey);
  if (cachedResult) return cachedResult;

  const providers: Array<() => Promise<PlaceSearchResult>> = [];

  if (env.isGoogleEnabled) providers.push(() => reverseWithGoogle(latitude, longitude));
  if (env.locationIqKey) providers.push(() => reverseWithLocationIq(latitude, longitude));

  providers.push(() => reverseWithNominatim(latitude, longitude));
  providers.push(() => reverseWithPhoton(latitude, longitude));

  const hasKeyedProvider = env.isGoogleEnabled || Boolean(env.locationIqKey);

  if (hasKeyedProvider) {
    // Provider berkey diutamakan dan dicoba berurutan (kualitas alamatnya lebih baik).
    for (const provider of providers) {
      try {
        const place = await provider();
        rememberReverseResult(cacheKey, place);
        return place;
      } catch {
        // Gagal (rate limit / jaringan): coba berikutnya.
      }
    }
  } else {
    // Tanpa key: Nominatim dan Photon dijalankan bersamaan, ambil yang tercepat.
    try {
      const place = await Promise.any(providers.map((provider) => provider()));
      rememberReverseResult(cacheKey, place);
      return place;
    } catch {
      // Dua-duanya gagal: pakai fallback koordinat di bawah.
    }
  }

  const fallbackResult: PlaceSearchResult = {
    placeId: `${latitude},${longitude}`,
    label: `Titik ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
    address: `${latitude}, ${longitude}`,
    latitude,
    longitude,
  };

  return fallbackResult;
}
