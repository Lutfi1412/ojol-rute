import { useCallback, useState } from "react";
import { reverseGeocode } from "@/services/api/places.api";
import type { PlaceSearchResult } from "@/types/api.types";

interface GeolocationState {
  isLocating: boolean;
  errorMessage: string | null;
  requestCurrentPosition: () => Promise<PlaceSearchResult | null>;
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

    setIsLocating(true);
    setErrorMessage(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12_000,
          maximumAge: 30_000,
        });
      });

      return await reverseGeocode(position.coords.latitude, position.coords.longitude);
    } catch (error) {
      const message =
        error instanceof GeolocationPositionError
          ? "Izin lokasi ditolak atau lokasi tidak terbaca."
          : "Lokasi sekarang gagal diambil.";

      setErrorMessage(message);
      return null;
    } finally {
      setIsLocating(false);
    }
  }, []);

  return { isLocating, errorMessage, requestCurrentPosition };
}
