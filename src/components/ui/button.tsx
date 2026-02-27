import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(0,0,0,0.1)] hover:bg-primary/90 active:scale-[0.98]",
  secondary: "bg-muted text-foreground hover:bg-muted/70 active:scale-[0.98]",
  outline: "border border-border/70 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-muted active:scale-[0.98]",
  danger: "bg-destructive text-white shadow-[0_1px_2px_rgba(0,0,0,0.1)] hover:bg-destructive/90 active:scale-[0.98]",
  ghost: "hover:bg-muted active:scale-[0.98]",
};

const sizes = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-[13px]",
  lg: "h-11 px-5 text-sm",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: {
  children: React.ReactNode;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
