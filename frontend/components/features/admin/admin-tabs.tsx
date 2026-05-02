"use client";

import { useState } from "react";
import { FolderOpen, Link2, Users, Zap } from "lucide-react";
import type { ProjectWithMembers, UserRow, TokenRow } from "@/lib/admin/types";
import { ProjectsSection } from "./projects-section";
import { InvitationTokensSection } from "./invitation-tokens-section";
import { UsersSection } from "./users-section";
import { AiLimitSection } from "./ai-limit-section";

interface AdminTabsProps {
  projects: ProjectWithMembers[];
  users: UserRow[];
  tokens: TokenRow[];
  aiLimit: number;
  currentUserId: string;
  /** Postgres-/Ladehinweise (nicht kritisch wenn null) */
  diagnostics?: string | null;
}

const TABS = [
  { id: "projects", label: "Projekte", icon: FolderOpen },
  { id: "tokens", label: "Einladungen", icon: Link2 },
  { id: "users", label: "User", icon: Users },
  { id: "ai", label: "KI-Limit", icon: Zap },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function AdminTabs({
  projects,
  users,
  tokens,
  aiLimit,
  currentUserId,
  diagnostics = null,
}: AdminTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("projects");

  return (
    <div>
      {diagnostics ? (
        <div
          role="status"
          className="mb-4 rounded-lg border border-amber-500/40 bg-amber-950/35 px-3 py-2.5 text-xs text-amber-100/95 leading-snug"
        >
          {diagnostics}
        </div>
      ) : null}

      {/* Tab-Leiste */}
      <div className="flex rounded-xl overflow-hidden border border-zinc-800 mb-6">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-orange-500 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Aktiver Tab-Inhalt */}
      {activeTab === "projects" && (
        <ProjectsSection projects={projects} users={users} />
      )}
      {activeTab === "tokens" && (
        <InvitationTokensSection tokens={tokens} />
      )}
      {activeTab === "users" && (
        <UsersSection users={users} currentUserId={currentUserId} />
      )}
      {activeTab === "ai" && (
        <AiLimitSection currentLimit={aiLimit} />
      )}
    </div>
  );
}
