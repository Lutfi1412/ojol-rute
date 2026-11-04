import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  Loader2,
  Pencil,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardSection, SectionTitle } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/Badge";
import { TextField } from "@/components/ui/TextField";
import { RouteMap, type MapStop } from "@/components/common/RouteMap";
import { RouteSummary } from "@/components/common/RouteSummary";
import { PlanTimeline } from "@/components/common/PlanTimeline";
import { GroupEditor } from "@/components/routes/GroupEditor";
import { DriverLocationCard } from "@/components/routes/DriverLocationCard";
import { AddGroupPanel } from "@/components/routes/AddGroupPanel";
import { MAX_GROUPS_PER_ROUTE } from "@/constants/app";
import { resolvePlanOrigin } from "@/features/routes/location/planOrigin";
import { useDriverLocation } from "@/hooks/useDriverLocation";
import { isApiError } from "@/services/api/apiError";
import { useRoutesStore } from "@/stores/routes.store";

export function RouteDetailPage() {
  const { routeId = "" } = useParams<{ routeId: string }>();
  const navigate = useNavigate();

  const currentRoute = useRoutesStore((state) => state.currentRoute);
  const plan = useRoutesStore((state) => state.plan);
  const isLoadingRoute = useRoutesStore((state) => state.isLoadingRoute);
  const isPlanning = useRoutesStore((state) => state.isPlanning);
  const isSaving = useRoutesStore((state) => state.isSaving);
  const errorMessage = useRoutesStore((state) => state.errorMessage);

  const loadRoute = useRoutesStore((state) => state.loadRoute);
  const loadPlan = useRoutesStore((state) => state.loadPlan);
  const clearCurrentRoute = useRoutesStore((state) => state.clearCurrentRoute);
  const updateRoute = useRoutesStore((state) => state.updateRoute);
  const deleteRoute = useRoutesStore((state) => state.deleteRoute);
  const addGroup = useRoutesStore((state) => state.addGroup);
  const removeGroup = useRoutesStore((state) => state.removeGroup);
  const addStop = useRoutesStore((state) => state.addStop);
  const removeStop = useRoutesStore((state) => state.removeStop);
  const toggleStopComplete = useRoutesStore((state) => state.toggleStopComplete);
  const reorderStops = useRoutesStore((state) => state.reorderStops);

  const {
    driverFix,
    isLocating: isLocatingDriver,
    errorMessage: driverLocationError,
    refreshDriverLocation,
  } = useDriverLocation();

  // Titik 0 rencana rute: posisi driver sekarang, lalu titik awal rute, lalu stop pertama.
  const planOrigin = useMemo(
    () => resolvePlanOrigin(currentRoute?.startPoint ?? null, driverFix),
    [currentRoute?.startPoint, driverFix],
  );

  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [pendingGroupId, setPendingGroupId] = useState<string | null>(null);

  const lastPlannedKey = useRef<string | null>(null);

  useEffect(() => {
    void loadRoute(routeId);

    return () => {
      clearCurrentRoute();
    };
  }, [routeId, loadRoute, clearCurrentRoute]);

  const planKey = currentRoute
    ? [
        currentRoute.id,
        currentRoute.updatedAt,
        // Posisi ikut jadi kunci: tiap GPS dibaca ulang, rute dihitung ulang dari titik itu.
        planOrigin.point
          ? `${planOrigin.point.latitude.toFixed(5)},${planOrigin.point.longitude.toFixed(5)}`
          : "tanpa-titik-awal",
        driverFix?.capturedAt ?? "tanpa-gps",
      ].join(":")
    : null;

  useEffect(() => {
    if (!currentRoute || currentRoute.id !== routeId) return;
    if (currentRoute.groups.every((group) => group.stops.length === 0)) return;
    // Tunggu pembacaan GPS pertama supaya rute tidak dihitung dua kali.
    if (isLocatingDriver && !driverFix) return;
    if (lastPlannedKey.current === planKey) return;

    lastPlannedKey.current = planKey;
    void loadPlan(routeId, {
      origin: planOrigin.point,
      skipCompletedStops: planOrigin.source === "driver",
    });
  }, [
    currentRoute,
    routeId,
    planKey,
    loadPlan,
    planOrigin.point,
    planOrigin.source,
    isLocatingDriver,
    driverFix,
  ]);

  const allStops = useMemo(
    () => (currentRoute ? currentRoute.groups.flatMap((group) => group.stops) : []),
    [currentRoute],
  );

  const completedStops = allStops.filter((stop) => stop.completedAt !== null).length;

  const mapStops = useMemo<MapStop[]>(() => {
    if (!currentRoute) return [];

    if (plan && plan.steps.length > 0) {
      return plan.steps.map((step) => ({
        id: step.stopId,
        label: step.label,
        address: step.address,
        provider: step.provider,
        latitude: step.latitude,
        longitude: step.longitude,
        visitOrder: step.visitOrder,
        isCompleted: step.completedAt !== null,
      }));
    }

    let runningNumber = 0;

    return currentRoute.groups.flatMap((group) =>
      group.stops.map((stop) => {
        runningNumber += 1;

        return {
          id: stop.id,
          label: stop.label,
          address: stop.address,
          provider: group.provider,
          latitude: stop.latitude,
          longitude: stop.longitude,
          visitOrder: runningNumber,
          isCompleted: stop.completedAt !== null,
        };
      }),
    );
  }, [currentRoute, plan]);

  const runAction = async (action: () => Promise<unknown>, successMessage?: string) => {
    try {
      await action();
      if (successMessage) toast.success(successMessage);
    } catch (error) {
      toast.error(isApiError(error) ? error.message : "Gagal menyimpan perubahan");
    }
  };

  const handleRefreshLocation = async () => {
    const fix = await refreshDriverLocation();

    if (fix) {
      toast.success("Lokasi diperbarui, rute dihitung ulang");
      return;
    }

    toast.warning("Lokasi belum terbaca");

    // Belum pernah dapat posisi sama sekali: pakai titik awal rute yang tersimpan.
    // Kalau posisi lama masih ada, rencana yang berjalan dibiarkan apa adanya.
    if (!driverFix) {
      void loadPlan(routeId, { origin: planOrigin.point });
    }
  };

  const handleRename = async () => {
    if (!currentRoute) return;

    await runAction(async () => {
      await updateRoute(currentRoute.id, { name: nameDraft.trim() });
      setIsRenameOpen(false);
      toast.success("Nama rute diperbarui");
    });
  };

  const handleDeleteRoute = async () => {
    if (!currentRoute) return;

    await runAction(async () => {
      await deleteRoute(currentRoute.id);
      toast.success("Rute dihapus");
    });
    setIsDeleteOpen(false);
    navigate("/", { replace: true });
  };

  if (!currentRoute && isLoadingRoute) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  if (!currentRoute) {
    return (
      <div className="space-y-4">
        <PageHeader title="Rute tidak ditemukan" backTo="/" />
        <div className="rounded-2xl border border-line bg-white px-4 py-8 text-center">
          <AlertTriangle className="mx-auto size-6 text-amber-500" />
          <p className="mt-2 text-[13px] text-ink-soft">
            {errorMessage ?? "Rute ini sudah dihapus atau belum tersimpan di perangkat ini."}
          </p>
          <Link to="/" className="mt-4 inline-block">
            <Button variant="secondary" size="sm">
              Kembali ke daftar rute
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const pendingGroup = currentRoute.groups.find((group) => group.id === pendingGroupId);

  return (
    <div className="space-y-4">
      <PageHeader
        title={currentRoute.name}
        subtitle={`${currentRoute.groups.length} grup · ${allStops.length} titik · ${completedStops} selesai`}
        backTo="/"
        action={
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setNameDraft(currentRoute.name);
                setIsRenameOpen(true);
              }}
              aria-label="Ubah nama rute"
              className="grid size-9 place-items-center rounded-xl text-ink-soft hover:bg-white"
            >
              <Pencil className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsDeleteOpen(true)}
              aria-label="Hapus rute"
              className="grid size-9 place-items-center rounded-xl text-slate-400 hover:bg-white hover:text-danger"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        }
      />

      <div className="flex items-center gap-2">
        <StatusBadge status={currentRoute.status} />
        <div className="flex-1">
          <ProgressBar value={completedStops} max={Math.max(allStops.length, 1)} />
        </div>
        <span className="text-[11.5px] font-bold tabular-nums text-ink-soft">
          {Math.round((completedStops / Math.max(allStops.length, 1)) * 100)}%
        </span>
      </div>

      <DriverLocationCard
        driverFix={driverFix}
        isLocating={isLocatingDriver}
        errorMessage={driverLocationError}
        origin={planOrigin.point}
        distanceToFirstStopMeters={plan?.steps[0]?.legDistanceMeters ?? null}
        skippedCompletedStops={
          planOrigin.source === "driver" && plan
            ? Math.max(
                completedStops - plan.steps.filter((step) => step.completedAt !== null).length,
                0,
              )
            : 0
        }
        onRefresh={() => void handleRefreshLocation()}
      />

      <RouteMap stops={mapStops} startPoint={planOrigin.point} plan={plan} />

      <RouteSummary
        plan={plan}
        totalStops={allStops.length}
        completedStops={completedStops}
        isPlanning={isPlanning}
      />

      <Card>
        <CardSection className="space-y-3">
          <SectionTitle
            title="Urutan kunjungan"
            description="Grup dijalankan berurutan di dalam provider, lalu diselang-seling untuk jarak terdekat."
            action={
              <button
                type="button"
                onClick={() => void handleRefreshLocation()}
                disabled={isPlanning || isLocatingDriver}
                aria-label="Baca ulang lokasi lalu hitung rute"
                className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-ink disabled:opacity-50"
              >
                {isPlanning ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
              </button>
            }
          />

          {plan && plan.steps.length > 0 ? (
            <PlanTimeline
              plan={plan}
              startPoint={planOrigin.point}
              isSaving={isSaving}
              onToggleStop={(groupId, stopId) =>
                void runAction(() => toggleStopComplete(routeId, groupId, stopId))
              }
            />
          ) : isPlanning ? (
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-6 text-[13px] text-ink-soft">
              <Loader2 className="size-4 animate-spin" />
              Menghitung rute terbaik…
            </div>
          ) : isLocatingDriver && !driverFix ? (
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-6 text-[13px] text-ink-soft">
              <Loader2 className="size-4 animate-spin" />
              Membaca lokasi Anda dulu, lalu rute dihitung dari titik itu…
            </div>
          ) : (
            <p className="rounded-xl bg-amber-50 px-3 py-3 text-[12.5px] leading-relaxed text-amber-800">
              Rute belum bisa dihitung. Tambahkan minimal satu titik, lalu tekan tombol hitung
              ulang.
            </p>
          )}
        </CardSection>
      </Card>

      <div className="space-y-3">
        <SectionTitle
          title="Grup & titik"
          description="Tambah order baru, geser urutan, atau tandai titik selesai."
          action={
            <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-slate-500">
              <Users className="size-3.5" />
              {currentRoute.groups.length} grup
            </span>
          }
        />

        {currentRoute.groups.map((group) => (
          <GroupEditor
            key={group.id}
            group={group}
            isSaving={isSaving}
            canRemoveGroup={currentRoute.groups.length > 1}
            onAddStop={(payload) => runAction(() => addStop(routeId, group.id, payload))}
            onRemoveStop={(stopId) =>
              void runAction(() => removeStop(routeId, group.id, stopId), "Titik dihapus")
            }
            onToggleStop={(stopId) =>
              void runAction(() => toggleStopComplete(routeId, group.id, stopId))
            }
            onReorder={(stopIds) =>
              void runAction(() => reorderStops(routeId, group.id, stopIds))
            }
            onRemoveGroup={() => setPendingGroupId(group.id)}
          />
        ))}

        <AddGroupPanel
          isSaving={isSaving}
          disabled={currentRoute.groups.length >= MAX_GROUPS_PER_ROUTE}
          onSave={async (payload) => {
            await runAction(
              () => addGroup(routeId, payload),
              "Grup baru ditambahkan, rute dihitung ulang",
            );
          }}
        />

        {currentRoute.groups.length >= MAX_GROUPS_PER_ROUTE ? (
          <p className="px-1 text-[11.5px] text-slate-500">
            Maksimal {MAX_GROUPS_PER_ROUTE} grup per rute. Selesaikan rute ini lalu buat rute baru untuk order
            berikutnya.
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-line bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[12.5px] font-semibold text-ink">Hapus rute</p>
            <p className="text-[11.5px] leading-relaxed text-slate-500">
              Semua grup & titik di rute ini ikut terhapus.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsDeleteOpen(true)}
            className="shrink-0 text-danger"
          >
            Hapus
          </Button>
        </div>
      </div>

      <Modal
        open={isRenameOpen}
        onClose={() => setIsRenameOpen(false)}
        title="Ubah nama rute"
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setIsRenameOpen(false)}>
              Batal
            </Button>
            <Button fullWidth onClick={handleRename} isLoading={isSaving} disabled={!nameDraft.trim()}>
              Simpan
            </Button>
          </>
        }
      >
        <TextField
          label="Nama rute"
          value={nameDraft}
          onChange={(event) => setNameDraft(event.target.value)}
          maxLength={80}
          autoFocus
        />
      </Modal>

      <ConfirmDialog
        open={isDeleteOpen}
        title="Hapus rute ini?"
        description="Rute, grup, dan semua titiknya akan hilang dari perangkat ini."
        confirmLabel="Ya, hapus rute"
        isDestructive
        isLoading={isSaving}
        onConfirm={() => void handleDeleteRoute()}
        onCancel={() => setIsDeleteOpen(false)}
      />

      <ConfirmDialog
        open={pendingGroup !== undefined}
        title={`Hapus grup ${pendingGroup?.name ?? ""}?`}
        description="Titik di dalam grup ini ikut terhapus. Urutan rute akan dihitung ulang."
        confirmLabel="Ya, hapus grup"
        isDestructive
        isLoading={isSaving}
        onConfirm={() => {
          if (!pendingGroup) return;

          void runAction(() => removeGroup(routeId, pendingGroup.id), "Grup dihapus")
            .then(() => setPendingGroupId(null));
        }}
        onCancel={() => setPendingGroupId(null)}
      />
    </div>
  );
}
