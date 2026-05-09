"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Stage, Layer, Rect, Transformer } from "react-konva";
import { Toaster, toast } from "sonner";
import {
  Hand,
  Minus,
  Mouse,
  Plus,
  Send,
  Settings,
  Upload,
  FolderPlus,
} from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CanvasImage } from "@/components/canvas/CanvasImage";
import { LoadingSpinner } from "@/components/canvas/LoadingSpinner";
import { ContextMenu } from "@/components/canvas/ContextMenu";
import { SettingsDialog } from "@/components/workbench/SettingsDialog";
import { useStage } from "@/hooks/useStage";
import { useCanvas } from "@/hooks/useCanvas";
import { useImages } from "@/hooks/useImages";
import { useGeneration } from "@/hooks/useGeneration";
import { createDotPattern } from "@/lib/utils";
import {
  DEFAULT_IMAGE_SETTINGS,
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

export default function App({ initialUser }: AppProps) {
  const router = useRouter();
  const [, setIsInputFocused] = useState(false);
  const [inputText, setInputText] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("Untitled project");
  const [settings, setSettings] = useState<ImageSettings>(
    DEFAULT_IMAGE_SETTINGS
  );
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const hasLoadedProjectRef = useRef(false);
  const hasRequestedInitialProjectsRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stageRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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

  const { isGenerating, shouldBlur, callGenerateImage } = useGeneration(
    currentProjectId,
    setSettingsOpen,
    images,
    setImages,
    getCurrentCenterPosition,
    settings
  );

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

  const handleDragEnd = (e: any) => {
    if (tool === "hand") {
      setStagePos(e.currentTarget.position());
    }
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

      {isGenerating && <LoadingSpinner />}

      <div style={backgroundStyle} />

      <motion.div
        animate={{ filter: shouldBlur ? "blur(4px)" : "blur(0px)" }}
        transition={{ duration: 0.3 }}
        style={{ position: "relative", zIndex: 1 }}
      >
        <Stage
          ref={stageRef}
          width={stageDimensions.width}
          height={stageDimensions.height}
          x={stagePos.x}
          y={stagePos.y}
          scaleX={stageScale}
          scaleY={stageScale}
          draggable={tool === "hand"}
          onDragEnd={handleDragEnd}
          onWheel={handleWheel}
          onMouseDown={handleStageMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{ cursor: getCursor() }}
        >
          <Layer>
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
                onSelect={(e: any) => handleImageSelect(image.id, e)}
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
      </motion.div>

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
            <button
              key={project.id}
              type="button"
              onClick={() => hydrateProject(project)}
              className={`mb-1 w-full truncate rounded px-2 py-2 text-left text-sm ${
                currentProjectId === project.id
                  ? "bg-neutral-950 text-white"
                  : "text-neutral-700 hover:bg-neutral-100"
              }`}
            >
              {project.name}
            </button>
          ))}
        </div>
        <div className="border-t border-neutral-200 p-3 text-xs text-neutral-500">
          <div className="flex items-center justify-between">
            <span>{settings.size}</span>
            <span>{settings.quality}</span>
            <span>{settings.outputFormat}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
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
        settings={settings}
        onSettingsChange={setSettings}
        projectName={projectName}
        onProjectNameChange={setProjectName}
        onLogout={() => void logout()}
      />

      <div
        className="fixed bottom-20 left-1/2 flex -translate-x-1/2 transform items-center gap-2"
        style={{ zIndex: 10 }}
      >
        <div className="flex items-center rounded-lg border border-neutral-200 bg-white shadow-sm">
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyPress}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            placeholder="What do you want to create?"
            className="min-w-[360px] border-0 focus:ring-2"
            disabled={isGenerating || !currentProjectId}
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Send prompt"
            onClick={() => void handleSendMessage()}
            className="h-10 w-10 rounded-l-none rounded-r-lg"
            disabled={isGenerating || !currentProjectId}
          >
            <Send className="h-4 w-4" />
          </Button>
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
