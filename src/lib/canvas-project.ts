import type { CanvasImageData, CanvasProjectState } from "@/lib/types";

export type StageSnapshot = {
  x: number;
  y: number;
  scale: number;
};

export function parseCanvasState(canvasJson: string): CanvasProjectState {
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

export function serializeCanvasState(
  images: CanvasImageData[],
  stage: StageSnapshot
) {
  return JSON.stringify({
    images: images.filter((image) => !image.isPlaceholder),
    stage,
  });
}
