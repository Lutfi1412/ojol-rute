import { Link } from "react-router-dom";
import { ChevronRight, Clock3 } from "lucide-react";
import { PROVIDERS } from "@/constants/app";
import type { RouteRecord } from "@/types/route.types";
import { formatRelativeDate } from "@/utils/formatDate";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatusBadge } from "@/components/ui/Badge";
import { ProviderAvatar } from "@/components/common/ProviderBadge";

interface RouteCardProps {
  route: RouteRecord;
}

export function RouteCard({ route }: RouteCardProps) {
  const allStops = route.groups.flatMap((group) => group.stops);
  const completedStops = allStops.filter((stop) => stop.completedAt !== null).length;

  return (
    <Link
      to={`/rute/${route.id}`}
      className="block rounded-2xl border border-line bg-white p-4 transition-colors hover:border-slate-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[15px] font-bold tracking-tight text-ink">{route.name}</h3>
            <StatusBadge status={route.status} />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            {route.groups.map((group) => (
              <span key={group.id} className="inline-flex items-center gap-1">
                <ProviderAvatar provider={group.provider} />
                <span className="text-[12px] font-semibold text-ink-soft">
                  {group.stops.length} titik
                </span>
              </span>
            ))}
          </div>
        </div>

        <ChevronRight className="mt-1 size-4 shrink-0 text-slate-300" />
      </div>

      <div className="mt-3.5 flex items-center gap-3">
        <div className="flex-1">
          <ProgressBar value={completedStops} max={Math.max(allStops.length, 1)} />
        </div>
        <span className="text-[11.5px] font-bold tabular-nums text-ink-soft">
          {completedStops}/{allStops.length}
        </span>
      </div>

      <div className="mt-2.5 flex items-center justify-between text-[11.5px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <Clock3 className="size-3" />
          {formatRelativeDate(route.updatedAt)}
        </span>
        <span className="truncate">
          {route.groups
            .map((group) => PROVIDERS[group.provider].label)
            .filter((label, index, labels) => labels.indexOf(label) === index)
            .join(" + ")}
        </span>
      </div>
    </Link>
  );
}
