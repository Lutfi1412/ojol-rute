import { PROVIDERS } from "@/constants/app";
import type { ProviderId } from "@/types/route.types";
import { cn } from "@/utils/cn";

interface ProviderBadgeProps {
  provider: ProviderId;
  size?: "sm" | "md";
  className?: string;
}

export function ProviderBadge({ provider, size = "sm", className }: ProviderBadgeProps) {
  const meta = PROVIDERS[provider];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-bold",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        className,
      )}
      style={{ backgroundColor: meta.softColor, color: meta.color }}
    >
      <span
        aria-hidden="true"
        className="size-1.5 rounded-full"
        style={{ backgroundColor: meta.color }}
      />
      {meta.label}
    </span>
  );
}

export function ProviderAvatar({ provider }: { provider: ProviderId }) {
  const meta = PROVIDERS[provider];

  return (
    <span
      className="grid size-7 place-items-center rounded-lg text-[11px] font-extrabold text-white"
      style={{ backgroundColor: meta.color }}
      aria-label={meta.label}
    >
      {meta.shortLabel}
    </span>
  );
}
