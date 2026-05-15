"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  Gavel,
  Upload,
  BarChart3,
  LogOut,
  Users,
} from "lucide-react";
import { clsx } from "clsx";

const navigation = [
  {
    name: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Auctions",
    href: "/dashboard/auctions",
    icon: Gavel,
  },
  {
    name: "Analytics",
    href: "/dashboard/analytics",
    icon: BarChart3,
    children: [
      {
        name: "Year on year",
        href: "/dashboard/analytics",
      },
      {
        name: "Financials",
        href: "/dashboard/analytics/financials",
      },
      {
        name: "Describers",
        href: "/dashboard/analytics/describers",
      },
      {
        name: "Unsold by describer",
        href: "/dashboard/analytics/describers/unsold",
      },
      {
        name: "Buyers & vendors",
        href: "/dashboard/analytics/people",
      },
      {
        name: "Re-offer tracker",
        href: "/dashboard/analytics/reoffers",
      },
    ],
  },
  {
    name: "Upload Data",
    href: "/dashboard/upload",
    icon: Upload,
  },
];

export default function Sidebar({ user }: { user: { email?: string } }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-[#080f1e] border-r border-[#1e3a6b] flex flex-col">

      {/* Logo */}
      <div className="p-6 border-b border-[#1e3a6b]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gold-500/10 border border-gold-500/30 flex items-center justify-center">
            <span className="text-sm font-bold text-gold-400">SG</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#f7f4ec]">SG Auctions</p>
            <p className="text-xs text-[#6687bc]">Dashboard</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <div key={item.name}>
              <Link
                href={item.href}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150",
                  isActive
                    ? "bg-brand-800 text-gold-400 border border-[#2f5597]"
                    : "text-[#94aed6] hover:text-[#f7f4ec] hover:bg-[#1e3a6b]"
                )}
              >
                <item.icon size={18} />
                {item.name}
              </Link>

              {item.children && isActive && (
                <div className="ml-9 mt-1 space-y-1">
                  {item.children.map((child) => {
                    const isChildActive = pathname === child.href;
                    return (
                      <Link
                        key={child.name}
                        href={child.href}
                        className={clsx(
                          "block px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150",
                          isChildActive
                            ? "text-gold-400"
                            : "text-[#6687bc] hover:text-[#f7f4ec]"
                        )}
                      >
                        {child.name}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User / Sign out */}
      <div className="p-4 border-t border-[#1e3a6b]">
        <div className="mb-3 px-3">
          <p className="text-xs text-[#6687bc] truncate">{user.email}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#94aed6] hover:text-red-400 hover:bg-red-900/10 transition-colors duration-150 w-full"
        >
          <LogOut size={18} />
          Sign out
        </button>
      </div>

    </aside>
  );
}
