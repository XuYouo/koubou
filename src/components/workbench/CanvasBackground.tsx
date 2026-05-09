import { useMemo } from "react";
import type { CSSProperties } from "react";

import { createDotPattern } from "@/lib/utils";

type CanvasBackgroundProps = {
  stagePos: { x: number; y: number };
  stageScale: number;
};

export function CanvasBackground({
  stagePos,
  stageScale,
}: CanvasBackgroundProps) {
  const dotPattern = useMemo(() => createDotPattern(), []);
  const backgroundStyle = useMemo<CSSProperties>(
    () => ({
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
    }),
    [dotPattern, stagePos.x, stagePos.y, stageScale]
  );

  return <div style={backgroundStyle} />;
}
