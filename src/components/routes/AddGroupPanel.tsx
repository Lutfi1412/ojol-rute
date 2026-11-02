import { useState } from "react";
import { Plus, X } from "lucide-react";
import { MAX_STOPS_PER_GROUP, PROVIDER_LIST, PROVIDERS } from "@/constants/app";
import type { PlaceSearchResult } from "@/types/api.types";
import type { ProviderId } from "@/types/route.types";
import { StopSearchField } from "@/components/common/StopSearchField";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { createId } from "@/utils/id";
import type { DraftStop } from "./DraftGroupCard";

interface AddGroupPanelProps {
  isSaving: boolean;
  disabled: boolean;
  onSave: (payload: {
    provider: ProviderId;
    name?: string;
    stops: Array<Record<string, unknown>>;
  }) => Promise<void>;
}

/** Panel untuk menambah grup ke rute yang sudah ada (order susulan). */
export function AddGroupPanel({ isSaving, disabled, onSave }: AddGroupPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [provider, setProvider] = useState<ProviderId>("grab");
  const [stops, setStops] = useState<DraftStop[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const providerMeta = PROVIDERS[provider];
  const canSubmit = stops.length > 0 && !isSubmitting;

  const reset = () => {
    setStops([]);
    setIsOpen(false);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      await onSave({
        provider,
        stops: stops.map((stop) => ({
          label: stop.label,
          address: stop.address,
          latitude: stop.latitude,
          longitude: stop.longitude,
          note: "",
        })),
      });
      reset();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <Button
        variant="secondary"
        fullWidth
        disabled={disabled}
        onClick={() => setIsOpen(true)}
        leadingIcon={<Plus className="size-4" />}
      >
        Tambah grup / order baru
      </Button>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-brand/30 bg-white">
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h3 className="text-[14px] font-bold text-ink">Grup baru</h3>
        <button
          type="button"
          onClick={reset}
          aria-label="Batal tambah grup"
          className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-ink"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="space-y-3 px-4 py-4">
        <SegmentedControl
          ariaLabel="Provider grup baru"
          value={provider}
          onChange={setProvider}
          options={PROVIDER_LIST.map((item) => ({
            value: item.id,
            label: item.label,
            accentColor: item.color,
          }))}
        />

        {stops.length > 0 ? (
          <ol className="space-y-1.5">
            {stops.map((stop, index) => (
              <li
                key={stop.key}
                className="flex items-center gap-2 rounded-xl border border-line px-2 py-2"
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
                  onClick={() => setStops((current) => current.filter((item) => item.key !== stop.key))}
                  aria-label="Hapus titik"
                  className="grid size-7 place-items-center rounded-lg text-slate-300 hover:bg-rose-50 hover:text-danger"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ol>
        ) : null}

        {stops.length < MAX_STOPS_PER_GROUP ? (
          <StopSearchField
            placeholder={`Cari titik ${stops.length + 1} untuk ${providerMeta.label}`}
            onSelect={(place: PlaceSearchResult) =>
              setStops((current) => [
                ...current,
                {
                  key: createId("draftstop"),
                  label: place.label,
                  address: place.address,
                  latitude: place.latitude,
                  longitude: place.longitude,
                },
              ])
            }
          />
        ) : null}

        <Button
          fullWidth
          onClick={handleSubmit}
          disabled={!canSubmit || isSaving}
          isLoading={isSubmitting}
        >
          Simpan grup ({stops.length} titik)
        </Button>
      </div>
    </section>
  );
}
