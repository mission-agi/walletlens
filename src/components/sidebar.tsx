"use client";

import {
  LayoutDashboard,
  Building2,
  Upload,
  List,
  BarChart3,
  CalendarRange,
  TrendingUp,
  Users,
  Settings,
  Bug,
} from "lucide-react";
import { NavLink } from "./nav-link";
import { ProfileSwitcher } from "./profile/profile-switcher";
import { FeedbackWidget } from "./feedback-widget";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Accounts", href: "/accounts", icon: Building2 },
  { name: "Upload", href: "/upload", icon: Upload },
  { name: "Transactions", href: "/transactions", icon: List },
  { name: "Portfolio", href: "/portfolio", icon: TrendingUp },
  { name: "Reports", href: "/reports", icon: BarChart3 },
  { name: "Annual", href: "/annual", icon: CalendarRange },
  { name: "Household", href: "/household", icon: Users },
  { name: "Settings", href: "/settings", icon: Settings },
];

interface ActiveUser {
  id: string;
  name: string;
  avatarColor: string;
}

export function Sidebar({ activeUser }: { activeUser?: ActiveUser | null }) {
  return (
    <>
      {/* Desktop sidebar — dark, minimal */}
      <aside
        className="hidden md:flex md:w-[220px] md:flex-col md:shrink-0"
        style={{ background: '#111111' }}
      >
        <div
          className="flex h-14 items-center gap-2.5 px-5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div
            className="flex h-7 w-7 items-center justify-center rounded-md"
            style={{ background: '#1a6b4a' }}
          >
            <span className="text-[11px] font-bold text-white">W</span>
          </div>
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-white">
            WalletLens
          </span>
        </div>

        <nav className="flex-1 space-y-0.5 px-2.5 py-3">
          {navigation.map((item) => (
            <NavLink key={item.href} href={item.href} icon={item.icon}>
              {item.name}
            </NavLink>
          ))}
          <div className="mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <FeedbackWidget />
          </div>
        </nav>

        <div
          className="px-2.5 py-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
        >
          <ProfileSwitcher activeUser={activeUser || null} />
        </div>
      </aside>

      {/* Mobile bottom tabs — horizontally scrollable to show all pages */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex overflow-x-auto border-t border-border bg-card md:hidden">
        {navigation.map((item) => (
          <NavLink key={item.href} href={item.href} icon={item.icon} mobile>
            {item.name}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
