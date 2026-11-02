import { Clock, Info, MapPinned, Route as RouteIcon, Sparkles } from "lucide-react";
import { MEANINGFUL_SAVING_METERS } from "@/constants/app";
import type { RoutePlan } from "@/types/route.types";
import { formatDistance, formatDuration } from "@/utils/formatMeasurement";
import { cn } from "@/utils/cn";

interface RouteSummaryProps {
  plan: RoutePlan | null;
  totalStops: number;
  completedStops: number;
  isPlanning: boolean;
}

function SummaryCell({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-[19px] font-extrabold leading-none tracking-tight text-ink tabular-nums">
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11.5px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function RouteSummary({ plan, totalStops, completedStops, isPlanning }: RouteSummaryProps) {
  const savedDistanceMeters = plan?.comparison.savedDistanceMeters ?? 0;
  const savedDurationSeconds = plan?.comparison.savedDurationSeconds ?? 0;

  const isMeaningful =
    savedDistanceMeters >= MEANINGFUL_SAVING_METERS || savedDurationSeconds >= 120;
  const hasMultipleStops = (plan?.steps.length ?? 0) > 1;

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div
        className={cn(
          "grid grid-cols-3 divide-x divide-line",
          isPlanning && "animate-pulse",
        )}
      >
        <SummaryCell
          icon={<RouteIcon className="size-3.5" />}
          label="Jarak"
          value={plan ? formatDistance(plan.totalDistanceMeters) : "—"}
          hint={plan ? `mesin: ${plan.engine === "google" ? "Google" : "OSRM"}` : "menghitung…"}
        />
        <SummaryCell
          icon={<Clock className="size-3.5" />}
          label="Waktu"
          value={plan ? formatDuration(plan.totalDurationSeconds) : "—"}
          hint="estimasi berkendara"
        />
        <SummaryCell
          icon={<MapPinned className="size-3.5" />}
          label="Titik"
          value={`${completedStops}/${totalStops}`}
          hint="selesai / total"
        />
      </div>

      {plan && hasMultipleStops && isMeaningful ? (
        <div className="flex items-start gap-2.5 border-t border-line bg-emerald-50/70 px-4 py-3">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-emerald-600" />
          <p className="text-[12.5px] leading-relaxed text-emerald-900">
            <span className="font-bold">
              Hemat {formatDistance(savedDistanceMeters)} · {formatDuration(savedDurationSeconds)}
            </span>{" "}
            dibanding mengerjakan Grab dan Shopee terpisah (
            {formatDistance(plan.comparison.separateDistanceMeters)} →{" "}
            {formatDistance(plan.comparison.interleavedDistanceMeters)}).
          </p>
        </div>
      ) : null}

      {plan && hasMultipleStops && !isMeaningful ? (
        <div className="border-t border-line bg-slate-50 px-4 py-2.5">
          <p className="text-[12px] leading-relaxed text-ink-soft">
            Selisih dengan menyelesaikan per provider cuma {formatDistance(savedDistanceMeters)} —
            untuk kombinasi ini keduanya hampir sama.
          </p>
        </div>
      ) : null}

      {plan && plan.notes.length > 0 ? (
        <div className="border-t border-line px-4 py-2.5">
          <ul className="space-y-1">
            {plan.notes.map((note) => (
              <li
                key={note}
                className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-slate-500"
              >
                <Info className="mt-0.5 size-3 shrink-0" />
                {note}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
