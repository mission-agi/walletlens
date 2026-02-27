"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({
  href,
  children,
  icon: Icon,
  mobile,
}: {
  href: string;
  children: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  mobile?: boolean;
}) {
  const pathname = usePathname();
  const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

  if (mobile) {
    return (
      <Link
        href={href}
        className={cn(
          "flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium",
          isActive ? "text-primary" : "text-muted-foreground"
        )}
      >
        <Icon className="h-5 w-5" />
        <span>{children}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] font-medium",
        isActive
          ? "text-white"
          : "text-[#888] hover:text-[#ccc]"
      )}
      style={isActive ? { background: 'rgba(26, 107, 74, 0.25)' } : undefined}
    >
      <Icon className={cn("h-[16px] w-[16px]", isActive && "text-[#2dd4a0]")} />
      <span>{children}</span>
    </Link>
  );
}
