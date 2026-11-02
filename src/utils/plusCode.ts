/**
 * Decoder Open Location Code (Google "Kode Plus"), tanpa library.
 * Referensi algoritma: https://github.com/google/open-location-code
 *
 * Dipakai karena di aplikasi Google Maps, titik yang diketuk bisa disalin
 * dalam bentuk kode plus (contoh: `849VCWC8+R9`). Kode ini bisa diubah jadi
 * koordinat tanpa perlu API key.
 */

const CODE_ALPHABET = "23456789CFGHJMPQRVWX";
const SEPARATOR = "+";
const SEPARATOR_POSITION = 8;
const PADDING_CHARACTER = "0";
const ENCODING_BASE = CODE_ALPHABET.length;

export interface DecodedPlusCode {
  latitude: number;
  longitude: number;
  /** Perkiraan ukuran sel dalam meter (kode 10 karakter ≈ 14 m). */
  cellSizeMeters: number;
}

/**
 * Kode plus "pendek" (tanpa separator di posisi 8, mis. `CWC8+R9 Jakarta`)
 * butuh titik acuan, jadi tidak bisa didekode sendiri.
 */
function isRecoverableCode(cleanedCode: string): boolean {
  return cleanedCode.length <= SEPARATOR_POSITION;
}

export function decodePlusCode(rawCode: string): DecodedPlusCode | null {
  const compactCode = rawCode.toUpperCase().replace(/\s+/g, "").replace(/-/g, "");

  if (!compactCode.includes(SEPARATOR)) return null;
  if (!/^[0-9A-Z+]+$/.test(compactCode)) return null;

  const separatorIndex = compactCode.indexOf(SEPARATOR);
  if (separatorIndex > SEPARATOR_POSITION) return null;
  if (separatorIndex < SEPARATOR_POSITION && separatorIndex % 2 !== 0) return null;

  const withoutSeparator = compactCode.replace(SEPARATOR, "");

  // Buang padding di belakang (`0`) supaya kode 8 karakter (tanpa grid) tetap sah.
  const cleanedCode = withoutSeparator.replace(new RegExp(`${PADDING_CHARACTER}+$`), "");

  if (cleanedCode.length < 2) return null;
  if (isRecoverableCode(cleanedCode)) return null;

  const separatorsInCode = cleanedCode.split(SEPARATOR).length - 1;
  if (separatorsInCode > 0) return null;

  for (const character of cleanedCode) {
    if (!CODE_ALPHABET.includes(character)) return null;
  }

  let latitude = -90;
  let longitude = -180;
  let latitudeResolution = 400;
  let longitudeResolution = 400;

  for (let index = 0; index < cleanedCode.length; index += 2) {
    latitudeResolution /= ENCODING_BASE;
    longitudeResolution /= ENCODING_BASE;

    const latitudeDigit = CODE_ALPHABET.indexOf(cleanedCode.charAt(index));
    const longitudeDigit = CODE_ALPHABET.indexOf(cleanedCode.charAt(index + 1));

    if (longitudeDigit < 0) return null;

    latitude += latitudeResolution * latitudeDigit;
    longitude += longitudeResolution * longitudeDigit;
  }

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const cellSizeMeters = Math.round(latitudeResolution * 111_320);

  return {
    latitude: latitude + latitudeResolution / 2,
    longitude: longitude + longitudeResolution / 2,
    cellSizeMeters,
  };
}
