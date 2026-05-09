import Image from "next/image";
import type { MouseEvent, RefObject } from "react";
import { FolderPlus, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProjectSummary } from "@/lib/types";

type ProjectSidebarProps = {
  username: string;
  projects: ProjectSummary[];
  currentProjectId: string | null;
  isLoadingProjects: boolean;
  isSaving: boolean;
  renamingProjectId: string | null;
  renamingProjectName: string;
  renameInputRef: RefObject<HTMLInputElement | null>;
  onCreateProject: () => void;
  onSelectProject: (project: ProjectSummary) => void;
  onStartRename: (project: ProjectSummary) => void;
  onRenameNameChange: (name: string) => void;
  onCommitRename: (project: ProjectSummary) => void;
  onCancelRename: () => void;
  onOpenContextMenu: (
    event: MouseEvent,
    project: ProjectSummary
  ) => void;
  onOpenSettings: () => void;
};

export function ProjectSidebar({
  username,
  projects,
  currentProjectId,
  isLoadingProjects,
  isSaving,
  renamingProjectId,
  renamingProjectName,
  renameInputRef,
  onCreateProject,
  onSelectProject,
  onStartRename,
  onRenameNameChange,
  onCommitRename,
  onCancelRename,
  onOpenContextMenu,
  onOpenSettings,
}: ProjectSidebarProps) {
  return (
    <aside className="fixed left-4 top-4 z-10 w-[252px] border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-200 p-3">
        <div className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="Koubou"
            width={32}
            height={32}
            className="h-8 w-8"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-neutral-950">
              Koubou
            </p>
            <p className="truncate text-xs text-neutral-500">{username}</p>
          </div>
        </div>
      </div>
      <div className="max-h-[42vh] overflow-y-auto p-2">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-xs font-medium uppercase text-neutral-500">
            Projects
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Create project"
            className="h-7 w-7"
            onClick={onCreateProject}
            disabled={isLoadingProjects}
          >
            <FolderPlus className="h-4 w-4" />
          </Button>
        </div>
        {projects.map((project) => (
          <div key={project.id} className="mb-1">
            {renamingProjectId === project.id ? (
              <Input
                ref={renameInputRef}
                value={renamingProjectName}
                onChange={(event) => onRenameNameChange(event.target.value)}
                onClick={(event) => event.stopPropagation()}
                onDoubleClick={(event) => event.stopPropagation()}
                onBlur={() => onCommitRename(project)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    event.currentTarget.blur();
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    onCancelRename();
                  }
                }}
                className="h-9 rounded px-2 text-sm"
                aria-label={`Rename ${project.name}`}
              />
            ) : (
              <button
                type="button"
                onClick={() => onSelectProject(project)}
                onDoubleClick={() => onStartRename(project)}
                onContextMenu={(event) => onOpenContextMenu(event, project)}
                title="Double-click to rename"
                className={`w-full truncate rounded px-2 py-2 text-left text-sm ${
                  currentProjectId === project.id
                    ? "bg-neutral-950 text-white"
                    : "text-neutral-700 hover:bg-neutral-100"
                }`}
              >
                {project.name}
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="border-t border-neutral-200 p-3 text-xs text-neutral-500">
        <div className="flex items-center justify-between">
          <span>{isSaving ? "Saving..." : "Saved to server"}</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open settings"
            className="h-7 w-7"
            onClick={onOpenSettings}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
