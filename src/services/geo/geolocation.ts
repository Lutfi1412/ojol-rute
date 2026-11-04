import type { DriverFix } from "@/features/routes/location/planOrigin";

function requestPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

export function describeGeolocationError(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Izin lokasi diblokir. Buka pengaturan situs di browser (ikon gembok), ubah Lokasi ke "Izinkan", lalu muat ulang halaman.';
    case error.POSITION_UNAVAILABLE:
      return "Lokasi tidak terbaca. Pastikan GPS/Lokasi di HP sudah aktif.";
    case error.TIMEOUT:
      return "Mencari lokasi terlalu lama. Coba lagi di tempat yang sinyal GPS-nya lebih baik.";
    default:
      return "Lokasi sekarang gagal diambil.";
  }
}

/**
 * Baca posisi perangkat sekali (bukan watch) dan kembalikan koordinat + akurasi.
 * Pemanggilan pertama sebaiknya dari klik tombol agar popup izin muncul; kalau
 * izin sudah pernah diberikan, pembacaan otomatis saat halaman dibuka aman.
 */
export async function readDriverFix(): Promise<DriverFix> {
  if (!("geolocation" in navigator)) {
    throw new Error("Browser ini tidak mendukung fitur lokasi.");
  }

  // Di HTTP biasa (mis. http://192.168.x.x) browser menolak tanpa popup.
  if (!window.isSecureContext) {
    throw new Error(
      "Halaman ini belum memakai HTTPS, jadi browser tidak bisa membaca lokasi. Buka lewat alamat https://.",
    );
  }

  let position: GeolocationPosition;

  try {
    position = await requestPosition({
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 0,
    });
  } catch (firstError) {
    const isPermissionDenied =
      firstError instanceof GeolocationPositionError &&
      firstError.code === firstError.PERMISSION_DENIED;

    if (isPermissionDenied) throw firstError;

    // GPS presisi tinggi sering timeout di dalam ruangan -> coba sekali via jaringan.
    position = await requestPosition({
      enableHighAccuracy: false,
      timeout: 10_000,
      maximumAge: 30_000,
    });
  }

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracyMeters: position.coords.accuracy,
    capturedAt: new Date(position.timestamp).toISOString(),
  };
}
