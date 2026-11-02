import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/utils/cn";

export const inputBaseClasses =
  "w-full rounded-xl border bg-white text-sm text-ink placeholder:text-slate-400 transition-colors " +
  "focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 disabled:bg-slate-50";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  errorMessage?: string;
  leadingIcon?: ReactNode;
  trailingSlot?: ReactNode;
  containerClassName?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  {
    label,
    hint,
    errorMessage,
    leadingIcon,
    trailingSlot,
    containerClassName,
    className,
    id,
    ...restProps
  },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const helperId = `${inputId}-helper`;

  return (
    <div className={cn("w-full", containerClassName)}>
      {label ? (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-[12.5px] font-semibold text-ink-soft"
        >
          {label}
        </label>
      ) : null}

      <div className="relative">
        {leadingIcon ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            {leadingIcon}
          </span>
        ) : null}

        <input
          ref={ref}
          id={inputId}
          aria-invalid={errorMessage ? true : undefined}
          aria-describedby={hint || errorMessage ? helperId : undefined}
          className={cn(
            inputBaseClasses,
            "h-11 px-3",
            leadingIcon && "pl-9",
            trailingSlot && "pr-24",
            errorMessage ? "border-danger/60" : "border-line",
            className,
          )}
          {...restProps}
        />

        {trailingSlot ? (
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2">{trailingSlot}</div>
        ) : null}
      </div>

      {errorMessage ? (
        <p id={helperId} className="mt-1.5 text-[12px] font-medium text-danger">
          {errorMessage}
        </p>
      ) : hint ? (
        <p id={helperId} className="mt-1.5 text-[12px] leading-relaxed text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
