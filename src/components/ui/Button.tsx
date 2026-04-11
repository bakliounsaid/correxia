import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const variants = {
  primary:
    "bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700 disabled:bg-primary-200",
  secondary:
    "bg-primary-50 text-primary-600 hover:bg-primary-100 active:bg-primary-100 disabled:bg-primary-50 disabled:text-primary-200",
  outline:
    "border border-gray-800 bg-transparent text-gray-900 hover:bg-gray-900 hover:text-white active:bg-gray-800 disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-300",
  ghost:
    "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-50",
  link: "text-gray-900 underline-offset-4 hover:text-primary-500 active:text-primary-700 disabled:text-gray-300",
  success:
    "bg-success-500 text-white hover:bg-success-600 active:opacity-90 disabled:opacity-40",
} as const;

type Variant = keyof typeof variants;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
  loadingText?: string;
  loaderClassName?: string;
  children: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      type = "button",
      loading = false,
      loadingText,
      loaderClassName,
      disabled,
      children,
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:cursor-not-allowed",
        variants[variant],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className={cn("h-4 w-4 animate-spin", loaderClassName)} />}
      {loading && loadingText ? loadingText : children}
    </button>
  ),
);
Button.displayName = "Button";
