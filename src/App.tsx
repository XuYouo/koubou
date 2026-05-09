"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Stage, Layer, Rect, Transformer } from "react-konva";
import { Toaster, toast } from "sonner";
import {
  Hand,
  Minus,
  Mouse,
  Plus,
  RotateCcw,
  Send,
  Settings,
  Upload,
  FolderPlus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CanvasImage } from "@/components/canvas/CanvasImage";
import { RelationshipCurve } from "@/components/canvas/RelationshipCurve";
import { ContextMenu } from "@/components/canvas/ContextMenu";
import { SettingsDialog } from "@/components/workbench/SettingsDialog";
import { useStage } from "@/hooks/useStage";
import { useCanvas } from "@/hooks/useCanvas";
import { useImages } from "@/hooks/useImages";
import { useGeneration } from "@/hooks/useGeneration";
import { createDotPattern } from "@/lib/utils";
import {
  DEFAULT_IMAGE_SETTINGS,
  IMAGE_OUTPUT_FORMATS,
  IMAGE_QUALITIES,
  IMAGE_SIZES,
  type ImageSettings,
} from "@/lib/image-options";
import type {
  AssetResponse,
  CanvasProjectState,
  ProjectSummary,
  SafeUser,
} from "@/lib/types";

type AppProps = {
  initialUser: SafeUser;
};

function parseCanvasState(canvasJson: string): CanvasProjectState {
  try {
    const parsed = JSON.parse(canvasJson);
    if (parsed && Array.isArray(parsed.images)) {
      return parsed;
    }
  } catch {
    // Fall back to an empty project below.
  }
  return { images: [] };
}

function serializeCanvasState(
  images: CanvasProjectState["images"],
  stage: { x: number; y: number; scale: number }
) {
  return JSON.stringify({
    images: images.filter((image) => !image.isPlaceholder),
    stage,
  });
}

function imageCenter(image: CanvasProjectState["images"][number]) {
  return {
    x: image.x + image.width / 2,
    y: image.y + image.height / 2,
  };
}

function defaultRelationshipControl(
  start: { x: number; y: number },
  end: { x: number; y: number }
) {
  const mid = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const offset = Math.min(120, Math.max(44, distance * 0.18));

  return {
    x: mid.x - (dy / distance) * offset,
    y: mid.y + (dx / distance) * offset,
  };
}

function settingsEqual(left: ImageSettings, right: ImageSettings) {
  return (
    left.size === right.size &&
    left.quality === right.quality &&
    left.outputFormat === right.outputFormat
  );
}

