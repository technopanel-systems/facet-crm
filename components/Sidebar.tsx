"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import clsx from "clsx";

type NavItem = { label: string; href: string; icon: React.ReactNode };

function Icon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const managerNav: NavItem[] = [
  { label: "Dashboard",   href: "/dashboard",            icon: <Icon d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /> },
  { label: "Companies",   href: "/dashboard/companies",  icon: <Icon d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8" /> },
  { label: "Projects",    href: "/dashboard/projects",   icon: <Icon d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /> },
  { label: "Activities",  href: "/dashboard/activities", icon: <Icon d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /> },
  { label: "Team",        href: "/dashboard/team",       icon: <Icon d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /> },
  { label: "Notifications",href: "/dashboard/notifications",icon: <Icon d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" /> },
];

const repNav: NavItem[] = [
  { label: "Daily Report",  href: "/rep",              icon: <Icon d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /> },
  { label: "My Companies",  href: "/rep/companies",    icon: <Icon d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8" /> },
  { label: "My Projects",   href: "/rep/projects",     icon: <Icon d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /> },
  { label: "My Stats",      href: "/rep/stats",        icon: <Icon d="M18 20V10M12 20V4M6 20v-6" /> },
  { label: "Notifications", href: "/rep/notifications",icon: <Icon d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" /> },
];

const coordinatorNav: NavItem[] = [
  { label: "Companies",   href: "/dashboard/companies",   icon: <Icon d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8" /> },
  { label: "Projects",    href: "/dashboard/projects",    icon: <Icon d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /> },
  { label: "Quotations",  href: "/dashboard/quotations",  icon: <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /> },
  { label: "Notifications",href: "/dashboard/notifications",icon: <Icon d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" /> },
];

const marketingNav: NavItem[] = [
  { label: "Daily Report",  href: "/rep",              icon: <Icon d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /> },
  { label: "My Companies",  href: "/rep/companies",    icon: <Icon d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8" /> },
  { label: "My Projects",   href: "/rep/projects",     icon: <Icon d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /> },
];

export type SidebarRole = "manager" | "rep" | "sales_coordinator" | "marketing";

const NAV_MAP: Record<SidebarRole, NavItem[]> = {
  manager: managerNav,
  rep: repNav,
  sales_coordinator: coordinatorNav,
  marketing: marketingNav,
};

const ROLE_LABELS: Record<SidebarRole, string> = {
  manager: "Manager",
  rep: "Sales Rep",
  sales_coordinator: "Coordinator",
  marketing: "Marketing",
};

interface SidebarProps {
  role: SidebarRole;
  repName: string;
}

export default function Sidebar({ role, repName }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const nav = NAV_MAP[role] ?? repNav;
  
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    async function loadUnread() {
      const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('is_read', false);
      setUnreadCount(count ?? 0);
    }
    loadUnread();

    // Subscribe to new notifications in real-time
    const channel = supabase.channel('realtime_notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        loadUnread();
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="w-60 min-h-screen bg-brand-navy flex flex-col fixed left-0 top-0 bottom-0 z-40">
      <div className="px-5 py-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-blue rounded-lg flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5"/>
            </svg>
          </div>
          <div>
            <div className="text-white font-bold text-base leading-none">FACET</div>
            <div className="text-gray-400 text-xs mt-0.5">Technopanel CRM</div>
          </div>
        </div>
      </div>

      <div className="px-5 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-brand-blue/30 flex items-center justify-center text-xs font-bold text-brand-blue flex-shrink-0">
            {repName.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <div className="text-white text-xs font-medium truncate">{repName}</div>
            <div className="text-gray-400 text-xs">{ROLE_LABELS[role]}</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(item => {
          const active = pathname === item.href || (item.href !== "/rep" && item.href !== "/dashboard" && pathname.startsWith(item.href));
          const isNotification = item.label === "Notifications";
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                active ? "bg-brand-blue text-white" : "text-gray-400 hover:text-white hover:bg-white/10"
              )}
            >
              <div className="flex items-center gap-3">
                {item.icon}
                {item.label}
              </div>
              {isNotification && unreadCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/10 transition-all w-full"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  );
}
