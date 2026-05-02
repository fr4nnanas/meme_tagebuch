"use client";

import { ChevronDown } from "lucide-react";
import { useActiveProject } from "@/components/features/app/project-context";

export function ProjectSelector() {
  const { projects, activeProjectId, setActiveProjectId } = useActiveProject();

  if (projects.length === 0) {
    return (
      <div className="rounded-full border border-dashed border-zinc-800 bg-zinc-900 px-4 py-2 text-xs text-zinc-500">
        Kein Projekt zugewiesen
      </div>
    );
  }

  return (
    <label className="relative flex w-full items-center">
      <span className="sr-only">Aktives Projekt</span>
      <select
        value={activeProjectId ?? ""}
        onChange={(e) => setActiveProjectId(e.target.value || null)}
        className="h-11 w-full appearance-none rounded-full border border-zinc-800 bg-zinc-900 pl-4 pr-10 text-sm text-zinc-100 transition-colors focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-zinc-400" />
    </label>
  );
}
