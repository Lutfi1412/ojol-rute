import { Crosshair, LocateFixed, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardSection } from "@/components/ui/Card";
import {
  isDriverFixStale,
  type DriverFix,
} from "@/features/routes/location/planOrigin";
import type { GeoPoint } from "@/types/route.types";
import { cn } from "@/utils/cn";
import { formatTimeAgo } from "@/utils/formatDate";
import { formatDistance } from "@/utils/formatMeasurement";

interface DriverLocationCardProps {
  driverFix: DriverFix | null;
  isLocating: boolean;
  errorMessage: string | null;
  /** Titik 0 yang benar-benar dipakai planner (bisa jatuh ke titik awal rute). */
  origin: GeoPoint | null;
  /** Jarak titik 0 ke titik pertama; null kalau rute belum punya etape. */
  distanceToFirstStopMeters: number | null;
  /** Jumlah titik selesai yang tidak ikut dihitung lagi. */
  skippedCompletedStops: number;
  onRefresh: () => void;
}

export function DriverLocationCard({
  driverFix,
  isLocating,
  errorMessage,
  origin,
  distanceToFirstStopMeters,
  skippedCompletedStops,
  onRefresh,
}: DriverLocationCardProps) {
  const isUsingDriverPosition = driverFix !== null;
  const isStale = isUsingDriverPosition && isDriverFixStale(driverFix);

  return (
    <Card>
      <CardSection className="space-y-2.5">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl",
              isUsingDriverPosition ? "bg-brand/10 text-brand" : "bg-amber-50 text-amber-600",
            )}
          >
            {isUsingDriverPosition ? (
              <LocateFixed className="size-4.5" />
            ) : (
              <Crosshair className="size-4.5" />
            )}
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-ink">
              {isUsingDriverPosition ? "Rute dimulai dari lokasi Anda" : "Lokasi Anda belum terbaca"}
            </p>

            {isUsingDriverPosition ? (
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-soft">
                Titik 0: {origin?.latitude.toFixed(5)}, {origin?.longitude.toFixed(5)} · akurasi ±
                {Math.round(driverFix.accuracyMeters)} m · {formatTimeAgo(driverFix.capturedAt)}
              </p>
            ) : (
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-soft">
                {origin
                  ? `Sementara rute dihitung dari titik awal rute: ${origin.label}.`
                  : "Sementara rute dihitung dari titik pertama, karena belum ada titik awal."}
              </p>
            )}

            {distanceToFirstStopMeters !== null ? (
              <p className="mt-1 text-[12px] font-semibold text-ink">
                {isUsingDriverPosition ? "Anda" : "Titik awal"} → titik 1:{" "}
                <span className="tabular-nums text-brand">
                  {formatDistance(distanceToFirstStopMeters)}
                </span>
              </p>
            ) : null}

            {skippedCompletedStops > 0 ? (
              <p className="mt-1 text-[11px] text-slate-500">
                {skippedCompletedStops} titik selesai dilewati, rencana lanjut ke titik berikutnya.
              </p>
            ) : null}

            {errorMessage ? (
              <p className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-[11.5px] leading-relaxed text-amber-800">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                {errorMessage}
              </p>
            ) : null}

            {isStale ? (
              <p className="mt-1 text-[11px] font-semibold text-amber-700">
                Posisi sudah agak lama — tekan Perbarui sebelum berangkat.
              </p>
            ) : null}
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            disabled={isLocating}
            className="shrink-0"
          >
            <RefreshCw className={cn("size-3.5", isLocating && "animate-spin")} />
            {isLocating ? "Membaca…" : "Perbarui"}
          </Button>
        </div>
      </CardSection>
    </Card>
  );
}
