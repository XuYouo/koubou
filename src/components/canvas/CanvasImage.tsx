import { forwardRef, useEffect, useMemo, useState } from "react";
import {
  Circle,
  Group,
  Image as KonvaImage,
  Rect,
  Text,
} from "react-konva";
import type { CanvasImageData } from "../../lib/types";
import { useImageFromSrc } from "@/hooks/useImageFromSrc";

type CanvasImageProps = {
  imageData: CanvasImageData;
  isSelected: boolean;
  onSelect: (e: any) => void;
  onDragEnd: (e: any) => void;
  onTransform: (e: any) => void;
  onContextMenu: (e: any) => void;
};

function LoadingDotMatrix({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  const [time, setTime] = useState(0);
  const dots = useMemo(() => {
    const columns = 13;
    const rows = 13;
    const padding = Math.max(26, Math.min(width, height) * 0.11);
    const availableWidth = Math.max(1, width - padding * 2);
    const availableHeight = Math.max(1, height - padding * 2);
    const stepX = availableWidth / (columns - 1);
    const stepY = availableHeight / (rows - 1);

    return Array.from({ length: rows * columns }, (_, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;
      return {
        key: `${row}-${column}`,
        x: padding + column * stepX,
        y: padding + row * stepY,
        diagonal: row + column,
      };
    });
  }, [height, width]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTime(performance.now());
    }, 70);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <>
      {dots.map((dot) => {
        const wave = Math.sin(time / 360 - dot.diagonal * 0.34);
        const intensity = (wave + 1) / 2;
        return (
          <Circle
            key={dot.key}
            x={dot.x}
            y={dot.y}
            radius={1.7 + intensity * 3.4}
            fill="#111827"
            opacity={0.12 + intensity * 0.72}
          />
        );
      })}
    </>
  );
}

export const CanvasImage = forwardRef<any, CanvasImageProps>(
  (
    { imageData, isSelected, onSelect, onDragEnd, onTransform, onContextMenu },
    ref
  ) => {
    const image = useImageFromSrc(imageData.src);

    if (imageData.isGenerating) {
      return (
        <Group
          ref={ref}
          x={imageData.x}
          y={imageData.y}
          width={imageData.width}
          height={imageData.height}
          draggable
          onClick={onSelect}
          onTap={onSelect}
          onDragEnd={onDragEnd}
          onTransformEnd={onTransform}
          onContextMenu={onContextMenu}
        >
          <Rect
            width={imageData.width}
            height={imageData.height}
            fill="#fbfbf8"
            stroke={isSelected ? "#007AFF" : "#d4d4d0"}
            strokeWidth={isSelected ? 4 : 1.5}
            shadowColor="#111827"
            shadowOpacity={0.08}
            shadowBlur={18}
            shadowOffset={{ x: 0, y: 8 }}
          />
          <Rect
            x={10}
            y={10}
            width={Math.max(0, imageData.width - 20)}
            height={Math.max(0, imageData.height - 20)}
            stroke="#e7e5df"
            strokeWidth={1}
            dash={[5, 8]}
          />
          <LoadingDotMatrix
            width={imageData.width}
            height={imageData.height}
          />
          <Text
            x={0}
            y={imageData.height - 42}
            width={imageData.width}
            align="center"
            text={
              imageData.inputImageIds?.length
                ? "Editing selected references"
                : "Generating image"
            }
            fontSize={13}
            fontStyle="500"
            fill="#525252"
          />
        </Group>
      );
    }

    return (
      <KonvaImage
        ref={ref}
        image={image}
        x={imageData.x}
        y={imageData.y}
        width={imageData.width}
        height={imageData.height}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={onDragEnd}
        onTransformEnd={onTransform}
        onContextMenu={onContextMenu}
        stroke={isSelected ? "#007AFF" : "transparent"}
        strokeWidth={isSelected ? 4 : 0}
      />
    );
  }
);
