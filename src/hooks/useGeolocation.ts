import { useCallback, useState } from "react";
import { reverseGeocode } from "@/services/api/places.api";
import type { PlaceSearchResult } from "@/types/api.types";

interface GeolocationState {
  isLocating: boolean;
  errorMessage: string | null;
  requestCurrentPosition: () => Promise<PlaceSearchResult | null>;
}

function getPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function describeGeolocationError(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Izin lokasi diblokir. Buka pengaturan situs di browser (ikon gembok di address bar), ubah Lokasi ke \"Izinkan\", lalu muat ulang halaman.";
    case error.POSITION_UNAVAILABLE:
      return "Lokasi tidak terbaca. Pastikan GPS/Lokasi di HP sudah aktif.";
    case error.TIMEOUT:
      return "Mencari lokasi terlalu lama. Coba lagi di tempat yang sinyal GPS-nya lebih baik.";
    default:
      return "Lokasi sekarang gagal diambil.";
  }
}

/** Ambil posisi sekarang (butuh HTTPS / localhost dan izin lokasi browser). */
export function useGeolocation(): GeolocationState {
  const [isLocating, setIsLocating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const requestCurrentPosition = useCallback(async () => {
    if (!("geolocation" in navigator)) {
      setErrorMessage("Browser ini tidak mendukung fitur lokasi.");
      return null;
    }

    // Di HTTP biasa (mis. http://192.168.x.x) browser menolak diam-diam tanpa popup.
    if (!window.isSecureContext) {
      setErrorMessage(
        "Halaman ini belum memakai HTTPS, jadi browser tidak menampilkan popup izin lokasi. Buka lewat alamat https://.",
      );
      return null;
    }

    setIsLocating(true);
    setErrorMessage(null);

    try {
      // Pemanggilan ini harus langsung dari klik tombol agar popup izin muncul.
      let position: GeolocationPosition;

      try {
        position = await getPosition({
          enableHighAccuracy: true,
          timeout: 15_000,
          maximumAge: 30_000,
        });
      } catch (firstError) {
        // GPS presisi tinggi sering timeout di dalam ruangan -> coba sekali lagi via jaringan.
        if (
          firstError instanceof GeolocationPositionError &&
          firstError.code !== firstError.PERMISSION_DENIED
        ) {
          position = await getPosition({
            enableHighAccuracy: false,
            timeout: 10_000,
            maximumAge: 60_000,
          });
        } else {
          throw firstError;
        }
      }

      return await reverseGeocode(position.coords.latitude, position.coords.longitude);
    } catch (error) {
      setErrorMessage(
        error instanceof GeolocationPositionError
          ? describeGeolocationError(error)
          : "Lokasi sekarang gagal diambil.",
      );
      return null;
    } finally {
      setIsLocating(false);
    }
  }, []);

  return { isLocating, errorMessage, requestCurrentPosition };
}