"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useActiveProject } from "@/components/features/app/project-context";
import {
  fetchMapPostsAction,
  type MapPost,
  type MapUser,
} from "@/lib/actions/map";

// Leaflet benötigt zwingend ssr: false, da es window voraussetzt
const LeafletMap = dynamic(
  () => import("./leaflet-map").then((m) => ({ default: m.LeafletMap })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center rounded-xl bg-zinc-900">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    ),
  },
);

const ALL_USERS = "__all__";

export function MapContent() {
  const { activeProjectId, activeProject } = useActiveProject();
  const [posts, setPosts] = useState<MapPost[]>([]);
  const [users, setUsers] = useState<MapUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>(ALL_USERS);
  const [isLoading, setIsLoading] = useState(false);
  const loadedProjectRef = useRef<string | null>(null);

  // Wenn sich das aktive Projekt ändert, Daten neu laden
  useEffect(() => {
    if (!activeProjectId) return;
    if (loadedProjectRef.current === activeProjectId) return;
    loadedProjectRef.current = activeProjectId;
    setSelectedUserId(ALL_USERS);

    setIsLoading(true);
    fetchMapPostsAction(activeProjectId)
      .then((result) => {
        if (result.error) {
          toast.error(result.error);
          return;
        }
        setPosts(result.posts);
        setUsers(result.users);
      })
      .finally(() => setIsLoading(false));
  }, [activeProjectId]);

  const visiblePosts =
    selectedUserId === ALL_USERS
      ? posts
      : posts.filter((p) => p.user_id === selectedUserId);

  return (
    <div className="flex h-full flex-col gap-3 px-4 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Karte
          </h1>
          {activeProject && (
            <p className="mt-0.5 text-sm text-zinc-400">{activeProject.name}</p>
          )}
        </div>

        {/* Filter-Dropdown */}
        {users.length > 0 && (
          <div className="relative">
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="appearance-none rounded-xl border border-zinc-800 bg-zinc-900 py-2 pl-3 pr-8 text-sm text-zinc-100 focus:border-orange-500 focus:outline-none"
            >
              <option value={ALL_USERS}>Alle User</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  @{u.username}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          </div>
        )}
      </div>

      {/* Karten-Bereich */}
      <div className="relative flex-1 overflow-hidden rounded-xl pb-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center rounded-xl bg-zinc-900">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : !activeProjectId ? (
          <EmptyState message="Kein Projekt ausgewählt." />
        ) : visiblePosts.length === 0 ? (
          <EmptyState
            message={
              posts.length === 0
                ? "Noch keine Memes mit GPS-Daten in diesem Projekt."
                : "Dieser User hat keine Memes mit GPS-Daten."
            }
          />
        ) : (
          <LeafletMap posts={visiblePosts} />
        )}

        {/* Badge: Anzahl Pins */}
        {!isLoading && visiblePosts.length > 0 && (
          <div className="absolute bottom-6 left-1/2 z-[1000] -translate-x-1/2">
            <div className="flex items-center gap-1.5 rounded-full bg-zinc-900/90 px-3 py-1.5 text-xs font-medium text-zinc-300 shadow-lg backdrop-blur-sm">
              <MapPin className="h-3.5 w-3.5 text-orange-500" />
              {visiblePosts.length}{" "}
              {visiblePosts.length === 1 ? "Meme" : "Memes"} auf der Karte
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  message: string;
}

function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900 text-center">
      <MapPin className="h-10 w-10 text-zinc-600" />
      <p className="mt-3 max-w-[14rem] text-sm text-zinc-400">{message}</p>
    </div>
  );
}
