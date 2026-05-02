"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Settings } from "lucide-react";
import { AdminTabs } from "@/components/features/admin/admin-tabs";
import { StandardSettingsSection } from "@/components/features/settings/standard-settings-section";
import type { AdminDashboardData } from "@/lib/admin/load-dashboard-data";

type MainTab = "admin" | "einstellungen";

function tabFromQuery(raw: string | null): MainTab {
  if (raw === "admin") return "admin";
  return "einstellungen";
}

type SettingsShellProps =
  | {
      isAdmin: true;
      initialMainTab: MainTab;
      currentUserId: string;
      adminData: AdminDashboardData;
    }
  | {
      isAdmin: false;
      initialMainTab: MainTab;
      currentUserId: string;
      adminData: null;
    };

export function SettingsShell({
  isAdmin,
  initialMainTab,
  currentUserId,
  adminData,
}: SettingsShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mainTab, setMainTab] = useState<MainTab>(initialMainTab);

  useEffect(() => {
    setMainTab(tabFromQuery(searchParams.get("tab")));
  }, [searchParams]);

  const pushTab = useCallback(
    (next: MainTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "einstellungen") {
        params.delete("tab");
      } else {
        params.set("tab", "admin");
      }
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
      setMainTab(next);
    },
    [pathname, router, searchParams],
  );

  if (!isAdmin) {
    return (
      <div className="px-4 pt-6 pb-28">
        <div className="mb-6 flex items-center gap-3">
          <Settings className="h-6 w-6 text-orange-400" />
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Einstellungen
          </h1>
        </div>
        <StandardSettingsSection />
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-28">
      <div className="mb-6 flex items-center gap-3">
        <Settings className="h-6 w-6 text-orange-400" />
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
          Einstellungen
        </h1>
      </div>

      <div className="mb-6 flex rounded-xl overflow-hidden border border-zinc-800">
        <button
          type="button"
          onClick={() => pushTab("einstellungen")}
          className={`flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2.5 text-center text-[11px] font-medium leading-tight transition-colors sm:text-xs ${
            mainTab === "einstellungen"
              ? "bg-orange-500 text-white"
              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
          }`}
        >
          <span>Standard-Einstellungen</span>
        </button>
        <button
          type="button"
          onClick={() => pushTab("admin")}
          className={`flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2.5 text-center text-[11px] font-medium leading-tight transition-colors sm:text-xs ${
            mainTab === "admin"
              ? "bg-orange-500 text-white"
              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
          }`}
        >
          <span>Admin-Einstellungen</span>
        </button>
      </div>

      {mainTab === "admin" ? (
        <AdminTabs
          projects={adminData.projects}
          users={adminData.users}
          tokens={adminData.tokens}
          aiLimit={adminData.aiLimit}
          currentUserId={currentUserId}
          diagnostics={adminData.diagnostics}
        />
      ) : (
        <StandardSettingsSection />
      )}
    </div>
  );
}
