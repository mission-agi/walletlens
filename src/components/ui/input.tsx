import { cn } from "@/lib/utils";

export function Input({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-lg border border-border/70 bg-card px-3 text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
        className
      )}
      {...props}
    />
  );
}
