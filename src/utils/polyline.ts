/**
 * Decoder polyline Google/OSRM (encoded polyline algorithm, presisi 5).
 * Dipakai untuk menggambar garis rute di Leaflet.
 */
export interface LatLngLiteral {
  latitude: number;
  longitude: number;
}

export function decodePolyline(encodedPolyline: string): LatLngLiteral[] {
  if (!encodedPolyline) return [];

  const coordinates: LatLngLiteral[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encodedPolyline.length) {
    let byte = 0;
    let shift = 0;
    let result = 0;

    do {
      byte = encodedPolyline.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLatitude = result & 1 ? ~(result >> 1) : result >> 1;
    latitude += deltaLatitude;

    byte = 0;
    shift = 0;
    result = 0;

    do {
      byte = encodedPolyline.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLongitude = result & 1 ? ~(result >> 1) : result >> 1;
    longitude += deltaLongitude;

    coordinates.push({
      latitude: latitude / 1e5,
      longitude: longitude / 1e5,
    });
  }

  return coordinates;
}
