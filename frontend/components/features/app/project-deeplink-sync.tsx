"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useActiveProject } from "@/components/features/app/project-context";

/**
 * Liest `?project=<uuid>` und setzt das aktive Projekt (ggf. vor localStorage).
 */
export function ProjectDeepLinkSync() {
  const searchParams = useSearchParams();
  const { projects, setActiveProjectId } = useActiveProject();

  useEffect(() => {
    const pid = searchParams.get("project");
    if (!pid) return;
    if (!projects.some((p) => p.id === pid)) return;
    setActiveProjectId(pid);
  }, [searchParams, projects, setActiveProjectId]);

  return null;
}
