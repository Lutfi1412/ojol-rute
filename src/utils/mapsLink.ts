import { decodePlusCode } from "./plusCode";

/**
 * Membaca input manual untuk titik: link Google Maps, koordinat, atau kode plus.
 *
 * Kenapa dipisah dari pencarian nama? Karena kadang alamatnya tidak ada di
 * OpenStreetMap/Photon. Driver bisa cari sendiri di Google Maps, lalu tempel
 * link-nya di sini — hasilnya tetap koordinat yang sama persis.
 */

export type LocationInputSource = "shortLink" | "mapsUrl" | "coordinates" | "plusCode";

export type LocationInputResult =
  | { status: "empty" }
  | {
      status: "parsed";
      latitude: number;
      longitude: number;
      source: LocationInputSource;
      label: string;
    }
  | { status: "shortLink"; url: string; message: string }
  | { status: "invalid"; message: string };

const SHORT_LINK_HOSTS = ["maps.app.goo.gl", "goo.gl", "g.co"];
const MAPS_HOST_PATTERN = /(^|\.)(google\.[a-z.]+|goo\.gl|maps\.app\.go\.gl|maps\.google\.[a-z.]+)$/i;

interface CoordinatePair {
  latitude: number;
  longitude: number;
}

function isValidCoordinate(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180 &&
    !(latitude === 0 && longitude === 0)
  );
}

function toCoordinatePair(latitudeText: string, longitudeText: string): CoordinatePair | null {
  const latitude = Number(latitudeText);
  const longitude = Number(longitudeText);

  return isValidCoordinate(latitude, longitude) ? { latitude, longitude } : null;
}