function PromptSettingSelect({
  label,
  value,
  values,
  disabled,
  onValueChange,
}: {
  label: string;
  value: string;
  values: readonly string[];
  disabled: boolean;
  onValueChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger
        aria-label={`${label}: ${value}`}
        className="h-7 w-auto gap-1 border-0 bg-transparent px-2 text-xs shadow-none hover:bg-neutral-100 focus:ring-0"
      >
        <span className="text-neutral-500">{label}</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {values.map((item) => (
          <SelectItem key={item} value={item}>
            {item}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function App({ initialUser }: AppProps) {
  const router = useRouter();
  const [, setIsInputFocused] = useState(false);
  const [inputText, setInputText] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("Untitled project");
  const [globalSettings, setGlobalSettings] = useState<ImageSettings>(
    DEFAULT_IMAGE_SETTINGS
  );
  const [generationSettings, setGenerationSettings] = useState<ImageSettings>(
    DEFAULT_IMAGE_SETTINGS
  );
  const [hasGenerationOverride, setHasGenerationOverride] = useState(false);
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(
    null
  );
  const [renamingProjectName, setRenamingProjectName] = useState("");
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const hasLoadedProjectRef = useRef(false);
  const hasRequestedInitialProjectsRef = useRef(false);
  const isCancellingRenameRef = useRef(false);
  const settingsSaveRequestRef = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stageRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const trRef = useRef<any>(null);
  const imageRefs = useRef<Map<string | number, any>>(new Map());

  const {
    stagePos,
    setStagePos,
    stageScale,
    setStageScale,
    stageDimensions,
    resetZoom,
    handleWheel,
    handleZoom,
  } = useStage();

  const {
    images,
    setImages,
    selectedImages,
    setSelectedImages,
    addImageFromSrc,
    handleImageSelect,
    handleImageDragMove,
    handleImageDragEnd,
    handleImageTransform,
    pasteCopiedImage,
  } = useImages();

  const getCurrentCenterPosition = useCallback(() => {
    return {
      x: (-stagePos.x + stageDimensions.width / 2) / stageScale,
      y: (-stagePos.y + stageDimensions.height / 2) / stageScale,
    };
  }, [
    stagePos.x,
    stagePos.y,
    stageScale,
    stageDimensions.width,
    stageDimensions.height,
  ]);

  const {
    tool,
    setTool,
    isSelecting,
    selectionRect,
    handleMouseMove,
    handleMouseUp,
    handleStageMouseDown,
    getCursor,
    contextMenu,
    handleContextMenu,
    hideContextMenu,
  } = useCanvas(stageRef, stagePos, stageScale, images, setSelectedImages);

  const { isGenerating, callGenerateImage } = useGeneration(
    currentProjectId,
    setSettingsOpen,
    images,
    setImages,
    getCurrentCenterPosition,
    generationSettings
  );
  const isEditingSelection = selectedImages.size > 0;
  const promptPlaceholder = isEditingSelection
    ? selectedImages.size === 1
      ? "Edit the selected image: describe the change..."
      : `Edit ${selectedImages.size} selected references: describe the change...`
    : "What do you want to create?";
  const relationshipLines = useMemo(() => {
    const byId = new Map(images.map((image) => [image.id, image]));
    return images.flatMap((target) =>
      (target.inputImageIds || [])
        .map((sourceId) => {
          const source = byId.get(sourceId);
          if (!source || source.id === target.id) return null;
          const start = imageCenter(source);
          const end = imageCenter(target);
          const control =
            target.relationshipControls?.[String(source.id)] ||
            defaultRelationshipControl(start, end);
          return {
            key: `${source.id}-${target.id}`,
            sourceId: source.id,
            targetId: target.id,
            start,
            control,
            end,
          };
        })
        .filter(
          (
            line
          ): line is {
            key: string;
            sourceId: string | number;
            targetId: string | number;
            start: { x: number; y: number };
            control: { x: number; y: number };
            end: { x: number; y: number };
          } => Boolean(line)
        )
    );
  }, [images]);

  const handleRelationshipControlMove = useCallback(
    (
      targetId: string | number,
      sourceId: string | number,
      point: { x: number; y: number }
    ) => {
      setImages((prev) =>
        prev.map((image) =>
          image.id === targetId
            ? {
                ...image,
                relationshipControls: {
                  ...(image.relationshipControls || {}),
                  [String(sourceId)]: point,
                },
              }
            : image
        )
      );
    },
    [setImages]
  );

  const handleStageDrag = useCallback(
    (e: any) => {
      if (tool !== "hand") return;
      setStagePos(e.currentTarget.position());
    },
    [setStagePos, tool]
  );

  const updateGlobalSettings = useCallback(
    (nextSettings: ImageSettings) => {
      const previousSettings = globalSettings;
      const requestId = settingsSaveRequestRef.current + 1;
      settingsSaveRequestRef.current = requestId;
      setGlobalSettings(nextSettings);
      setGenerationSettings(nextSettings);
      setHasGenerationOverride(false);

      void fetch("/api/settings/generation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextSettings),
      })
        .then(async (response) => {
          const body = await response.json().catch(() => null);
          if (!response.ok) {
            throw new Error(body?.error || "Failed to save generation defaults");
          }
          if (settingsSaveRequestRef.current !== requestId) return;
          if (body?.settings) {
            setGlobalSettings(body.settings);
            setGenerationSettings(body.settings);
          }
        })
        .catch((error) => {
          if (settingsSaveRequestRef.current !== requestId) return;
          setGlobalSettings(previousSettings);
          setGenerationSettings(previousSettings);
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to save generation defaults"
          );
        });
    },
    [globalSettings]
  );

  const updateGenerationSettings = useCallback(
    (nextSettings: ImageSettings) => {
      setGenerationSettings(nextSettings);
      setHasGenerationOverride(!settingsEqual(nextSettings, globalSettings));
    },
    [globalSettings]
  );

  const resetGenerationSettings = useCallback(() => {
    setGenerationSettings(globalSettings);
    setHasGenerationOverride(false);
  }, [globalSettings]);

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
    let ignore = false;

    async function loadGenerationDefaults() {
      const response = await fetch("/api/settings/generation");
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.settings || ignore) return;
      setGlobalSettings(body.settings);
      setGenerationSettings(body.settings);
      setHasGenerationOverride(false);
    }

    void loadGenerationDefaults();

    return () => {
      ignore = true;
    };
  }, []);

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

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = (e.clipboardData as DataTransfer)?.items;
      if (!items) return;

      const imageItems = Array.from(items).filter((item) =>
        item.type.startsWith("image/")
      );

      if (imageItems.length > 0) {
        for (let i = 0; i < imageItems.length; i++) {
          const file = imageItems[i].getAsFile();
          if (file) await uploadAndAddImage(file, i);
        }
      } else {
        pasteCopiedImage();
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  });

  useEffect(() => {
    if (trRef.current) {
      const selectedNodes = Array.from(selectedImages)
        .map((id) => imageRefs.current.get(id))
        .filter(Boolean);
      trRef.current.nodes(selectedNodes);
      trRef.current.getLayer().batchDraw();
    }
  }, [selectedImages]);

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

  async function uploadAsset(file: File): Promise<AssetResponse> {
    if (!currentProjectId) throw new Error("Select a project first");
    const form = new FormData();
    form.append("file", file);
    const response = await fetch(`/api/projects/${currentProjectId}/assets`, {
      method: "POST",
      body: form,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(body?.error || "Upload failed");
    }
    return body.asset;
  }

  async function uploadAndAddImage(file: File, index = 0) {
    try {
      const asset = await uploadAsset(file);
      await addImageFromSrc(
        `${asset.url}?v=${Date.now()}`,
        index,
        getCurrentCenterPosition,
        asset.id
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    }
  }

  const handleSendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text) return;

    const selectedIds = new Set<string | number>(Array.from(selectedImages));
    setInputText("");
    await callGenerateImage(text, selectedIds);
  }, [inputText, selectedImages, callGenerateImage]);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      void handleSendMessage();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith("image/")) {
        await uploadAndAddImage(file, i);
      }
    }
    if (e.target) e.target.value = "";
  };

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
  }

  const dotPattern = createDotPattern();
  const backgroundStyle: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundImage: `url(${dotPattern})`,
    backgroundSize: `${30 * stageScale}px ${30 * stageScale}px`,
    backgroundPosition: `${stagePos.x % (30 * stageScale)}px ${
      stagePos.y % (30 * stageScale)
    }px`,
    pointerEvents: "none",
    zIndex: 0,
  };

  return (
    <div
      style={{
        overflow: "hidden",
        height: "100vh",
        width: "100vw",
        position: "relative",
      }}
      onMouseDown={hideContextMenu}
    >
      <Toaster position="top-center" />

      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        multiple
        accept="image/*"
        onChange={handleFileUpload}
      />

      <div style={backgroundStyle} />

      <div style={{ position: "relative", zIndex: 1 }}>
        <Stage
          ref={stageRef}
          width={stageDimensions.width}
          height={stageDimensions.height}
          x={stagePos.x}
          y={stagePos.y}
          scaleX={stageScale}
          scaleY={stageScale}
          draggable={tool === "hand"}
          onWheel={handleWheel}
          onDragMove={handleStageDrag}
          onDragEnd={handleStageDrag}
          onMouseDown={handleStageMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{ cursor: getCursor() }}
        >
          <Layer>
            {relationshipLines.map((line) => (
              <RelationshipCurve
                key={line.key}
                start={line.start}
                control={line.control}
                end={line.end}
                stageScale={stageScale}
                onControlDragMove={(point) =>
                  handleRelationshipControlMove(
                    line.targetId,
                    line.sourceId,
                    point
                  )
                }
              />
            ))}

            {images.map((image) => (
              <CanvasImage
                key={image.id}
                ref={(node) => {
                  if (node) {
                    imageRefs.current.set(image.id, node);
                  } else {
                    imageRefs.current.delete(image.id);
                  }
                }}
                imageData={image}
                isSelected={selectedImages.has(image.id)}
                isDraggable={tool === "mouse"}
                onSelect={(e: any) => {
                  if (tool !== "mouse") {
                    e.cancelBubble = true;
                    return;
                  }
                  handleImageSelect(image.id, e);
                }}
                onDragMove={(e: any) => handleImageDragMove(image.id, e)}
                onDragEnd={(e: any) => handleImageDragEnd(image.id, e)}
                onTransform={(e: any) => handleImageTransform(image.id, e)}
                onContextMenu={(e: any) => handleContextMenu(e, image)}
              />
            ))}

            <Transformer
              ref={trRef}
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < 50 || newBox.height < 50) {
                  return oldBox;
                }
                return newBox;
              }}
            />

            {isSelecting && (
              <Rect
                x={selectionRect.x}
                y={selectionRect.y}
                width={selectionRect.width}
                height={selectionRect.height}
                fill="rgba(0, 162, 255, 0.1)"
                stroke="#00a2ff"
                strokeWidth={1 / stageScale}
                dash={[5 / stageScale, 5 / stageScale]}
              />
            )}
          </Layer>
        </Stage>
      </div>

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
              <p className="truncate text-xs text-neutral-500">
                {initialUser.username}
              </p>
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
              onClick={() => void createProject()}
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
                  onChange={(event) =>
                    setRenamingProjectName(event.target.value)
                  }
                  onClick={(event) => event.stopPropagation()}
                  onDoubleClick={(event) => event.stopPropagation()}
                  onBlur={() => void commitProjectRename(project)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.currentTarget.blur();
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      cancelProjectRename();
                    }
                  }}
                  className="h-9 rounded px-2 text-sm"
                  aria-label={`Rename ${project.name}`}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => hydrateProject(project)}
                  onDoubleClick={() => startProjectRename(project)}
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
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onSave={contextMenu.onSave}
        />
      )}

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        user={initialUser}
        settings={globalSettings}
        onSettingsChange={updateGlobalSettings}
        onLogout={() => void logout()}
      />

      <div
        className="fixed bottom-20 left-1/2 w-[min(640px,calc(100vw-32px))] -translate-x-1/2 transform"
        style={{ zIndex: 10 }}
      >
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
          <div className="flex items-center">
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyPress}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              placeholder={promptPlaceholder}
              className="h-11 min-w-0 flex-1 border-0 focus-visible:ring-0"
              disabled={isGenerating || !currentProjectId}
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Send prompt"
              onClick={() => void handleSendMessage()}
              className="h-11 w-11 rounded-none"
              disabled={isGenerating || !currentProjectId}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center justify-between border-t border-neutral-100 px-2 py-1.5">
            <div className="flex min-w-0 items-center gap-1">
              <PromptSettingSelect
                label="Size"
                value={generationSettings.size}
                values={IMAGE_SIZES}
                disabled={isGenerating || !currentProjectId}
                onValueChange={(value) =>
                  updateGenerationSettings({
                    ...generationSettings,
                    size: value as ImageSettings["size"],
                  })
                }
              />
              <PromptSettingSelect
                label="Quality"
                value={generationSettings.quality}
                values={IMAGE_QUALITIES}
                disabled={isGenerating || !currentProjectId}
                onValueChange={(value) =>
                  updateGenerationSettings({
                    ...generationSettings,
                    quality: value as ImageSettings["quality"],
                  })
                }
              />
              <PromptSettingSelect
                label="Format"
                value={generationSettings.outputFormat}
                values={IMAGE_OUTPUT_FORMATS}
                disabled={isGenerating || !currentProjectId}
                onValueChange={(value) =>
                  updateGenerationSettings({
                    ...generationSettings,
                    outputFormat: value as ImageSettings["outputFormat"],
                  })
                }
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Use global generation defaults"
              onClick={resetGenerationSettings}
              className="h-7 w-7 text-neutral-500"
              disabled={!hasGenerationOverride || isGenerating}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <div
        className="fixed bottom-6 left-1/2 flex -translate-x-1/2 transform items-center gap-4"
        style={{ zIndex: 10 }}
      >
        <div className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white p-1 shadow-sm">
          <Button
            variant={tool === "mouse" ? "default" : "ghost"}
            size="icon"
            aria-label="Select tool"
            onClick={() => setTool("mouse")}
            className="h-8 w-8"
          >
            <Mouse className="h-4 w-4" />
          </Button>
          <Button
            variant={tool === "hand" ? "default" : "ghost"}
            size="icon"
            aria-label="Pan tool"
            onClick={() => setTool("hand")}
            className="h-8 w-8"
          >
            <Hand className="h-4 w-4" />
          </Button>
          <div className="mx-1 h-6 w-px bg-neutral-200" />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Upload image"
            onClick={() => fileInputRef.current?.click()}
            className="h-8 w-8"
            disabled={!currentProjectId}
          >
            <Upload className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open settings"
            onClick={() => setSettingsOpen(true)}
            className="h-8 w-8"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white p-1 shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Zoom out"
            onClick={() => handleZoom("out")}
            className="h-8 w-8"
          >
            <Minus className="h-4 w-4" />
          </Button>

          <button
            onClick={resetZoom}
            className="min-w-[60px] rounded px-2 text-center text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
          >
            {Math.round(stageScale * 100)}%
          </button>

          <Button
            variant="ghost"
            size="icon"
            aria-label="Zoom in"
            onClick={() => handleZoom("in")}
            className="h-8 w-8"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
