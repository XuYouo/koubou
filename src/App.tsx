"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Toaster } from "sonner";

import { ContextMenu } from "@/components/canvas/ContextMenu";
import { CanvasBackground } from "@/components/workbench/CanvasBackground";
import { DeleteProjectDialog } from "@/components/workbench/DeleteProjectDialog";
import { ImageInspectorPanel } from "@/components/workbench/ImageInspectorPanel";
import { ProjectActionMenu } from "@/components/workbench/ProjectActionMenu";
import { ProjectSidebar } from "@/components/workbench/ProjectSidebar";
import { PromptBar } from "@/components/workbench/PromptBar";
import { SettingsDialog } from "@/components/workbench/SettingsDialog";
import { UserGalleryPanel } from "@/components/workbench/UserGalleryPanel";
import { WorkbenchCanvas } from "@/components/workbench/WorkbenchCanvas";
import { WorkbenchToolbar } from "@/components/workbench/WorkbenchToolbar";
import { useCanvas } from "@/hooks/useCanvas";
import { useCanvasUploads } from "@/hooks/useCanvasUploads";
import { useGeneration } from "@/hooks/useGeneration";
import { useGenerationSettings } from "@/hooks/useGenerationSettings";
import { useImages } from "@/hooks/useImages";
import { useProjectWorkspace } from "@/hooks/useProjectWorkspace";
import { useStage } from "@/hooks/useStage";
import type { ProjectSummary, SafeUser } from "@/lib/types";

type AppProps = {
  initialUser: SafeUser;
};

export default function App({ initialUser }: AppProps) {
  const router = useRouter();
  const [inputText, setInputText] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const stageRef = useRef<any>(null);

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

  const {
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
  } = useProjectWorkspace({
    images,
    setImages,
    setSelectedImages,
    stagePos,
    setStagePos,
    stageScale,
    setStageScale,
  });

  const {
    globalSettings,
    generationSettings,
    hasGenerationOverride,
    updateGlobalSettings,
    updateGenerationSettings,
    resetGenerationSettings,
  } = useGenerationSettings();

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

  const { fileInputRef, handleFileUpload } = useCanvasUploads({
    currentProjectId,
    addImageFromSrc,
    getCurrentCenterPosition,
    pasteCopiedImage,
  });

  const isEditingSelection = selectedImages.size > 0;
  const promptPlaceholder = isEditingSelection
    ? selectedImages.size === 1
      ? "Edit the selected image: describe the change..."
      : `Edit ${selectedImages.size} selected references: describe the change...`
    : "What do you want to create?";

  const handleStageDrag = useCallback(
    (event: any) => {
      if (tool !== "hand") return;
      setStagePos(event.currentTarget.position());
    },
    [setStagePos, tool]
  );

  const closeFloatingMenus = useCallback(() => {
    hideContextMenu();
    closeProjectContextMenu();
  }, [closeProjectContextMenu, hideContextMenu]);

  const handleProjectResourceSelect = useCallback(
    (project: ProjectSummary, imageId: string | number) => {
      if (currentProjectId !== project.id) {
        hydrateProject(project);
      }
      setSelectedImages(new Set([imageId]));
    },
    [currentProjectId, hydrateProject, setSelectedImages]
  );

  const handleSendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text) return;

    const selectedIds = new Set<string | number>(Array.from(selectedImages));
    setInputText("");
    await callGenerateImage(text, selectedIds);
  }, [inputText, selectedImages, callGenerateImage]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
  }

  return (
    <div
      style={{
        overflow: "hidden",
        height: "100vh",
        width: "100vw",
        position: "relative",
      }}
      onMouseDown={closeFloatingMenus}
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

      <CanvasBackground stagePos={stagePos} stageScale={stageScale} />

      <WorkbenchCanvas
        stageRef={stageRef}
        stageDimensions={stageDimensions}
        stagePos={stagePos}
        stageScale={stageScale}
        tool={tool}
        images={images}
        setImages={setImages}
        selectedImages={selectedImages}
        isSelecting={isSelecting}
        selectionRect={selectionRect}
        onWheel={handleWheel}
        onStageDrag={handleStageDrag}
        onStageMouseDown={handleStageMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        getCursor={getCursor}
        onImageSelect={handleImageSelect}
        onImageDragMove={handleImageDragMove}
        onImageDragEnd={handleImageDragEnd}
        onImageTransform={handleImageTransform}
        onImageContextMenu={handleContextMenu}
      />

      <ProjectSidebar
        username={initialUser.username}
        projects={projects}
        currentProjectId={currentProjectId}
        currentProjectImages={images}
        selectedImages={selectedImages}
        isLoadingProjects={isLoadingProjects}
        isSaving={isSaving}
        renamingProjectId={renamingProjectId}
        renamingProjectName={renamingProjectName}
        renameInputRef={renameInputRef}
        onCreateProject={() => void createProject()}
        onSelectProject={hydrateProject}
        onStartRename={startProjectRename}
        onRenameNameChange={setRenamingProjectName}
        onCommitRename={(project) => void commitProjectRename(project)}
        onCancelRename={cancelProjectRename}
        onOpenContextMenu={openProjectContextMenu}
        onSelectResource={handleProjectResourceSelect}
        onOpenGallery={() => setGalleryOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <UserGalleryPanel
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
      />

      <ImageInspectorPanel images={images} selectedImages={selectedImages} />

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onSave={contextMenu.onSave}
        />
      )}

      <ProjectActionMenu
        menu={projectContextMenu}
        onRequestDelete={(project) => {
          setProjectToDelete(project);
          closeProjectContextMenu();
        }}
      />

      <DeleteProjectDialog
        project={projectToDelete}
        isDeleting={isDeletingProject}
        onCancel={() => setProjectToDelete(null)}
        onConfirm={() => void confirmProjectDelete()}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        user={initialUser}
        settings={globalSettings}
        onSettingsChange={updateGlobalSettings}
        onLogout={() => void logout()}
      />

      <PromptBar
        value={inputText}
        placeholder={promptPlaceholder}
        settings={generationSettings}
        hasGenerationOverride={hasGenerationOverride}
        disabled={isGenerating || !currentProjectId}
        onValueChange={setInputText}
        onSend={() => void handleSendMessage()}
        onSettingsChange={updateGenerationSettings}
        onResetSettings={resetGenerationSettings}
      />

      <WorkbenchToolbar
        tool={tool}
        canUpload={Boolean(currentProjectId)}
        stageScale={stageScale}
        onToolChange={setTool}
        onUpload={() => fileInputRef.current?.click()}
        onOpenSettings={() => setSettingsOpen(true)}
        onZoom={handleZoom}
        onResetZoom={resetZoom}
      />
    </div>
  );
}
