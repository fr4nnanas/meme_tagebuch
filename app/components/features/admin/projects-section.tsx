"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Plus, Save, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import type { ProjectWithMembers, UserRow } from "@/app/(app)/admin/page";
import {
  addProjectMember,
  createProject,
  deleteProject,
  removeProjectMember,
  updateProjectBasics,
  updateProjectPromptContext,
} from "@/lib/actions/admin";
import { ProjectExportButton } from "@/components/features/export/project-export-button";

interface ProjectsSectionProps {
  projects: ProjectWithMembers[];
  users: UserRow[];
}

interface ProjectCardProps {
  project: ProjectWithMembers;
  users: UserRow[];
  expanded: boolean;
  onToggleExpand: () => void;
}

function ProjectCard({ project, users, expanded, onToggleExpand }: ProjectCardProps) {
  const router = useRouter();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [projectName, setProjectName] = useState(project.name);
  const [projectDescription, setProjectDescription] = useState(project.description ?? "");
  const [promptContext, setPromptContext] = useState(project.ai_prompt_context ?? "");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setProjectName(project.name);
    setProjectDescription(project.description ?? "");
    setPromptContext(project.ai_prompt_context ?? "");
  }, [project.id, project.name, project.description, project.ai_prompt_context]);

  const memberIds = new Set(project.project_members.map((m) => m.user_id));
  const memberUsers = users.filter((u) => memberIds.has(u.id));
  const nonMemberUsers = users.filter((u) => !memberIds.has(u.id));

  function handleAddMember() {
    if (!selectedUserId) return;
    startTransition(async () => {
      const result = await addProjectMember(project.id, selectedUserId);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Mitglied hinzugefügt.");
        setSelectedUserId("");
      }
    });
  }

  function handleRemoveMember(userId: string, username: string) {
    startTransition(async () => {
      const result = await removeProjectMember(project.id, userId);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(`${username} entfernt.`);
      }
    });
  }

  function handleDeleteProject() {
    if (
      !window.confirm(
        `Projekt „${project.name}" wirklich löschen? Alle Posts, Mitgliedschaften und Jobs dieses Projekts werden unwiderruflich gelöscht.`,
      )
    )
      return;

    startTransition(async () => {
      const result = await deleteProject(project.id);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(`Projekt „${project.name}" gelöscht.`);
      }
    });
  }

  function handleSaveBasics() {
    startTransition(async () => {
      const result = await updateProjectBasics(
        project.id,
        projectName,
        projectDescription,
      );
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Projekt gespeichert.");
        router.refresh();
      }
    });
  }

  function handleSavePromptContext() {
    startTransition(async () => {
      const result = await updateProjectPromptContext(project.id, promptContext);
      if ("error" in result) {
        toast.error(result.error, { duration: 12_000 });
      } else {
        toast.success("KI-Kontext gespeichert.");
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={expanded}
          className="flex-1 flex items-center justify-between px-4 py-3 text-left hover:bg-zinc-800 transition-colors min-w-0"
        >
          <div className="min-w-0">
            <p className="font-medium text-zinc-100 truncate">{project.name}</p>
            {project.description && (
              <p className="text-xs text-zinc-400 mt-0.5 truncate">{project.description}</p>
            )}
            <p className="text-xs text-zinc-500 mt-0.5">
              {memberUsers.length} Mitglied{memberUsers.length !== 1 ? "er" : ""}
            </p>
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-zinc-400 shrink-0 ml-2" />
          ) : (
            <ChevronDown className="h-4 w-4 text-zinc-400 shrink-0 ml-2" />
          )}
        </button>
        {/* Projekt löschen */}
        <button
          onClick={handleDeleteProject}
          disabled={isPending}
          title="Projekt löschen"
          className="px-3 py-3 text-zinc-600 hover:text-red-400 hover:bg-zinc-800 transition-colors disabled:opacity-40 shrink-0 border-l border-zinc-800"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Expandierter Inhalt */}
      {expanded && (
        <div className="border-t border-zinc-800 px-4 py-3 space-y-3">
          <div className="space-y-2 pb-3 border-b border-zinc-800">
            <p className="text-xs font-medium text-zinc-400">Name &amp; Beschreibung</p>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              maxLength={80}
              placeholder="Projektname"
              aria-label="Projektname"
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm px-3 py-2 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <textarea
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              maxLength={300}
              rows={2}
              placeholder="Beschreibung (optional)"
              aria-label="Projektbeschreibung"
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm px-3 py-2 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-zinc-600">
                {projectName.length}/80 · {projectDescription.length}/300
              </span>
              <button
                type="button"
                onClick={handleSaveBasics}
                disabled={
                  isPending ||
                  projectName.trim().length === 0 ||
                  (projectName === project.name &&
                    projectDescription.trim() ===
                      (project.description ?? "").trim())
                }
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-700 text-zinc-200 text-xs font-medium hover:bg-zinc-600 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                <Save className="h-3.5 w-3.5" />
                Speichern
              </button>
            </div>
          </div>

          {/* Mitgliederliste */}
          {memberUsers.length > 0 ? (
            <ul className="space-y-1">
              {memberUsers.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center justify-between py-1"
                >
                  <span className="text-sm text-zinc-300">{u.username}</span>
                  <button
                    onClick={() => handleRemoveMember(u.id, u.username)}
                    disabled={isPending}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                    aria-label={`${u.username} entfernen`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500">Noch keine Mitglieder.</p>
          )}

          {/* Mitglied hinzufügen */}
          {nonMemberUsers.length > 0 && (
            <div className="flex gap-2 pt-1">
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="flex-1 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">User auswählen…</option>
                {nonMemberUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAddMember}
                disabled={!selectedUserId || isPending}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <UserPlus className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* ZIP-Export */}
          <div className="pt-2 border-t border-zinc-800 space-y-2">
            <p className="text-xs font-medium text-zinc-400">Offline-Export</p>
            <ProjectExportButton projectId={project.id} projectName={project.name} />
          </div>

          {/* KI-Kontext / Masterprompt */}
          <div className="pt-2 border-t border-zinc-800 space-y-2">
            <p className="text-xs font-medium text-zinc-400">KI-Kontext (Masterprompt)</p>
            <textarea
              value={promptContext}
              onChange={(e) => setPromptContext(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder={
                'z. B. „Betriebsausflug 2025 – lustige Büro-Memes" oder „Hochzeit von Lisa & Tom"'
              }
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm px-3 py-2 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-600">{promptContext.length}/1000</span>
              <button
                onClick={handleSavePromptContext}
                disabled={isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-700 text-zinc-200 text-xs font-medium hover:bg-zinc-600 disabled:opacity-50 transition-colors"
              >
                <Save className="h-3.5 w-3.5" />
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ProjectsSection({ projects, users }: ProjectsSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleProjectExpand(projectId: string) {
    setExpandedProjectId((prev) => (prev === projectId ? null : projectId));
  }

  function handleCreateProject(formData: FormData) {
    startTransition(async () => {
      const result = await createProject(formData);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Projekt angelegt.");
        setShowForm(false);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Header mit Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-100">
          Projekte ({projects.length})
        </h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500 text-white text-sm font-medium hover:bg-orange-400 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Neu
        </button>
      </div>

      {/* Formular: Neues Projekt */}
      {showForm && (
        <form
          action={handleCreateProject}
          className="rounded-xl border border-orange-500/30 bg-zinc-900 p-4 space-y-3"
        >
          <p className="text-sm font-medium text-zinc-100">Neues Projekt</p>
          <input
            name="name"
            type="text"
            placeholder="Projektname *"
            required
            maxLength={80}
            className="w-full rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm px-3 py-2 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <textarea
            name="description"
            placeholder="Beschreibung (optional)"
            rows={2}
            maxLength={300}
            className="w-full rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm px-3 py-2 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-400 disabled:opacity-50 transition-colors"
            >
              {isPending ? "Anlegen…" : "Anlegen"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}

      {/* Projektliste */}
      {projects.length > 0 ? (
        <div className="space-y-2">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              users={users}
              expanded={expandedProjectId === project.id}
              onToggleExpand={() => toggleProjectExpand(project.id)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900 p-6 text-center">
          <p className="text-sm text-zinc-400">Noch keine Projekte angelegt.</p>
        </div>
      )}
    </div>
  );
}
