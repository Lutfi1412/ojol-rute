import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Flag, Plus, Route as RouteIcon, Save } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, SectionTitle } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TextField } from "@/components/ui/TextField";
import { StopSearchField } from "@/components/common/StopSearchField";
import { DraftGroupCard, type DraftGroup } from "@/components/routes/DraftGroupCard";
import { MAX_GROUPS_PER_ROUTE, MAX_STOPS_PER_ROUTE, PROVIDER_LIST, PROVIDERS } from "@/constants/app";
import { isApiError } from "@/services/api/apiError";
import { useRoutesStore } from "@/stores/routes.store";
import type { PlaceSearchResult } from "@/types/api.types";
import type { GeoPoint, ProviderId } from "@/types/route.types";
import { createId } from "@/utils/id";

export function CreateRoutePage() {
  const navigate = useNavigate();
  const createRoute = useRoutesStore((state) => state.createRoute);
  const isSaving = useRoutesStore((state) => state.isSaving);

  const [routeName, setRouteName] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>("grab");
  const [groups, setGroups] = useState<DraftGroup[]>([]);
  const [startPoint, setStartPoint] = useState<GeoPoint | null>(null);
  const [isStartSearchOpen, setIsStartSearchOpen] = useState(false);

  const totalStops = useMemo(
    () => groups.reduce((total, group) => total + group.stops.length, 0),
    [groups],
  );

  const filledGroups = groups.filter((group) => group.stops.length > 0);
  const canSave = filledGroups.length > 0 && !isSaving;

  const addGroup = () => {
    if (groups.length >= MAX_GROUPS_PER_ROUTE) {
      toast.error(`Maksimal ${MAX_GROUPS_PER_ROUTE} grup per rute`);
      return;
    }

    const sameProviderCount = groups.filter((group) => group.provider === selectedProvider).length;
    const providerLabel = PROVIDERS[selectedProvider].label;

    setGroups((current) => [
      ...current,
      {
        key: createId("draftgroup"),
        provider: selectedProvider,
        name:
          sameProviderCount === 0 ? providerLabel : `${providerLabel} ${sameProviderCount + 1}`,
        stops: [],
      },
    ]);
  };

  const addStopToGroup = (groupKey: string, place: PlaceSearchResult) => {
    if (totalStops >= MAX_STOPS_PER_ROUTE) {
      toast.error(`Total titik maksimal ${MAX_STOPS_PER_ROUTE} per rute`);
      return;
    }

    setGroups((current) =>
      current.map((group) =>
        group.key === groupKey
          ? {
              ...group,
              stops: [
                ...group.stops,
                {
                  key: createId("draftstop"),
                  label: place.label,
                  address: place.address,
                  latitude: place.latitude,
                  longitude: place.longitude,
                },
              ],
            }
          : group,
      ),
    );
  };

  const handleSave = async () => {
    if (filledGroups.length === 0) {
      toast.error("Tambahkan minimal satu titik dulu");
      return;
    }

    try {
      const route = await createRoute({
        name: routeName.trim() || undefined,
        startPoint,
        groups: filledGroups.map((group) => ({
          provider: group.provider,
          name: group.name,
          stops: group.stops.map((stop) => ({
            label: stop.label,
            address: stop.address,
            latitude: stop.latitude,
            longitude: stop.longitude,
            note: "",
          })),
        })),
      });

      toast.success("Rute tersimpan");
      navigate(`/rute/${route.id}`, { replace: true });
    } catch (error) {
      toast.error(isApiError(error) ? error.message : "Gagal menyimpan rute");
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Rute baru"
        subtitle="Pilih provider, lalu masukkan titik berurutan sesuai urutan order."
        backTo="/"
      />

      <Card>
        <div className="space-y-4 px-4 py-4">
          <TextField
            label="Nama rute (opsional)"
            placeholder="Contoh: Pagi — Grab + Shopee"
            value={routeName}
            onChange={(event) => setRouteName(event.target.value)}
            maxLength={80}
          />

          <div>
            <p className="mb-1.5 text-[12.5px] font-semibold text-ink-soft">Titik mulai (opsional)</p>
            {startPoint ? (
              <div className="flex items-center gap-2 rounded-xl border border-line bg-slate-50 px-3 py-2">
                <Flag className="size-4 shrink-0 text-brand" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-ink">{startPoint.label}</p>
                  <p className="truncate text-[11.5px] text-slate-500">{startPoint.address}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setStartPoint(null)}>
                  Ganti
                </Button>
              </div>
            ) : isStartSearchOpen ? (
              <StopSearchField
                placeholder="Cari posisi kamu sekarang (kosongkan = mulai dari titik 1)"
                onSelect={(place) => {
                  setStartPoint({
                    label: place.label,
                    address: place.address,
                    latitude: place.latitude,
                    longitude: place.longitude,
                  });
                  setIsStartSearchOpen(false);
                }}
              />
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsStartSearchOpen(true)}
                leadingIcon={<Flag className="size-4" />}
              >
                Tentukan titik mulai
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <div className="space-y-3 px-4 py-4">
          <SectionTitle
            title="1. Pilih provider"
            description="Satu grup = satu batch order dari satu provider."
          />

          <SegmentedControl
            ariaLabel="Pilih provider untuk grup baru"
            value={selectedProvider}
            onChange={setSelectedProvider}
            options={PROVIDER_LIST.map((provider) => ({
              value: provider.id,
              label: provider.label,
              accentColor: provider.color,
            }))}
          />

          <Button
            variant="secondary"
            fullWidth
            onClick={addGroup}
            leadingIcon={<Plus className="size-4" />}
            disabled={groups.length >= MAX_GROUPS_PER_ROUTE}
          >
            Tambah grup {PROVIDERS[selectedProvider].label}
          </Button>

          <p className="text-[11.5px] leading-relaxed text-slate-500">
            Bisa campur: Grab dan Shopee dalam satu rute. Maksimal {MAX_GROUPS_PER_ROUTE} grup,{" "}
            {MAX_STOPS_PER_ROUTE} titik total.
          </p>
        </div>
      </Card>

      {groups.length > 0 ? (
        <div className="space-y-3">
          <SectionTitle
            title="2. Masukkan titik"
            description="Urutan titik di dalam grup mengikuti urutan order dari aplikasi."
          />

          {groups.map((group, index) => (
            <DraftGroupCard
              key={group.key}
              group={group}
              groupNumber={index + 1}
              onAddStop={(place) => addStopToGroup(group.key, place)}
              onRemoveStop={(stopKey) =>
                setGroups((current) =>
                  current.map((item) =>
                    item.key === group.key
                      ? { ...item, stops: item.stops.filter((stop) => stop.key !== stopKey) }
                      : item,
                  ),
                )
              }
              onRemoveGroup={() =>
                setGroups((current) => current.filter((item) => item.key !== group.key))
              }
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-5 py-8 text-center">
          <RouteIcon className="mx-auto size-6 text-slate-400" />
          <p className="mt-2 text-[13px] font-semibold text-ink">Belum ada grup</p>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">
            Tambahkan grup Grab atau Shopee di atas, lalu isi titik-titiknya.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between rounded-2xl border border-line bg-white px-4 py-3">
        <div>
          <p className="text-[12px] font-semibold text-ink-soft">Total titik</p>
          <p className="text-[17px] font-extrabold tabular-nums text-ink">
            {totalStops}
            <span className="ml-1 text-[12px] font-semibold text-slate-400">
              / {MAX_STOPS_PER_ROUTE}
            </span>
          </p>
        </div>

        <Button
          size="lg"
          onClick={handleSave}
          isLoading={isSaving}
          disabled={!canSave}
          leadingIcon={<Save className="size-4" />}
        >
          Simpan rute
        </Button>
      </div>
    </div>
  );
}
