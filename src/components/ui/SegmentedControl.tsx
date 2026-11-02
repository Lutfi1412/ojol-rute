import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

export interface SegmentedOption<TValue extends string> {
  value: TValue;
  label: string;
  icon?: ReactNode;
  accentColor?: string;
}

interface SegmentedControlProps<TValue extends string> {
  options: SegmentedOption<TValue>[];
  value: TValue;
  onChange: (value: TValue) => void;
  ariaLabel: string;
  className?: string;
}

/** Kontrol pilihan berbentuk dua-tiga tombol besar, ramah jempol di HP. */
export function SegmentedControl<TValue extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedControlProps<TValue>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("grid gap-2", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const isSelected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-bold transition-colors",
              isSelected
                ? "border-transparent text-white shadow-sm"
                : "border-line bg-white text-ink-soft hover:bg-slate-50",
            )}
            style={
              isSelected
                ? { backgroundColor: option.accentColor ?? "var(--color-ink)" }
                : undefined
            }
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
