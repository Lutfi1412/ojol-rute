import { env } from "@/config/env";
import type { ApiSuccess, PlaceSearchResult } from "@/types/api.types";
import { ApiError } from "./apiError";

const SEARCH_RESULT_LIMIT = 6;
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

interface NominatimSearchItem {
  place_id: number;
  display_name: string;
  name?: string;
  lat: string;
  lon: string;
}

interface NominatimReverseResponse {
  display_name?: string;
  name?: string;
  lat?: string;
  lon?: string;
  error?: string;
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

  return results.filter((item): item is PlaceSearchResult => item !== null);
}

async function searchWithNominatim(query: string): Promise<PlaceSearchResult[]> {
  const url =
    `${env.nominatimBaseUrl}/search?format=jsonv2&addressdetails=0&limit=${SEARCH_RESULT_LIMIT}` +
    `&countrycodes=id&accept-language=id&q=${encodeURIComponent(query)}`;

  const payload = await fetchJson<NominatimSearchItem[]>(url);

  return payload.map((item) => ({
    placeId: `osm-${item.place_id}`,
    label: item.name?.trim() || item.display_name.split(",")[0]?.trim() || item.display_name,
    address: item.display_name,
    latitude: Number(item.lat),
    longitude: Number(item.lon),
  }));
}

/** Cari lokasi: Google Places kalau key tersedia, kalau tidak Nominatim/OSM. */
export async function searchPlaces(query: string): Promise<ApiSuccess<PlaceSearchResult[]>> {
  const trimmedQuery = query.trim();

  const results =
    trimmedQuery.length < 3
      ? []
      : env.isGoogleEnabled
        ? await searchWithGoogle(trimmedQuery)
        : await searchWithNominatim(trimmedQuery);

  return {
    success: true,
    statusCode: 200,
    message: results.length > 0 ? "Lokasi ditemukan" : "Lokasi tidak ditemukan",
    data: results,
  };
}

/** Ubah koordinat jadi alamat (dipakai tombol "Lokasi saya"). */
export async function reverseGeocode(latitude: number, longitude: number): Promise<PlaceSearchResult> {
  if (env.isGoogleEnabled) {
    const url =
      "https://maps.googleapis.com/maps/api/geocode/json" +
      `?latlng=${latitude},${longitude}&language=id&key=${env.googleMapsApiKey}`;

    const payload = await fetchJson<{
      status: string;
      results?: Array<{ formatted_address: string; address_components?: Array<{ long_name: string }> }>;
    }>(url);

    const firstResult = payload.results?.[0];

    return {
      placeId: `${latitude},${longitude}`,
      label: firstResult?.address_components?.[0]?.long_name ?? "Lokasi saya",
      address: firstResult?.formatted_address ?? `${latitude}, ${longitude}`,
      latitude,
      longitude,
    };
  }

  const url = `${env.nominatimBaseUrl}/reverse?format=jsonv2&accept-language=id&lat=${latitude}&lon=${longitude}`;
  const payload = await fetchJson<NominatimReverseResponse>(url);

  return {
    placeId: `${latitude},${longitude}`,
    label: payload.name?.trim() || "Lokasi saya",
    address: payload.display_name ?? `${latitude}, ${longitude}`,
    latitude,
    longitude,
  };
}
