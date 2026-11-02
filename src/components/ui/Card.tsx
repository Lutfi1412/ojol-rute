import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/utils/cn";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ className, children, ...restProps }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        className,
      )}
      {...restProps}
    >
      {children}
    </div>
  );
}

interface CardSectionProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function CardSection({ className, children, ...restProps }: CardSectionProps) {
  return (
    <div className={cn("px-4 py-4 sm:px-5", className)} {...restProps}>
      {children}
    </div>
  );
}

interface SectionTitleProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function SectionTitle({ title, description, action }: SectionTitleProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-[15px] font-bold tracking-tight text-ink">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-soft">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