function isShortMapsLink(rawInput: string): boolean {
  try {
    const parsedUrl = new URL(rawInput);
    return SHORT_LINK_HOSTS.some(
      (host) => parsedUrl.hostname === host || parsedUrl.hostname.endsWith(`.${host}`),
    );
  } catch {
    return /(maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(rawInput);
  }
}

function isMapsDomain(rawInput: string): boolean {
  try {
    return MAPS_HOST_PATTERN.test(new URL(rawInput).hostname);
  } catch {
    return false;
  }
}

/** Pola koordinat yang umum muncul di URL Google Maps, urut dari paling akurat. */
const URL_COORDINATE_PATTERNS: RegExp[] = [
  // Titik tempat (paling akurat): data=!4m6...!3d-6.1753!4d106.8271
  /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
  // Parameter query: ?q=-6.175,106.827 / ?query= / ?ll= / ?center= / ?destination=
  /[?&](?:q|query|ll|center|destination|daddr|sll)=(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i,
  // Posisi peta: /@-6.175,106.827,17z
  /\/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
  // Path place: /place/-6.175,106.827
  /\/place\/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
];

const PLAIN_COORDINATE_PATTERNS: RegExp[] = [
  /^(-?\d{1,3}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)$/,
  /^(-?\d{1,3}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)$/,
];

function normalizeDecimal(value: string): string {
  // "106,827" (koma desimal) -> "106.827", tapi tetap dukung pemisah koma antar angka.
  return value.replace(",", ".");
}

function parseCoordinateText(rawInput: string): CoordinatePair | null {
  const normalizedInput = rawInput.replace(/\s+/g, " ").trim();

  for (const pattern of PLAIN_COORDINATE_PATTERNS) {
    const match = normalizedInput.match(pattern);
    if (!match) continue;

    const [, latitudeText, longitudeText] = match;
    if (!latitudeText || !longitudeText) continue;

    const pair = toCoordinatePair(normalizeDecimal(latitudeText), normalizeDecimal(longitudeText));
    if (pair) return pair;
  }

  // Format derajat: -6°10'31.4"S 106°49'37.6"E
  const dmsPattern =
    /(\d{1,3})[°\s]+(\d{1,2})['\s]+(\d{1,2}(?:\.\d+)?)"?\s*([NS])[,\s]+(\d{1,3})[°\s]+(\d{1,2})['\s]+(\d{1,2}(?:\.\d+)?)"?\s*([EW])/i;
  const dmsMatch = rawInput.match(dmsPattern);

  if (dmsMatch) {
    const [, latDegrees, latMinutes, latSeconds, latDirection, lngDegrees, lngMinutes, lngSeconds, lngDirection] =
      dmsMatch;

    if (
      latDegrees &&
      latMinutes &&
      latSeconds &&
      latDirection &&
      lngDegrees &&
      lngMinutes &&
      lngSeconds &&
      lngDirection
    ) {
      const latitudeDegrees = Number(latDegrees) + Number(latMinutes) / 60 + Number(latSeconds) / 3600;
      const longitudeDegrees =
        Number(lngDegrees) + Number(lngMinutes) / 60 + Number(lngSeconds) / 3600;
      const latitude = latDirection.toUpperCase() === "S" ? -latitudeDegrees : latitudeDegrees;
      const longitude = lngDirection.toUpperCase() === "W" ? -longitudeDegrees : longitudeDegrees;

      if (isValidCoordinate(latitude, longitude)) return { latitude, longitude };
    }
  }

  return null;
}

/**
 * Terima:
 * - link Google Maps panjang (`/maps/place/.../@lat,lng`, `!3d..!4d..`, `?q=lat,lng`)
 * - koordinat polos: `-6.175392, 106.827153`
 * - derajat-menit-detik: `6°10'31.4"S 106°49'37.6"E`
 * - kode plus: `849VCWC8+R9`
 *
 * Link pendek `maps.app.goo.gl` tidak bisa dibuka isinya dari browser (CORS),
 * jadi dikembalikan sebagai `shortLink` supaya UI bisa memberi petunjuk.
 */
export function parseLocationInput(rawInput: string): LocationInputResult {
  const trimmedInput = rawInput.trim();

  if (trimmedInput.length === 0) return { status: "empty" };

  if (isShortMapsLink(trimmedInput)) {
    return {
      status: "shortLink",
      url: trimmedInput,
      message:
        "Link pendek (maps.app.goo.gl) tidak bisa dibaca otomatis. Buka link-nya, lalu salin koordinat atau kode plus dari halaman tempat itu.",
    };
  }

  const decodedInput = (() => {
    try {
      return decodeURIComponent(trimmedInput);
    } catch {
      return trimmedInput;
    }
  })();

  if (/^https?:\/\//i.test(trimmedInput) || isMapsDomain(decodedInput)) {
    const candidates = [decodedInput, trimmedInput];

    for (const candidate of candidates) {
      for (const pattern of URL_COORDINATE_PATTERNS) {
        const match = candidate.match(pattern);
        if (!match) continue;

        const [, latitudeText, longitudeText] = match;
        if (!latitudeText || !longitudeText) continue;

        const pair = toCoordinatePair(latitudeText, longitudeText);
        if (!pair) continue;

        return {
          status: "parsed",
          latitude: pair.latitude,
          longitude: pair.longitude,
          source: "mapsUrl",
          label: "Link Google Maps",
        };
      }
    }

    return {
      status: "invalid",
      message:
        "Link ini tidak memuat koordinat. Di Google Maps, buka titiknya → Bagikan → Salin link, atau salin angka koordinatnya.",
    };
  }

  const coordinatePair = parseCoordinateText(decodedInput);

  if (coordinatePair) {
    return {
      status: "parsed",
      latitude: coordinatePair.latitude,
      longitude: coordinatePair.longitude,
      source: "coordinates",
      label: "Koordinat",
    };
  }

  const plusCode = decodePlusCode(trimmedInput);

  if (plusCode) {
    return {
      status: "parsed",
      latitude: plusCode.latitude,
      longitude: plusCode.longitude,
      source: "plusCode",
      label: "Kode plus",
    };
  }

  return {
    status: "invalid",
    message:
      "Belum terbaca. Tempel link Google Maps yang panjang, koordinat (contoh: -6.175392, 106.827153), atau kode plus (contoh: 849VCWC8+R9).",
  };
}

/** Teks bantuan singkat yang dipakai di UI. */
export const LOCATION_INPUT_HINT =
  "Bisa tempel link Google Maps, koordinat (-6.17, 106.82), atau kode plus (849VCWC8+R9).";

export const GOOGLE_MAPS_HOME_URL = "https://www.google.com/maps";
