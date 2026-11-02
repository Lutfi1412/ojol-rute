import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import { BottomNav } from "./BottomNav";

interface AppShellProps {
  children: ReactNode;
  engineLabel: string;
}

export function AppShell({ children, engineLabel }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="safe-top sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-xl bg-ink text-white">
              <MapPin className="size-4" strokeWidth={2.5} />
            </span>
            <span className="text-[14.5px] font-extrabold tracking-tight text-ink">
              Rute Ojol
            </span>
          </Link>

          <span className="rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-semibold text-ink-soft">
            {engineLabel}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg px-4 pb-28 pt-4">{children}</main>

      <BottomNav />
    </div>
  );
}
