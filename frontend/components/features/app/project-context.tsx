"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";

export interface ProjectInfo {
  id: string;
  name: string;
}

interface ProjectContextValue {
  projects: ProjectInfo[];
  activeProjectId: string | null;
  activeProject: ProjectInfo | null;
  setActiveProjectId: (id: string | null) => void;
}

const STORAGE_KEY = "meme_active_project_id";
// Eigenes Event, da das native "storage"-Event in derselben Tab-Instanz nicht feuert.
const LOCAL_EVENT = "meme:active-project-change";

const ProjectContext = createContext<ProjectContextValue | null>(null);

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", onChange);
  window.addEventListener(LOCAL_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(LOCAL_EVENT, onChange);
  };
}

function getStoredId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

interface ProjectProviderProps {
  initialProjects: ProjectInfo[];
  children: React.ReactNode;
}

export function ProjectProvider({
  initialProjects,
  children,
}: ProjectProviderProps) {
  // localStorage ist die Quelle der Wahrheit; useSyncExternalStore sorgt für eine
  // saubere Hydration (Server: null, Client: tatsächlicher Wert).
  const storedId = useSyncExternalStore(subscribe, getStoredId, () => null);

  const setActiveProjectId = useCallback((id: string | null) => {
    if (typeof window === "undefined") return;
    if (id) {
      window.localStorage.setItem(STORAGE_KEY, id);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    window.dispatchEvent(new Event(LOCAL_EVENT));
  }, []);

  const activeProjectId = useMemo(() => {
    if (storedId && initialProjects.some((p) => p.id === storedId)) {
      return storedId;
    }
    return initialProjects[0]?.id ?? null;
  }, [storedId, initialProjects]);

  const value = useMemo<ProjectContextValue>(
    () => ({
      projects: initialProjects,
      activeProjectId,
      activeProject:
        initialProjects.find((p) => p.id === activeProjectId) ?? null,
      setActiveProjectId,
    }),
    [initialProjects, activeProjectId, setActiveProjectId],
  );

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
}

export function useActiveProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error(
      "useActiveProject muss innerhalb von ProjectProvider verwendet werden.",
    );
  }
  return ctx;
}
