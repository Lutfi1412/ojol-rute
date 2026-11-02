import { useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { MAX_STOPS_PER_GROUP, PROVIDERS } from "@/constants/app";
import type { PlaceSearchResult } from "@/types/api.types";
import type { RouteGroup } from "@/types/route.types";
import { StopSearchField } from "@/components/common/StopSearchField";
import { ProviderBadge } from "@/components/common/ProviderBadge";
import { StopRow } from "./StopRow";

interface GroupEditorProps {
  group: RouteGroup;
  isSaving: boolean;
  canRemoveGroup: boolean;
  onAddStop: (payload: Record<string, unknown>) => Promise<unknown>;
  onRemoveStop: (stopId: string) => void;
  onToggleStop: (stopId: string) => void;
  onReorder: (stopIds: string[]) => void;
  onRemoveGroup: () => void;
}

export function GroupEditor({
  group,
  isSaving,
  canRemoveGroup,
  onAddStop,
  onRemoveStop,
  onToggleStop,
  onReorder,
  onRemoveGroup,
}: GroupEditorProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingStop, setIsAddingStop] = useState(false);
  const providerMeta = PROVIDERS[group.provider];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const isFull = group.stops.length >= MAX_STOPS_PER_GROUP;

  const handleAddStop = async (place: PlaceSearchResult) => {
    setIsAddingStop(true);

    try {
      await onAddStop({
        label: place.label,
        address: place.address,
        latitude: place.latitude,
        longitude: place.longitude,
        note: "",
      });
    } finally {
      setIsAddingStop(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = group.stops.findIndex((stop) => stop.id === active.id);
    const newIndex = group.stops.findIndex((stop) => stop.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    onReorder(arrayMove(group.stops, oldIndex, newIndex).map((stop) => stop.id));
  };

  return (
    <section
      className="overflow-hidden rounded-2xl border border-line bg-white"
      aria-label={`Grup ${group.name}`}
    >
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: providerMeta.color }}
          />
          <h3 className="truncate text-[14px] font-bold text-ink">{group.name}</h3>
          <ProviderBadge provider={group.provider} />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <span className="text-[11.5px] font-semibold tabular-nums text-slate-400">
            {group.stops.length}/{MAX_STOPS_PER_GROUP}
          </span>
          {canRemoveGroup ? (
            <button
              type="button"
              onClick={onRemoveGroup}
              disabled={isSaving}
              aria-label={`Hapus grup ${group.name}`}
              className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-danger"
            >
              <Trash2 className="size-4" />
            </button>
          ) : null}
        </div>
      </header>

      <div className="px-3 py-3">
        {group.stops.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-[12.5px] text-ink-soft">
            Belum ada titik. Tambahkan titik pertama di bawah.
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={group.stops.map((stop) => stop.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-1.5">
                {group.stops.map((stop, index) => (
                  <StopRow
                    key={stop.id}
                    stop={stop}
                    index={index}
                    providerColor={providerMeta.color}
                    isDisabled={isSaving}
                    onRemove={() => onRemoveStop(stop.id)}
                    onToggleComplete={() => onToggleStop(stop.id)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        {group.stops.length > 1 ? (
          <p className="mt-2 px-1 text-[11px] text-slate-400">
            Geser ikon titik-titik di kiri untuk mengubah urutan atau menyisipkan titik baru.
          </p>
        ) : null}

        <div className="mt-3">
          {isAdding ? (
            <div className="rounded-xl border border-brand/30 bg-brand-soft/40 p-2.5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11.5px] font-bold uppercase tracking-wide text-brand">
                  Titik ke-{group.stops.length + 1}
                </span>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  aria-label="Tutup pencarian"
                  className="grid size-7 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-ink"
                >
                  <X className="size-4" />
                </button>
              </div>

              <StopSearchField
                onSelect={(place) => {
                  void handleAddStop(place);
                }}
                autoFocus
                disabled={isAddingStop || isSaving}
              />

              <p className="mt-2 px-1 text-[11px] leading-relaxed text-ink-soft">
                {isAddingStop
                  ? "Menyimpan titik…"
                  : "Pilih lokasi, langsung tersimpan. Kolom tetap terbuka untuk titik berikutnya."}
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              disabled={isFull || isSaving}
              className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 text-[13px] font-semibold text-ink-soft transition-colors hover:border-brand hover:bg-brand-soft/40 hover:text-brand disabled:opacity-50"
            >
              {isAddingStop ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              {isFull ? `Maksimal ${MAX_STOPS_PER_GROUP} titik per grup` : "Tambah titik"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
