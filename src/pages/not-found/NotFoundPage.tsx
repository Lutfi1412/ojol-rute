import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";

export function NotFoundPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Halaman tidak ada" backTo="/" />

      <div className="rounded-2xl border border-line bg-white px-5 py-10 text-center">
        <Compass className="mx-auto size-7 text-slate-400" />
        <p className="mt-3 text-[14px] font-bold text-ink">Alamat ini tidak dikenal</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
          Mungkin tautannya salah atau rutenya sudah dihapus.
        </p>
        <Link to="/" className="mt-5 inline-block">
          <Button size="sm">Kembali ke daftar rute</Button>
        </Link>
      </div>
    </div>
  );
}
