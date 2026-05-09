import { useMemo } from "react";
import { Group, Image as KonvaImage, Rect } from "react-konva";

import { useImageFromSrc } from "@/hooks/useImageFromSrc";
import { renderMaskOverlayDataUrl, type MaskStroke } from "@/lib/mask-edit";
import type { CanvasImageData } from "@/lib/types";

type MaskOverlayProps = {
  image: CanvasImageData;
  strokes: MaskStroke[];
  stageScale: number;
};

export function MaskOverlay({ image, strokes, stageScale }: MaskOverlayProps) {
  const overlaySrc = useMemo(
    () =>
      renderMaskOverlayDataUrl({
        width: image.width,
        height: image.height,
        strokes,
      }),
    [image.height, image.width, strokes]
  );
  const overlay = useImageFromSrc(overlaySrc);

  return (
    <Group x={image.x} y={image.y} listening={false}>
      <Rect
        width={image.width}
        height={image.height}
        fill="rgba(0, 122, 255, 0.035)"
        stroke="#007AFF"
        strokeWidth={1.5 / stageScale}
        dash={[8 / stageScale, 6 / stageScale]}
      />
      {overlay && (
        <KonvaImage
          image={overlay}
          width={image.width}
          height={image.height}
        />
      )}
    </Group>
  );
}
