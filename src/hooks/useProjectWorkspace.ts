import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Dispatch,
  MouseEvent as ReactMouseEvent,
  SetStateAction,
} from "react";
import { toast } from "sonner";

import {
  parseCanvasState,
  serializeCanvasState,
} from "@/lib/canvas-project";
import type { CanvasImageData, ProjectSummary } from "@/lib/types";

type Point = {
  x: number;
  y: number;
};

export type ProjectContextMenuState = {
  project: ProjectSummary;
  x: number;
  y: number;
};

type UseProjectWorkspaceOptions = {
  images: CanvasImageData[];
  setImages: Dispatch<SetStateAction<CanvasImageData[]>>;
  setSelectedImages: Dispatch<SetStateAction<Set<string | number>>>;
  stagePos: Point;
  setStagePos: Dispatch<SetStateAction<Point>>;
  stageScale: number;
  setStageScale: Dispatch<SetStateAction<number>>;
};

export function useProjectWorkspace({
  images,
  setImages,
  setSelectedImages,
  stagePos,
  setStagePos,
  stageScale,
  setStageScale,
}: UseProjectWorkspaceOptions) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("Untitled project");
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(
    null
  );
  const [renamingProjectName, setRenamingProjectName] = useState("");
  const [projectContextMenu, setProjectContextMenu] =
    useState<ProjectContextMenuState | null>(null);
  const [projectToDelete, setProjectToDelete] =
    useState<ProjectSummary | null>(null);
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const hasLoadedProjectRef = useRef(false);
  const hasRequestedInitialProjectsRef = useRef(false);
  const isCancellingRenameRef = useRef(false);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hydrateProject = useCallback(
    (project: ProjectSummary) => {
      hasLoadedProjectRef.current = false;
      const state = parseCanvasState(project.canvasJson);
      setCurrentProjectId(project.id);
      setProjectName(project.name);
      setImages(state.images || []);
      setSelectedImages(new Set());
      if (state.stage) {
        setStagePos({ x: state.stage.x || 0, y: state.stage.y || 0 });
        setStageScale(state.stage.scale || 1);
      }
      window.setTimeout(() => {
        hasLoadedProjectRef.current = true;
      }, 0);
    },
    [setImages, setSelectedImages, setStagePos, setStageScale]
  );

  const loadProjects = useCallback(async () => {
    setIsLoadingProjects(true);
    const response = await fetch("/api/projects");
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      toast.error(body?.error || "Failed to load projects");
      setIsLoadingProjects(false);
      return;
    }

    let nextProjects = (body?.projects || []) as ProjectSummary[];
    if (nextProjects.length === 0) {
      const createResponse = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled project" }),
      });
      const createBody = await createResponse.json().catch(() => null);
      if (createResponse.ok && createBody?.project) {
        nextProjects = [createBody.project];
      }
    }

    setProjects(nextProjects);
    if (nextProjects[0]) {
      hydrateProject(nextProjects[0]);
    }
    setIsLoadingProjects(false);
  }, [hydrateProject]);

  useEffect(() => {
    if (hasRequestedInitialProjectsRef.current) return;
    hasRequestedInitialProjectsRef.current = true;
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (!renamingProjectId) return;
    window.setTimeout(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }, 0);
  }, [renamingProjectId]);

  useEffect(() => {
    if (!hasLoadedProjectRef.current || !currentProjectId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(() => {
      setIsSaving(true);
      const canvasJson = serializeCanvasState(images, {
        x: stagePos.x,
        y: stagePos.y,
        scale: stageScale,
      });
      fetch(`/api/projects/${currentProjectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName,
          canvasJson,
        }),
      })
        .then(async (response) => {
          const body = await response.json().catch(() => null);
          if (!response.ok) {
            throw new Error(body?.error || "Failed to save project");
          }
          setProjects((prev) =>
            prev.map((project) =>
              project.id === currentProjectId
                ? {
                    ...project,
                    name: body.project.name,
                    canvasJson: body.project.canvasJson,
                    updatedAt: body.project.updatedAt,
                  }
                : project
            )
          );
        })
        .catch((error) => {
          toast.error(error instanceof Error ? error.message : "Save failed");
        })
        .finally(() => setIsSaving(false));
    }, 800);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [currentProjectId, images, projectName, stagePos.x, stagePos.y, stageScale]);

  async function createProject() {
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Untitled project" }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      toast.error(body?.error || "Failed to create project");
      return;
    }
    setProjects((prev) => [body.project, ...prev]);
    hydrateProject(body.project);
  }

  function startProjectRename(project: ProjectSummary) {
    setRenamingProjectId(project.id);
    setRenamingProjectName(project.name);
  }

  async function commitProjectRename(project: ProjectSummary) {
    if (isCancellingRenameRef.current) return;
    if (renamingProjectId !== project.id) return;

    const nextName = renamingProjectName.trim();
    setRenamingProjectId(null);
    setRenamingProjectName("");

    if (!nextName) {
      toast.error("Project name is required");
      return;
    }

    if (nextName === project.name) return;

    const response = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nextName }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      toast.error(body?.error || "Failed to rename project");
      return;
    }

    const updatedProject = body.project as ProjectSummary;
    setProjects((prev) =>
      prev.map((item) =>
        item.id === updatedProject.id
          ? {
              ...item,
              name: updatedProject.name,
              updatedAt: updatedProject.updatedAt,
            }
          : item
      )
    );

    if (currentProjectId === updatedProject.id) {
      setProjectName(updatedProject.name);
    }
  }

  function cancelProjectRename() {
    isCancellingRenameRef.current = true;
    setRenamingProjectId(null);
    setRenamingProjectName("");
    window.setTimeout(() => {
      isCancellingRenameRef.current = false;
    }, 0);
  }

  function openProjectContextMenu(
    event: ReactMouseEvent,
    project: ProjectSummary
  ) {
    event.preventDefault();
    event.stopPropagation();
    cancelProjectRename();

    const menuWidth = 180;
    const menuHeight = 44;
    const x = Math.min(event.clientX, window.innerWidth - menuWidth - 8);
    const y = Math.min(event.clientY, window.innerHeight - menuHeight - 8);

    setProjectContextMenu({
      project,
      x: Math.max(8, x),
      y: Math.max(8, y),
    });
  }

  async function deleteProject(project: ProjectSummary) {
    setIsDeletingProject(true);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        toast.error(body?.error || "Failed to delete project");
        return false;
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete project"
      );
      return false;
    } finally {
      setIsDeletingProject(false);
    }

    const remainingProjects = projects.filter((item) => item.id !== project.id);
    setProjects(remainingProjects);
    toast.success("Project deleted");

    if (currentProjectId !== project.id) return true;

    hasLoadedProjectRef.current = false;
    setCurrentProjectId(null);
    setProjectName("Untitled project");
    setImages([]);
    setSelectedImages(new Set());

    if (remainingProjects[0]) {
      hydrateProject(remainingProjects[0]);
      return true;
    }

    await createProject();
    return true;
  }

  async function confirmProjectDelete() {
    if (!projectToDelete) return;
    const deleted = await deleteProject(projectToDelete);
    if (deleted) {
      setProjectToDelete(null);
    }
  }

  function closeProjectContextMenu() {
    setProjectContextMenu(null);
  }

  return {
    projects,
    currentProjectId,
    renamingProjectId,
    renamingProjectName,
    projectContextMenu,
    projectToDelete,
    isDeletingProject,
    isLoadingProjects,
    isSaving,
    renameInputRef,
    setRenamingProjectName,
    setProjectToDelete,
    createProject,
    hydrateProject,
    startProjectRename,
    commitProjectRename,
    cancelProjectRename,
    openProjectContextMenu,
    confirmProjectDelete,
    closeProjectContextMenu,
  };
}
