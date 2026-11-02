import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-slate-100 text-ink-soft">
        {icon}
      </div>
      <h3 className="mt-4 text-[15px] font-bold text-ink">{title}</h3>
      <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-ink-soft">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
