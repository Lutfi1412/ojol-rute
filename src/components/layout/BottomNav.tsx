import { NavLink } from "react-router-dom";
import { Plus, Route } from "lucide-react";
import { cn } from "@/utils/cn";

const navItems = [
  { to: "/", label: "Rute", icon: Route, end: true },
  { to: "/rute/baru", label: "Tambah", icon: Plus, end: false },
] as const;

/** Navigasi bawah khusus layar HP; di desktop tetap tampil supaya konsisten. */
export function BottomNav() {
  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur"
    >
      <div className="safe-bottom mx-auto flex max-w-lg items-stretch px-2 pt-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[11px] font-bold transition-colors",
                isActive ? "text-brand" : "text-slate-400 hover:text-slate-600",
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    "grid h-8 w-12 place-items-center rounded-full transition-colors",
                    isActive && "bg-brand-soft",
                  )}
                >
                  <item.icon className="size-[18px]" strokeWidth={isActive ? 2.5 : 2} />
                </span>
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
