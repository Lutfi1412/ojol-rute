import { useCallback, useEffect, useRef, useState } from "react";
import type { DriverFix } from "@/features/routes/location/planOrigin";
import { readDriverFix } from "@/services/geo/geolocation";

interface DriverLocationState {
  driverFix: DriverFix | null;
  isLocating: boolean;
  errorMessage: string | null;
  /** Baca ulang GPS; dipakai tombol "Perbarui lokasi" dan hitung ulang rute. */
  refreshDriverLocation: () => Promise<DriverFix | null>;
}

/**
 * Lokasi driver untuk titik 0 rencana rute.
 *
 * Dibaca otomatis saat halaman dibuka dan saat tab kembali aktif, lalu bisa
 * dipaksa ulang lewat tombol. Pembacaan memakai getCurrentPosition (bukan watch)
 * supaya baterai tidak terkuras saat layar rute dibiarkan terbuka.
 */
export function useDriverLocation(): DriverLocationState {
  const [driverFix, setDriverFix] = useState<DriverFix | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Permintaan lama yang selesai belakangan tidak boleh menimpa hasil terbaru.
  const latestRequestId = useRef(0);
  const isActive = useRef(false);

  const refreshDriverLocation = useCallback(async () => {
    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;

    if (!isActive.current) return null;

    setIsLocating(true);
    setErrorMessage(null);

    try {
      const fix = await readDriverFix();
      if (requestId !== latestRequestId.current) return fix;

      setDriverFix(fix);
      return fix;
    } catch (error) {
      if (requestId !== latestRequestId.current) return null;

      setErrorMessage(error instanceof Error ? error.message : "Lokasi sekarang gagal diambil.");
      return null;
    } finally {
      if (requestId === latestRequestId.current) {
        setIsLocating(false);
      }
    }
  }, []);

  useEffect(() => {
    isActive.current = true;
    void refreshDriverLocation();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshDriverLocation();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isActive.current = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshDriverLocation]);

  return { driverFix, isLocating, errorMessage, refreshDriverLocation };
}
