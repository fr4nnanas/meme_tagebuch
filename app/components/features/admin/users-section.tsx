"use client";

import { useTransition } from "react";
import { Shield, ShieldOff, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import type { UserRow } from "@/app/(app)/admin/page";
import { deleteUser, setUserRole } from "@/lib/actions/admin";

interface UsersSectionProps {
  users: UserRow[];
  currentUserId: string;
}

interface UserListItemProps {
  user: UserRow;
  isSelf: boolean;
}

function UserListItem({ user, isSelf }: UserListItemProps) {
  const [isPending, startTransition] = useTransition();
  const isAdmin = user.role === "admin";

  function handleToggleRole() {
    const newRole = isAdmin ? "member" : "admin";
    startTransition(async () => {
      const result = await setUserRole(user.id, newRole);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(
          newRole === "admin"
            ? `${user.username} ist jetzt Admin.`
            : `${user.username} ist jetzt Member.`,
        );
      }
    });
  }

  function handleDeleteUser() {
    if (
      !window.confirm(
        `Account „${user.username}" wirklich löschen? Alle Posts, Kommentare und Likes dieses Users werden unwiderruflich gelöscht.`,
      )
    )
      return;

    startTransition(async () => {
      const result = await deleteUser(user.id);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(`Account „${user.username}" gelöscht.`);
      }
    });
  }

  const joinedAt = new Date(user.created_at).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <li className="flex items-center gap-3 px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-900">
      {/* Avatar-Platzhalter */}
      <div className="h-9 w-9 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
        <User className="h-4 w-4 text-zinc-400" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-zinc-100 truncate">
            {user.username}
          </p>
          {isSelf && (
            <span className="text-xs text-zinc-500">(Du)</span>
          )}
        </div>
        <p className="text-xs text-zinc-500">
          {isAdmin ? "Admin" : "Member"} · seit {joinedAt}
        </p>
      </div>

      {/* Aktionen */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Rollen-Toggle */}
        <button
          onClick={handleToggleRole}
          disabled={isPending || isSelf}
          title={
            isSelf
              ? "Eigene Rolle kann nicht geändert werden"
              : isAdmin
                ? "Admin-Rolle entziehen"
                : "Admin-Rolle vergeben"
          }
          className={`p-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            isAdmin
              ? "text-orange-400 hover:bg-orange-500/10"
              : "text-zinc-500 hover:text-orange-400 hover:bg-zinc-800"
          }`}
        >
          {isAdmin ? (
            <ShieldOff className="h-4 w-4" />
          ) : (
            <Shield className="h-4 w-4" />
          )}
        </button>

        {/* User löschen */}
        <button
          onClick={handleDeleteUser}
          disabled={isPending || isSelf}
          title={isSelf ? "Eigenen Account nicht löschbar" : "User löschen"}
          className="p-2 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}

export function UsersSection({ users, currentUserId }: UsersSectionProps) {
  const admins = users.filter((u) => u.role === "admin");
  const members = users.filter((u) => u.role === "member");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-100">
          User ({users.length})
        </h2>
        <div className="flex gap-3 text-xs text-zinc-400">
          <span>{admins.length} Admin{admins.length !== 1 ? "s" : ""}</span>
          <span>{members.length} Member</span>
        </div>
      </div>

      {/* Legende */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 px-1">
        <span className="flex items-center gap-1">
          <Shield className="h-3.5 w-3.5 text-orange-400" />
          Admin vergeben
        </span>
        <span className="flex items-center gap-1">
          <ShieldOff className="h-3.5 w-3.5" />
          Admin entziehen
        </span>
        <span className="flex items-center gap-1">
          <Trash2 className="h-3.5 w-3.5 text-red-400" />
          User löschen
        </span>
      </div>

      {/* Userliste */}
      {users.length > 0 ? (
        <ul className="space-y-2">
          {users.map((user) => (
            <UserListItem
              key={user.id}
              user={user}
              isSelf={user.id === currentUserId}
            />
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900 p-6 text-center">
          <p className="text-sm text-zinc-400">Keine User gefunden.</p>
        </div>
      )}
    </div>
  );
}
