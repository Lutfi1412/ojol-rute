import { Check, ExternalLink, Navigation } from "lucide-react";
import { PROVIDERS } from "@/constants/app";
import type { GeoPoint, RoutePlan } from "@/types/route.types";
import { formatDistance, formatDuration } from "@/utils/formatMeasurement";
import { cn } from "@/utils/cn";

interface PlanTimelineProps {
  plan: RoutePlan;
  startPoint: GeoPoint | null;
  isSaving: boolean;
  onToggleStop: (groupId: string, stopId: string) => void;
}

const MAX_URL_WAYPOINTS = 9;

function buildGoogleMapsUrl(plan: RoutePlan, startPoint: GeoPoint | null): string {
  const firstStep = plan.steps[0];
  const lastStep = plan.steps[plan.steps.length - 1];
  if (!firstStep || !lastStep) return "https://www.google.com/maps";

  const origin = startPoint
    ? `${startPoint.latitude},${startPoint.longitude}`
    : `${firstStep.latitude},${firstStep.longitude}`;

  // Titik pertama jadi origin kalau tidak ada titik start, jadi jangan diulang.
  const waypointSteps = (startPoint ? plan.steps.slice(0, -1) : plan.steps.slice(1, -1)).slice(
    0,
    MAX_URL_WAYPOINTS,
  );

  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("travelmode", "driving");
  url.searchParams.set("origin", origin);
  url.searchParams.set("destination", `${lastStep.latitude},${lastStep.longitude}`);

  if (waypointSteps.length > 0) {
    url.searchParams.set(
      "waypoints",
      waypointSteps.map((step) => `${step.latitude},${step.longitude}`).join("|"),
    );
  }

  return url.toString();
}

/** Urutan kunjungan hasil optimizer, lengkap dengan jarak tiap etape. */
export function PlanTimeline({ plan, startPoint, isSaving, onToggleStop }: PlanTimelineProps) {
  const mapsUrl = buildGoogleMapsUrl(plan, startPoint);

  return (
    <div>
      <ol className="relative">
        {plan.steps.map((step, index) => {
          const providerMeta = PROVIDERS[step.provider];
          const isLast = index === plan.steps.length - 1;
          const isCompleted = step.completedAt !== null;

          return (
            <li key={step.stopId} className="relative flex gap-3 pb-1">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "z-10 grid size-7 shrink-0 place-items-center rounded-full text-[11.5px] font-extrabold text-white ring-4 ring-white",
                    isCompleted && "bg-slate-400",
                  )}
                  style={isCompleted ? undefined : { backgroundColor: providerMeta.color }}
                >
                  {step.visitOrder}
                </span>
                {!isLast ? <span className="my-0.5 w-px flex-1 bg-slate-200" /> : null}
              </div>

              <div className={cn("min-w-0 flex-1", isLast ? "pb-0" : "pb-4")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "truncate text-[13.5px] font-bold text-ink",
                        isCompleted && "text-slate-400 line-through",
                      )}
                    >
                      {step.label}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-ink-soft">
                      {step.address}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onToggleStop(step.groupId, step.stopId)}
                    disabled={isSaving}
                    aria-pressed={isCompleted}
                    aria-label={isCompleted ? "Batalkan tanda selesai" : "Tandai selesai"}
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-full border transition-colors",
                      isCompleted
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-slate-300 bg-white text-transparent hover:border-emerald-500 hover:text-emerald-500",
                    )}
                  >
                    <Check className="size-4" strokeWidth={3} />
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-slate-500">
                  <span
                    className="inline-flex items-center gap-1 font-bold"
                    style={{ color: providerMeta.color }}
                  >
                    {providerMeta.label}
                  </span>
                  <span className="tabular-nums">
                    {step.legDistanceMeters === 0 && index === 0 && !startPoint
                      ? "titik awal"
                      : `+${formatDistance(step.legDistanceMeters)} · ${formatDuration(step.legDurationSeconds)}`}
                  </span>
                  <span className="tabular-nums text-slate-400">
                    total {formatDistance(step.cumulativeDistanceMeters)}
                  </span>
                  <span className="text-slate-300" aria-hidden="true">
                    ·
                  </span>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${step.latitude},${step.longitude}&travelmode=driving`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"
                  >
                    Buka <ExternalLink className="size-3" />
                  </a>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <a
        href={mapsUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink text-sm font-bold text-white hover:bg-slate-800"
      >
        <Navigation className="size-4" />
        Buka seluruh rute di Google Maps
      </a>
    </div>
  );
}
