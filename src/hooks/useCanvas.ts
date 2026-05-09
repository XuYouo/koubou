import { useState, useCallback } from "react";
import type { CanvasImageData } from "@/lib/types";
import { useContextMenu } from "./useContextMenu";

export type CanvasTool = "mouse" | "hand";

export function useCanvas(
  stageRef: any,
  stagePos: any,
  stageScale: any,
  images: CanvasImageData[],
  setSelectedImages: any
) {
  const [tool, setTool] = useState<CanvasTool>("mouse");
  const [isSelecting, setIsSelecting] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [selectionRect, setSelectionRect] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const [selectionStart, setSelectionStart] = useState({ x: 0, y: 0 });
  const { contextMenu, showContextMenu, hideContextMenu } = useContextMenu();

  const getPointerPosition = () => {
    const stage = stageRef.current;
    const pointer = stage.getPointerPosition();
    return {
      x: (pointer.x - stagePos.x) / stageScale,
      y: (pointer.y - stagePos.y) / stageScale,
    };
  };

  const handleMouseDown = (e: any) => {
    if (e.evt.button === 2) return;

    if (tool === "hand") {
      setIsPanning(true);
      hideContextMenu();
      return;
    }

    if (tool === "mouse" && e.target === e.target.getStage()) {
      const pos = getPointerPosition();
      setSelectionStart(pos);
      setSelectionRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
      setIsSelecting(true);
      setSelectedImages(new Set()); // Clear previous selections
    }
    hideContextMenu();
  };

  const handleMouseMove = () => {
    if (!isSelecting || tool !== "mouse") return;

    const pos = getPointerPosition();
    const newRect = {
      x: Math.min(selectionStart.x, pos.x),
      y: Math.min(selectionStart.y, pos.y),
      width: Math.abs(pos.x - selectionStart.x),
      height: Math.abs(pos.y - selectionStart.y),
    };
    setSelectionRect(newRect);

    // Check which images are in selection
    const newSelectedImages = new Set<string | number>();
    images.forEach((image) => {
      if (checkImageInSelection(image, newRect)) {
        newSelectedImages.add(image.id);
      }
    });
    setSelectedImages(newSelectedImages);
  };

  const handleMouseUp = () => {
    setIsSelecting(false);
    setIsPanning(false);
  };

  const handleStageMouseDown = (e: any) => {
    handleMouseDown(e);
  };

  const handleContextMenu = useCallback((e: any, imageData: CanvasImageData) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (stage) {
      const pointerPosition = stage.getPointerPosition();
      if (pointerPosition) {
        showContextMenu(pointerPosition.x, pointerPosition.y, () => {
          console.log('Attempting to save image:', imageData.src);
          const link = document.createElement("a");
          link.download = "image.png";
          link.href = imageData.src;
          document.body.appendChild(link); // Append to body to ensure it's in the DOM
          link.click();
          document.body.removeChild(link); // Clean up the element
          console.log('Link created and clicked.');
        });
      }
    }
  }, [showContextMenu]);

  const checkImageInSelection = (image: CanvasImageData, selection: any) => {
    return (
      image.x < selection.x + selection.width &&
      image.x + image.width > selection.x &&
      image.y < selection.y + selection.height &&
      image.y + image.height > selection.y
    );
  };

  const getCursor = () => {
    if (tool === "hand") return isPanning ? "grabbing" : "grab";
    return "crosshair";
  };

  return {
    tool,
    setTool,
    isSelecting,
    selectionRect,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleStageMouseDown,
    getCursor,
    contextMenu,
    handleContextMenu,
    hideContextMenu,
  };
}
