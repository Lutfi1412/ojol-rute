import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Map, Plus, Route as RouteIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { RouteCard } from "@/components/routes/RouteCard";
import { RouteCardSkeleton } from "@/components/ui/Skeleton";
import { useRoutesStore } from "@/stores/routes.store";

export function RoutesListPage() {
  const routes = useRoutesStore((state) => state.routes);
  const isLoading = useRoutesStore((state) => state.isLoadingList);
  const errorMessage = useRoutesStore((state) => state.errorMessage);
  const loadRoutes = useRoutesStore((state) => state.loadRoutes);

  useEffect(() => {
    void loadRoutes();
  }, [loadRoutes]);

  const stats = useMemo(() => {
    const activeCount = routes.filter((route) => route.status === "active").length;
    const completedCount = routes.filter((route) => route.status === "completed").length;

    return { total: routes.length, activeCount, completedCount };
  }, [routes]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Rute saya"
        subtitle="Gabungkan order Grab & Shopee dalam satu perjalanan."
        action={
          <Link to="/rute/baru">
            <Button size="sm" leadingIcon={<Plus className="size-4" />}>
              Rute
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Rute", value: stats.total },
          { label: "Berjalan", value: stats.activeCount },
          { label: "Selesai", value: stats.completedCount },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-line bg-white px-3 py-3 text-center"
          >
            <p className="text-[20px] font-extrabold leading-none tabular-nums text-ink">
              {item.value}
            </p>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              {item.label}
            </p>
          </div>
        ))}
      </div>

      {errorMessage ? (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-600" />
          <div>
            <p className="text-[13px] font-semibold text-rose-800">{errorMessage}</p>
            <button
              type="button"
              onClick={() => void loadRoutes()}
              className="mt-1 text-[12px] font-bold text-rose-700 underline"
            >
              Coba lagi
            </button>
          </div>
        </div>
      ) : null}

      {isLoading && routes.length === 0 ? (
        <div className="space-y-2.5">
          <RouteCardSkeleton />
          <RouteCardSkeleton />
          <RouteCardSkeleton />
        </div>
      ) : routes.length === 0 ? (
        <EmptyState
          icon={<Map className="size-6" />}
          title="Belum ada rute"
          description="Buat rute pertama: pilih Grab atau Shopee, lalu masukkan titik-titik order secara berurutan."
          action={
            <Link to="/rute/baru">
              <Button leadingIcon={<Plus className="size-4" />}>Buat rute pertama</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-2.5">
          {routes.map((route) => (
            <RouteCard key={route.id} route={route} />
          ))}
        </div>
      )}

      <Link
        to="/rute/baru"
        className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3.5"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
          <RouteIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-ink">Tambah order di tengah jalan?</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">
            Buka rute yang sedang jalan, lalu tambahkan titik atau grup baru.
          </p>
        </div>
        <ArrowRight className="size-4 shrink-0 text-slate-300" />
      </Link>
    </div>
  );
}
