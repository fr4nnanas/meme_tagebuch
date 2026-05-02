"use client";

import { useState } from "react";
import { LogOut, Pencil } from "lucide-react";
import { logout } from "@/lib/actions/auth";
import { AvatarUploader } from "./avatar-uploader";
import { EditProfileModal } from "./edit-profile-modal";
import { PostGrid } from "./post-grid";
import { ProjectSelector } from "./project-selector";

export interface ProfileViewProps {
  profile: {
    id: string;
    username: string;
    bio: string | null;
    avatar_url: string | null;
    role: string;
  };
  isOwner: boolean;
  /** Eingeloggter Nutzer (für Feed-Aktionen im Profilpost-Overlay) */
  currentUserId: string;
}

export function ProfileView({ profile, isOwner, currentUserId }: ProfileViewProps) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <div className="px-4 pt-6">
      <div className="flex items-start gap-4">
        <AvatarUploader
          userId={profile.id}
          initialAvatarUrl={profile.avatar_url}
          username={profile.username}
          isOwner={isOwner}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-bold text-zinc-100">
              {profile.username}
            </h1>
            {profile.role === "admin" && (
              <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-400">
                Admin
              </span>
            )}
          </div>
          {profile.bio ? (
            <p className="mt-1 whitespace-pre-line text-sm text-zinc-300">
              {profile.bio}
            </p>
          ) : (
            <p className="mt-1 text-sm italic text-zinc-500">
              {isOwner
                ? "Noch keine Bio. Klick auf „Bearbeiten“, um eine zu schreiben."
                : "Keine Bio."}
            </p>
          )}
        </div>
      </div>

      {isOwner && (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="flex h-10 flex-1 items-center justify-center gap-2 rounded-full border border-zinc-800 bg-zinc-800 text-sm font-medium text-zinc-200 transition-colors hover:border-orange-500 hover:text-orange-400"
          >
            <Pencil className="h-4 w-4" />
            Bearbeiten
          </button>
          <form action={logout}>
            <button
              type="submit"
              aria-label="Abmelden"
              className="flex h-10 items-center justify-center gap-2 rounded-full border border-zinc-800 bg-zinc-800 px-4 text-sm font-medium text-zinc-200 transition-colors hover:border-red-500 hover:text-red-400"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </form>
        </div>
      )}

      <div className="mt-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Aktives Projekt
        </h2>
        <ProjectSelector />
      </div>

      <div className="mt-6">
        <PostGrid
          userId={profile.id}
          currentUserId={currentUserId}
          isOwner={isOwner}
        />
      </div>

      <EditProfileModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initialUsername={profile.username}
        initialBio={profile.bio ?? ""}
      />
    </div>
  );
}
