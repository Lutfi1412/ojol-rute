import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "grab" | "shopee";
type ButtonSize = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-ink text-white hover:bg-slate-800 active:bg-slate-900 disabled:bg-slate-400",
  secondary:
    "bg-white text-ink border border-line hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100",
  ghost: "bg-transparent text-ink-soft hover:bg-slate-100 hover:text-ink",
  danger: "bg-danger text-white hover:bg-rose-700 active:bg-rose-800",
  grab: "bg-grab text-white hover:brightness-95 active:brightness-90",
  shopee: "bg-shopee text-white hover:brightness-95 active:brightness-90",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-[13px] gap-1.5 rounded-xl",
  md: "h-11 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-5 text-[15px] gap-2 rounded-2xl",
  icon: "h-10 w-10 rounded-xl justify-center",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    isLoading = false,
    leadingIcon,
    trailingIcon,
    fullWidth = false,
    className,
    children,
    disabled,
    type = "button",
    ...restProps
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      className={cn(
        "inline-flex items-center font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-70",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && "w-full justify-center",
        className,
      )}
      {...restProps}
    >
      {isLoading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        leadingIcon
      )}
      {children}
      {!isLoading && trailingIcon}
    </button>
  );
});
