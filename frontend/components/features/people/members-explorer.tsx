"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Search, User } from "lucide-react";
import { toast } from "sonner";
import { useActiveProject } from "@/components/features/app/project-context";
import {
  fetchProjectMembersAction,
  type ProjectMemberPreview,
} from "@/lib/actions/project-members";

export function MembersExplorer() {
  const { activeProjectId, activeProject } = useActiveProject();
  const [members, setMembers] = useState<ProjectMemberPreview[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async (projectId: string) => {
    setIsLoading(true);
    try {
      const result = await fetchProjectMembersAction(projectId);
      if (result.error) {
        toast.error(result.error);
        setMembers([]);
        return;
      }
      setMembers(result.members);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /* Laden bei Projektwechsel – gleiches Muster wie Feed; setState erfolgt in der Server-Action-Callback-Kette. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!activeProjectId) return;
    void load(activeProjectId);
  }, [activeProjectId, load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.username.toLowerCase().includes(q));
  }, [members, search]);

  if (!activeProjectId) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
        <p className="text-zinc-400">
          Kein Projekt ausgewählt. Wähle ein Projekt im Profil-Tab aus.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-6">
      <header className="px-4 pt-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
          Personen
        </h1>
        {activeProject && (
          <p className="mt-0.5 text-sm text-zinc-500">{activeProject.name}</p>
        )}
        <p className="mt-2 text-sm text-zinc-400">
          Mitglieder dieses Projekts durchsuchen und Profile öffnen.
        </p>
      </header>

      <div className="mt-4 px-4">
        <label htmlFor="member-search" className="sr-only">
          Benutzer suchen
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            id="member-search"
            type="search"
            autoComplete="off"
            placeholder="Benutzername suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-orange-500"
          />
        </div>
      </div>

      {isLoading && members.length === 0 && (
        <div className="mt-10 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="mt-10 px-6 text-center text-sm text-zinc-500">
          {members.length === 0
            ? "In diesem Projekt sind noch keine Mitglieder mit Profil gelistet."
            : "Keine Treffer für diese Suche."}
        </div>
      )}

      {filtered.length > 0 && (
        <ul className="mt-6 flex flex-col gap-1 px-2">
          {filtered.map((m) => (
            <li key={m.id}>
              <Link
                href={`/profile/${m.id}`}
                className="flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-zinc-900"
              >
                <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-full bg-zinc-800">
                  {m.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.avatar_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-zinc-600">
                      <User className="h-5 w-5" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-zinc-100">
                    {m.username}
                  </p>
                  <p className="text-xs text-zinc-500">Profil anzeigen</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
