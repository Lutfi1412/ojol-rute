/**
 * Encoder polyline (algoritma yang sama dengan decoder). Dipakai sebagai
 * fallback: kalau layanan rute gagal, garis digambar lurus antar titik supaya
 * peta tetap bisa menampilkan urutan kunjungan.
 */
export function encodePolyline(
  points: Array<{ latitude: number; longitude: number }>,
  precision = 5,
): string {
  if (points.length === 0) return "";

  const factor = 10 ** precision;
  let previousLatitude = 0;
  let previousLongitude = 0;
  let encoded = "";

  const encodeValue = (value: number): string => {
    let shifted = value < 0 ? ~(value << 1) : value << 1;
    let output = "";

    while (shifted >= 0x20) {
      output += String.fromCharCode((0x20 | (shifted & 0x1f)) + 63);
      shifted >>= 5;
    }

    output += String.fromCharCode(shifted + 63);
    return output;
  };

  for (const point of points) {
    const latitude = Math.round(point.latitude * factor);
    const longitude = Math.round(point.longitude * factor);

    encoded += encodeValue(latitude - previousLatitude);
    encoded += encodeValue(longitude - previousLongitude);

    previousLatitude = latitude;
    previousLongitude = longitude;
  }

  return encoded;
}
