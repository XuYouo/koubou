import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { MouseEvent, RefObject } from "react";
import {
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  ImageIcon,
  Images,
  Settings,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseCanvasState } from "@/lib/canvas-project";
import type { CanvasImageData, ProjectSummary } from "@/lib/types";

type ProjectResource = {
  image: CanvasImageData;
  order: number;
  createdAt: number | null;
};

type ProjectSidebarProps = {
  username: string;
  projects: ProjectSummary[];
  currentProjectId: string | null;
  currentProjectImages: CanvasImageData[];
  selectedImages: Set<string | number>;
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
  onSelectResource: (
    project: ProjectSummary,
    imageId: string | number
  ) => void;
  onOpenGallery: () => void;
  onOpenSettings: () => void;
};

export function ProjectSidebar({
  username,
  projects,
  currentProjectId,
  currentProjectImages,
  selectedImages,
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
  onSelectResource,
  onOpenGallery,
  onOpenSettings,
}: ProjectSidebarProps) {
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(
    () => new Set()
  );

  const resourcesByProjectId = useMemo(() => {
    return new Map(
      projects.map((project) => {
        const images =
          project.id === currentProjectId
            ? currentProjectImages
            : parseCanvasState(project.canvasJson).images;

        const resources = images
          .map((image, order) => ({
            image,
            order,
            createdAt: getCreatedAtTime(image),
          }))
          .filter(({ image }) => Boolean(image.src || image.isGenerating))
          .sort(compareProjectResources);

        return [project.id, resources] as const;
      })
    );
  }, [currentProjectId, currentProjectImages, projects]);

  useEffect(() => {
    if (!currentProjectId) return;

    setExpandedProjectIds((current) => {
      if (current.has(currentProjectId)) return current;
      const next = new Set(current);
      next.add(currentProjectId);
      return next;
    });
  }, [currentProjectId]);

  function toggleProject(project: ProjectSummary) {
    onSelectProject(project);
    setExpandedProjectIds((current) => {
      const next = new Set(current);
      if (next.has(project.id)) {
        next.delete(project.id);
      } else {
        next.add(project.id);
      }
      return next;
    });
  }

  return (
    <aside className="fixed left-4 top-4 z-10 flex max-h-[calc(100vh-2rem)] w-[252px] flex-col overflow-hidden border border-neutral-200 bg-white shadow-sm">
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
      <div className="border-b border-neutral-200 p-2">
        <button
          type="button"
          onClick={onOpenGallery}
          className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
        >
          <Images className="h-4 w-4" />
          Gallery
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-xs font-medium uppercase text-neutral-500">
            Folders
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Create folder"
            className="h-7 w-7"
            onClick={onCreateProject}
            disabled={isLoadingProjects}
          >
            <FolderPlus className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-1">
          {projects.map((project) => {
            const isExpanded = expandedProjectIds.has(project.id);
            const isCurrent = currentProjectId === project.id;
            const resources = resourcesByProjectId.get(project.id) || [];

            return (
              <div key={project.id}>
                {renamingProjectId === project.id ? (
                  <Input
                    ref={renameInputRef}
                    value={renamingProjectName}
                    onChange={(event) =>
                      onRenameNameChange(event.target.value)
                    }
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
                    aria-expanded={isExpanded}
                    onClick={() => toggleProject(project)}
                    onDoubleClick={() => onStartRename(project)}
                    onContextMenu={(event) => onOpenContextMenu(event, project)}
                    title="Double-click to rename"
                    className={`flex h-9 w-full items-center gap-1.5 rounded px-1.5 text-left text-sm transition-colors ${
                      isCurrent
                        ? "bg-neutral-950 text-white"
                        : isExpanded
                          ? "bg-neutral-100 text-neutral-900"
                          : "text-neutral-700 hover:bg-neutral-100"
                    }`}
                  >
                    <ChevronRight
                      className={`h-3.5 w-3.5 shrink-0 transition-transform ${
                        isExpanded ? "rotate-90" : ""
                      }`}
                    />
                    {isExpanded ? (
                      <FolderOpen className="h-4 w-4 shrink-0" />
                    ) : (
                      <Folder className="h-4 w-4 shrink-0" />
                    )}
                    <span className="min-w-0 flex-1 truncate">
                      {project.name}
                    </span>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${
                        isCurrent
                          ? "bg-white/15 text-white/80"
                          : "bg-white text-neutral-500"
                      }`}
                    >
                      {resources.length}
                    </span>
                  </button>
                )}

                {isExpanded && (
                  <ProjectResourceGrid
                    project={project}
                    resources={resources}
                    currentProjectId={currentProjectId}
                    selectedImages={selectedImages}
                    onSelectResource={onSelectResource}
                  />
                )}
              </div>
            );
          })}
        </div>
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

function ProjectResourceGrid({
  project,
  resources,
  currentProjectId,
  selectedImages,
  onSelectResource,
}: {
  project: ProjectSummary;
  resources: ProjectResource[];
  currentProjectId: string | null;
  selectedImages: Set<string | number>;
  onSelectResource: (
    project: ProjectSummary,
    imageId: string | number
  ) => void;
}) {
  if (resources.length === 0) {
    return (
      <div className="ml-7 px-1 pb-2 pt-1 text-xs text-neutral-400">
        No resources
      </div>
    );
  }

  return (
    <div className="ml-7 grid grid-cols-4 gap-1.5 px-1 pb-2 pt-1">
      {resources.map((resource) => {
        const isSelected =
          currentProjectId === project.id &&
          selectedImages.has(resource.image.id);

        return (
          <button
            key={`${project.id}-${String(resource.image.id)}`}
            type="button"
            aria-label={`Select ${project.name} resource ${
              resource.order + 1
            }`}
            onClick={() => onSelectResource(project, resource.image.id)}
            className={`relative aspect-square overflow-hidden rounded border bg-neutral-100 transition ${
              isSelected
                ? "border-neutral-950 ring-2 ring-neutral-950 ring-offset-1"
                : "border-neutral-200 hover:border-neutral-400"
            }`}
          >
            {resource.image.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resource.image.src}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full w-full place-items-center">
                <ImageIcon className="h-4 w-4 text-neutral-400" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function getCreatedAtTime(image: CanvasImageData) {
  if (!image.createdAt) return null;
  const time = Date.parse(image.createdAt);
  return Number.isFinite(time) ? time : null;
}

function compareProjectResources(a: ProjectResource, b: ProjectResource) {
  if (a.createdAt !== null && b.createdAt !== null) {
    return a.createdAt - b.createdAt || a.order - b.order;
  }
  if (a.createdAt !== null) return 1;
  if (b.createdAt !== null) return -1;
  return a.order - b.order;
}
