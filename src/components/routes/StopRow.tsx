import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical, Trash2 } from "lucide-react";
import { PROVIDERS } from "@/constants/app";
import type { RouteStop } from "@/types/route.types";
import { cn } from "@/utils/cn";

interface StopRowProps {
  stop: RouteStop;
  index: number;
  providerColor: string;
  isDisabled: boolean;
  onRemove: () => void;
  onToggleComplete: () => void;
}

export function StopRow({
  stop,
  index,
  providerColor,
  isDisabled,
  onRemove,
  onToggleComplete,
}: StopRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stop.id,
    disabled: isDisabled,
  });

  const isCompleted = stop.completedAt !== null;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-start gap-2 rounded-xl border border-line bg-white px-2 py-2",
        isDragging && "z-10 border-brand/40 shadow-lg",
      )}
    >
      <button
        type="button"
        className="mt-0.5 grid size-7 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-slate-300 hover:bg-slate-50 hover:text-slate-500 active:cursor-grabbing"
        aria-label={`Geser titik ${index + 1}`}
        disabled={isDisabled}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>

      <span
        className="mt-1 grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-extrabold text-white"
        style={{ backgroundColor: isCompleted ? "#94a3b8" : providerColor }}
      >
        {index + 1}
      </span>

      <div className="min-w-0 flex-1 py-0.5">
        <p
          className={cn(
            "truncate text-[13px] font-semibold text-ink",
            isCompleted && "text-slate-400 line-through",
          )}
        >
          {stop.label}
        </p>
        <p className="truncate text-[11.5px] text-slate-500">{stop.address}</p>
      </div>

      <div className="flex shrink-0 items-center">
        <button
          type="button"
          onClick={onToggleComplete}
          disabled={isDisabled}
          aria-label={isCompleted ? "Batalkan selesai" : "Tandai selesai"}
          className={cn(
            "grid size-7 place-items-center rounded-lg transition-colors",
            isCompleted
              ? "bg-emerald-500 text-white"
              : "text-slate-300 hover:bg-slate-50 hover:text-emerald-500",
          )}
        >
          <Check className="size-4" strokeWidth={3} />
        </button>

        <button
          type="button"
          onClick={onRemove}
          disabled={isDisabled}
          aria-label="Hapus titik"
          className="grid size-7 place-items-center rounded-lg text-slate-300 hover:bg-rose-50 hover:text-danger"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </li>
  );
}

export function StopProviderLabel({ provider }: { provider: keyof typeof PROVIDERS }) {
  return (
    <span className="text-[11.5px] font-bold" style={{ color: PROVIDERS[provider].color }}>
      {PROVIDERS[provider].label}
    </span>
  );
}
