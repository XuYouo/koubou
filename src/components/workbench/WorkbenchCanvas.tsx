import { useCallback, useEffect, useMemo, useRef } from "react";
import { Layer, Rect, Stage, Transformer } from "react-konva";
import type { Dispatch, RefObject, SetStateAction } from "react";

import { CanvasImage } from "@/components/canvas/CanvasImage";
import { MaskOverlay } from "@/components/canvas/MaskOverlay";
import { RelationshipCurve } from "@/components/canvas/RelationshipCurve";
import type { CanvasTool } from "@/hooks/useCanvas";
import type { MaskStroke } from "@/lib/mask-edit";
import type { CanvasImageData } from "@/lib/types";

type Point = {
  x: number;
  y: number;
};

type RelationshipLine = {
  key: string;
  sourceId: string | number;
  targetId: string | number;
  start: Point;
  control: Point;
  end: Point;
};

type WorkbenchCanvasProps = {
  stageRef: RefObject<any>;
  stageDimensions: { width: number; height: number };
  stagePos: Point;
  stageScale: number;
  tool: CanvasTool;
  images: CanvasImageData[];
  setImages: Dispatch<SetStateAction<CanvasImageData[]>>;
  selectedImages: Set<string | number>;
  isSelecting: boolean;
  selectionRect: { x: number; y: number; width: number; height: number };
  onWheel: (event: any) => void;
  onStageDrag: (event: any) => void;
  onStageMouseDown: (event: any) => void;
  onMouseMove: (event: any) => void;
  onMouseUp: (event: any) => void;
  getCursor: () => string;
  onImageSelect: (imageId: string | number, event: any) => void;
  onImageDragMove: (imageId: string | number, event: any) => void;
  onImageDragEnd: (imageId: string | number, event: any) => void;
  onImageTransform: (imageId: string | number, event: any) => void;
  onImageContextMenu: (event: any, image: CanvasImageData) => void;
  onImageDoubleClick: (event: any, image: CanvasImageData) => void;
  maskEditImage: CanvasImageData | null;
  maskEditStrokes: MaskStroke[];
  onMaskPointerDown: (event: any) => void;
  onMaskPointerMove: (event: any) => void;
  onMaskPointerUp: () => void;
};

function imageCenter(image: CanvasImageData) {
  return {
    x: image.x + image.width / 2,
    y: image.y + image.height / 2,
  };
}

function defaultRelationshipControl(start: Point, end: Point) {
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

function buildRelationshipLines(images: CanvasImageData[]) {
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
      .filter((line): line is RelationshipLine => Boolean(line))
  );
}

export function WorkbenchCanvas({
  stageRef,
  stageDimensions,
  stagePos,
  stageScale,
  tool,
  images,
  setImages,
  selectedImages,
  isSelecting,
  selectionRect,
  onWheel,
  onStageDrag,
  onStageMouseDown,
  onMouseMove,
  onMouseUp,
  getCursor,
  onImageSelect,
  onImageDragMove,
  onImageDragEnd,
  onImageTransform,
  onImageContextMenu,
  onImageDoubleClick,
  maskEditImage,
  maskEditStrokes,
  onMaskPointerDown,
  onMaskPointerMove,
  onMaskPointerUp,
}: WorkbenchCanvasProps) {
  const transformerRef = useRef<any>(null);
  const imageRefs = useRef<Map<string | number, any>>(new Map());
  const isMaskEditing = Boolean(maskEditImage);
  const relationshipLines = useMemo(
    () => buildRelationshipLines(images),
    [images]
  );

  const handleRelationshipControlMove = useCallback(
    (
      targetId: string | number,
      sourceId: string | number,
      point: Point
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

  useEffect(() => {
    if (!transformerRef.current) return;
    const selectedNodes = isMaskEditing
      ? []
      : Array.from(selectedImages)
          .map((id) => imageRefs.current.get(id))
          .filter(Boolean);
    transformerRef.current.nodes(selectedNodes);
    transformerRef.current.getLayer().batchDraw();
  }, [isMaskEditing, selectedImages]);

  const handleStageMouseDownEvent = useCallback(
    (event: any) => {
      if (isMaskEditing) {
        onMaskPointerDown(event);
        return;
      }
      onStageMouseDown(event);
    },
    [isMaskEditing, onMaskPointerDown, onStageMouseDown]
  );

  const handleStageMouseMoveEvent = useCallback(
    (event: any) => {
      if (isMaskEditing) {
        onMaskPointerMove(event);
        return;
      }
      onMouseMove(event);
    },
    [isMaskEditing, onMaskPointerMove, onMouseMove]
  );

  const handleStageMouseUpEvent = useCallback((event: any) => {
    if (isMaskEditing) {
      onMaskPointerUp();
      return;
    }
    onMouseUp(event);
  }, [isMaskEditing, onMaskPointerUp, onMouseUp]);

  return (
    <div style={{ position: "relative", zIndex: 1 }}>
      <Stage
        ref={stageRef}
        width={stageDimensions.width}
        height={stageDimensions.height}
        x={stagePos.x}
        y={stagePos.y}
        scaleX={stageScale}
        scaleY={stageScale}
        draggable={tool === "hand" && !isMaskEditing}
        onWheel={onWheel}
        onDragMove={onStageDrag}
        onDragEnd={onStageDrag}
        onMouseDown={handleStageMouseDownEvent}
        onMouseMove={handleStageMouseMoveEvent}
        onMouseUp={handleStageMouseUpEvent}
        onTouchStart={handleStageMouseDownEvent}
        onTouchMove={handleStageMouseMoveEvent}
        onTouchEnd={handleStageMouseUpEvent}
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
              isDraggable={tool === "mouse" && !isMaskEditing}
              onSelect={(event: any) => {
                if (tool !== "mouse" || isMaskEditing) {
                  event.cancelBubble = true;
                  return;
                }
                onImageSelect(image.id, event);
              }}
              onDragMove={(event: any) => onImageDragMove(image.id, event)}
              onDragEnd={(event: any) => onImageDragEnd(image.id, event)}
              onTransform={(event: any) => onImageTransform(image.id, event)}
              onContextMenu={(event: any) => onImageContextMenu(event, image)}
              onDoubleClick={(event: any) => {
                if (isMaskEditing || image.isGenerating) {
                  event.cancelBubble = true;
                  return;
                }
                onImageDoubleClick(event, image);
              }}
            />
          ))}

          {maskEditImage && (
            <MaskOverlay
              image={maskEditImage}
              strokes={maskEditStrokes}
              stageScale={stageScale}
            />
          )}

          <Transformer
            ref={transformerRef}
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
  );
}
