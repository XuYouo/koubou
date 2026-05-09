"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Toaster } from "sonner";

import { ContextMenu } from "@/components/canvas/ContextMenu";
import { CanvasBackground } from "@/components/workbench/CanvasBackground";
import { DeleteProjectDialog } from "@/components/workbench/DeleteProjectDialog";
import { ImageInspectorPanel } from "@/components/workbench/ImageInspectorPanel";
import { MaskEditWorkspace } from "@/components/workbench/MaskEditWorkspace";
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
import { usePartialImageEdit } from "@/hooks/usePartialImageEdit";
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

  const partialImageEdit = usePartialImageEdit({
    projectId: currentProjectId,
    images,
    selectedImages,
    setImages,
    setSelectedImages,
    settings: generationSettings,
  });

  const { fileInputRef, handleFileUpload } = useCanvasUploads({
    currentProjectId,
    addImageFromSrc,
    getCurrentCenterPosition,
    pasteCopiedImage,
  });

  const isEditingSelection = selectedImages.size > 0;
  const isMaskEditMode = Boolean(partialImageEdit.session);
  const promptPlaceholder = partialImageEdit.session
    ? "Describe the full edited image..."
    : isEditingSelection
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

    if (partialImageEdit.session) {
      const accepted = await partialImageEdit.submit(text);
      if (accepted) setInputText("");
      return;
    }

    const selectedIds = new Set<string | number>(Array.from(selectedImages));
    setInputText("");
    await callGenerateImage(text, selectedIds);
  }, [inputText, partialImageEdit, selectedImages, callGenerateImage]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
  }

  const handleStartMaskEdit = useCallback(() => {
    setTool("mouse");
    partialImageEdit.start();
  }, [partialImageEdit, setTool]);

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

      <div
        aria-hidden={isMaskEditMode}
        className={
          isMaskEditMode
            ? "pointer-events-none opacity-20 transition-opacity duration-200"
            : "opacity-100 transition-opacity duration-200"
        }
      >
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
          onImageDoubleClick={(event, image) => {
            event.cancelBubble = true;
            setTool("mouse");
            partialImageEdit.startForImage(image);
          }}
          maskEditImage={null}
          maskEditStrokes={[]}
          onMaskPointerDown={partialImageEdit.handlePointerDown}
          onMaskPointerMove={partialImageEdit.handlePointerMove}
          onMaskPointerUp={partialImageEdit.handlePointerUp}
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
      </div>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        user={initialUser}
        settings={globalSettings}
        onSettingsChange={updateGlobalSettings}
        onLogout={() => void logout()}
      />

      {!isMaskEditMode && (
        <>
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
            canStartMaskEdit={partialImageEdit.canStart}
            isMaskEditing={false}
            stageScale={stageScale}
            onToolChange={setTool}
            onStartMaskEdit={handleStartMaskEdit}
            onUpload={() => fileInputRef.current?.click()}
            onOpenSettings={() => setSettingsOpen(true)}
            onZoom={handleZoom}
            onResetZoom={resetZoom}
          />
        </>
      )}

      {partialImageEdit.session && partialImageEdit.targetImage && (
        <MaskEditWorkspace
          image={partialImageEdit.targetImage}
          tool={partialImageEdit.session.tool}
          brushSize={partialImageEdit.session.brushSize}
          strokes={partialImageEdit.session.strokes}
          disabled={partialImageEdit.isSubmitting}
          prompt={inputText}
          settings={partialImageEdit.editSettings}
          onPromptChange={setInputText}
          onSubmit={() => void handleSendMessage()}
          onToolChange={partialImageEdit.setTool}
          onBrushSizeChange={partialImageEdit.setBrushSize}
          onUndo={partialImageEdit.undo}
          onClear={partialImageEdit.clear}
          onCancel={partialImageEdit.cancel}
          onSettingsChange={partialImageEdit.setEditSettings}
          onStrokeStart={partialImageEdit.beginStroke}
          onStrokeMove={partialImageEdit.extendStroke}
          onStrokeEnd={partialImageEdit.endStroke}
        />
      )}
    </div>
  );
}
