import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/utils/cn";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backTo?: string;
  action?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, backTo, action, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-start gap-2", className)}>
      {backTo ? (
        <Link
          to={backTo}
          aria-label="Kembali"
          className="-ml-1.5 mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl text-ink-soft hover:bg-white"
        >
          <ChevronLeft className="size-5" />
        </Link>
      ) : null}

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[19px] font-extrabold leading-tight tracking-tight text-ink">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-soft">{subtitle}</p>
        ) : null}
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
