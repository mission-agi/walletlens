import { cn } from "@/lib/utils";

export function Select({
  className = "",
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-9 rounded-lg border border-border/70 bg-card px-2.5 text-[13px] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
        className
      )}
      {...props}
    />
  );
}
