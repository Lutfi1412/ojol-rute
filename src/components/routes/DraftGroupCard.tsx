import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { MAX_STOPS_PER_GROUP, PROVIDERS } from "@/constants/app";
import type { PlaceSearchResult } from "@/types/api.types";
import type { ProviderId } from "@/types/route.types";
import { StopSearchField } from "@/components/common/StopSearchField";
import { ProviderBadge } from "@/components/common/ProviderBadge";

export interface DraftStop {
  key: string;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface DraftGroup {
  key: string;
  provider: ProviderId;
  name: string;
  stops: DraftStop[];
}

interface DraftGroupCardProps {
  group: DraftGroup;
  groupNumber: number;
  onAddStop: (place: PlaceSearchResult) => void;
  onRemoveStop: (stopKey: string) => void;
  onRemoveGroup: () => void;
}

/** Kartu grup saat membuat rute baru: semua titik masih lokal, belum tersimpan. */
export function DraftGroupCard({
  group,
  groupNumber,
  onAddStop,
  onRemoveStop,
  onRemoveGroup,
}: DraftGroupCardProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(group.stops.length === 0);
  const providerMeta = PROVIDERS[group.provider];

  const handleSelect = (place: PlaceSearchResult) => {
    onAddStop(place);
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-white">
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="grid size-6 shrink-0 place-items-center rounded-lg text-[11px] font-extrabold text-white"
            style={{ backgroundColor: providerMeta.color }}
          >
            {groupNumber}
          </span>
          <h3 className="truncate text-[14px] font-bold text-ink">{group.name}</h3>
          <ProviderBadge provider={group.provider} />
        </div>

        <button
          type="button"
          onClick={onRemoveGroup}
          aria-label={`Hapus grup ${group.name}`}
          className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-danger"
        >
          <Trash2 className="size-4" />
        </button>
      </header>

      <div className="px-3 py-3">
        {group.stops.length > 0 ? (
          <ol className="space-y-1.5">
            {group.stops.map((stop, index) => (
              <li
                key={stop.key}
                className="flex items-center gap-2 rounded-xl border border-line bg-white px-2 py-2"
              >
                <span
                  className="grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-extrabold text-white"
                  style={{ backgroundColor: providerMeta.color }}
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-ink">{stop.label}</p>
                  <p className="truncate text-[11.5px] text-slate-500">{stop.address}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveStop(stop.key)}
                  aria-label="Hapus titik"
                  className="grid size-7 shrink-0 place-items-center rounded-lg text-slate-300 hover:bg-rose-50 hover:text-danger"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-xl bg-slate-50 px-3 py-3 text-center text-[12.5px] text-ink-soft">
            Cari lokasi titik pertama di bawah.
          </p>
        )}

        <div className="mt-3">
          {isSearchOpen ? (
            <div className="rounded-xl border border-brand/30 bg-brand-soft/40 p-2.5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11.5px] font-bold uppercase tracking-wide text-brand">
                  Titik ke-{group.stops.length + 1}
                </span>
                {group.stops.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setIsSearchOpen(false)}
                    aria-label="Tutup pencarian"
                    className="grid size-7 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-ink"
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </div>

              <StopSearchField
                onSelect={handleSelect}
                autoFocus={group.stops.length > 0}
                disabled={group.stops.length >= MAX_STOPS_PER_GROUP}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              disabled={group.stops.length >= MAX_STOPS_PER_GROUP}
              className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 text-[13px] font-semibold text-ink-soft transition-colors hover:border-brand hover:bg-brand-soft/40 hover:text-brand disabled:opacity-50"
            >
              <Plus className="size-4" />
              {group.stops.length >= MAX_STOPS_PER_GROUP
                ? `Maksimal ${MAX_STOPS_PER_GROUP} titik`
                : `Tambah titik (${group.stops.length}/${MAX_STOPS_PER_GROUP})`}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
