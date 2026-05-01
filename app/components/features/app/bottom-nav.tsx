"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Camera, Home, MapPin, Settings, User, Users } from "lucide-react";

interface BottomNavProps {
  userId: string;
  isAdmin: boolean;
}

interface TabDef {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: (pathname: string) => boolean;
  highlight?: boolean;
}

export function BottomNav({ userId, isAdmin }: BottomNavProps) {
  const pathname = usePathname();

  const tabs: TabDef[] = [
    {
      href: "/feed",
      label: "Feed",
      icon: Home,
      isActive: (p) => p === "/feed" || p.startsWith("/feed/"),
    },
    {
      href: "/people",
      label: "Personen",
      icon: Users,
      isActive: (p) => p === "/people" || p.startsWith("/people/"),
    },
    {
      href: "/map",
      label: "Karte",
      icon: MapPin,
      isActive: (p) => p === "/map" || p.startsWith("/map/"),
    },
    {
      href: "/upload",
      label: "Upload",
      icon: Camera,
      highlight: true,
      isActive: (p) => p === "/upload" || p.startsWith("/upload/"),
    },
    {
      href: `/profile/${userId}`,
      label: "Profil",
      icon: User,
      isActive: (p) => p.startsWith("/profile"),
    },
  ];

  if (isAdmin) {
    tabs.push({
      href: "/admin",
      label: "Admin",
      icon: Settings,
      isActive: (p) => p === "/admin" || p.startsWith("/admin/"),
    });
  }

  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur"
    >
      <ul className="mx-auto flex max-w-md items-end justify-between gap-1 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {tabs.map((tab) => {
          const active = tab.isActive(pathname);
          const Icon = tab.icon;

          if (tab.highlight) {
            return (
              <li key={tab.href} className="flex flex-1 justify-center">
                <Link
                  href={tab.href}
                  aria-label={tab.label}
                  aria-current={active ? "page" : undefined}
                  className={`-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg shadow-orange-500/30 transition-colors hover:bg-orange-400 ${
                    active ? "ring-4 ring-orange-500/40" : ""
                  }`}
                >
                  <Icon className="h-6 w-6" />
                </Link>
              </li>
            );
          }

          return (
            <li key={tab.href} className="flex flex-1 justify-center">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[44px] min-w-[56px] flex-col items-center justify-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
                  active
                    ? "text-orange-400"
                    : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
