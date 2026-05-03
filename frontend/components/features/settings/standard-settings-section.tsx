"use client";

import { useActiveProject } from "@/components/features/app/project-context";
import { ProjectExportButton } from "@/components/features/export/project-export-button";
import { ProjectSelector } from "@/components/features/profile/project-selector";
import { FeedNotificationSettings } from "@/components/features/settings/feed-notification-settings";

export function StandardSettingsSection() {
  const { activeProjectId, activeProject } = useActiveProject();

  return (
    <div className="space-y-6">
      <FeedNotificationSettings />

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-zinc-400">Aktives Projekt</h2>
        <ProjectSelector />
      </section>

      {activeProjectId ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-medium text-zinc-400">Offline-Export</h2>
            <p className="mt-1 text-xs text-zinc-500">
              ZIP mit HTML-Galerie, Bildern und JSON für das ausgewählte Projekt.
            </p>
          </div>
          <ProjectExportButton
            projectId={activeProjectId}
            projectName={activeProject?.name ?? "Projekt"}
          />
        </section>
      ) : (
        <p className="rounded-lg border border-dashed border-zinc-800 bg-zinc-800/50 px-4 py-3 text-sm text-zinc-500">
          Wähle ein Projekt, um den Export zu nutzen.
        </p>
      )}
    </div>
  );
}
