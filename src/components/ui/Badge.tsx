import type { ReactNode } from "react";
import { ROUTE_STATUS_LABEL } from "@/constants/app";
import type { RouteStatus } from "@/types/route.types";
import { cn } from "@/utils/cn";

interface BadgeProps {
  children: ReactNode;
  tone?: "neutral" | "brand" | "success" | "warning" | "danger";
  className?: string;
}

const toneClasses: Record<NonNullable<BadgeProps["tone"]>, string> = {
  neutral: "bg-slate-100 text-slate-600",
  brand: "bg-brand-soft text-brand",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-rose-50 text-rose-700",
};

export function Badge({ children, tone = "neutral", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const statusTone: Record<RouteStatus, NonNullable<BadgeProps["tone"]>> = {
  draft: "neutral",
  active: "brand",
  completed: "success",
};

export function StatusBadge({ status }: { status: RouteStatus }) {
  return <Badge tone={statusTone[status]}>{ROUTE_STATUS_LABEL[status]}</Badge>;
}
