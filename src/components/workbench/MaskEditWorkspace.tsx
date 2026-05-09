/* eslint-disable @next/next/no-img-element -- Editing needs exact DOM image bounds for the mask canvas. */
import { Send } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type SyntheticEvent,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MaskEditControls } from "@/components/workbench/MaskEditControls";
import {
  IMAGE_OUTPUT_FORMATS,
  IMAGE_QUALITIES,
  IMAGE_SIZES,
  type ImageSettings,
} from "@/lib/image-options";
import {
  renderMaskOverlayDataUrl,
  type MaskEditTool,
  type MaskPoint,
  type MaskStroke,
} from "@/lib/mask-edit";
import type { CanvasImageData } from "@/lib/types";

type MaskEditWorkspaceProps = {
  image: CanvasImageData;
  tool: MaskEditTool;
  brushSize: number;
  strokes: MaskStroke[];
  disabled: boolean;
  prompt: string;
  settings: ImageSettings;
  onPromptChange: (value: string) => void;
  onSubmit: () => void;
  onToolChange: (tool: MaskEditTool) => void;
  onBrushSizeChange: (size: number) => void;
  onUndo: () => void;
  onClear: () => void;
  onCancel: () => void;
  onSettingsChange: (settings: ImageSettings) => void;
  onStrokeStart: (point: MaskPoint, displayMaxSize: number) => void;
  onStrokeMove: (point: MaskPoint) => void;
  onStrokeEnd: () => void;
};

export function MaskEditWorkspace({
  image,
  tool,
  brushSize,
  strokes,
  disabled,
  prompt,
  settings,
  onPromptChange,
  onSubmit,
  onToolChange,
  onBrushSizeChange,
  onUndo,
  onClear,
  onCancel,
  onSettingsChange,
  onStrokeStart,
  onStrokeMove,
  onStrokeEnd,
}: MaskEditWorkspaceProps) {
  const activePointerRef = useRef<number | null>(null);
  const imageFrameRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const [naturalSize, setNaturalSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const syncViewport = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  const displaySize = useMemo(() => {
    if (!naturalSize || !viewport.width || !viewport.height) return null;

    const maxWidth = Math.max(260, viewport.width - 56);
    const maxHeight = Math.max(220, viewport.height - 224);
    const scale = Math.min(
      maxWidth / naturalSize.width,
      maxHeight / naturalSize.height
    );

    return {
      width: Math.round(naturalSize.width * scale),
      height: Math.round(naturalSize.height * scale),
    };
  }, [naturalSize, viewport.height, viewport.width]);

  const overlaySrc = useMemo(() => {
    if (!displaySize) return "";
    return renderMaskOverlayDataUrl({
      width: displaySize.width,
      height: displaySize.height,
      strokes,
    });
  }, [displaySize, strokes]);

  const handleImageLoad = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      const nextNaturalSize = {
        width: event.currentTarget.naturalWidth || 1,
        height: event.currentTarget.naturalHeight || 1,
      };
      setNaturalSize(nextNaturalSize);
    },
    []
  );

  const handleWorkspacePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (disabled) return;

      const target = event.target;
      if (!(target instanceof Node)) return;

      if (imageFrameRef.current?.contains(target)) return;
      if (controlsRef.current?.contains(target)) return;

      onCancel();
    },
    [disabled, onCancel]
  );

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      if (disabled || !displaySize || event.button === 2) return;

      const point = pointFromPointer(event, false);
      if (!point) return;

      event.preventDefault();
      activePointerRef.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      onStrokeStart(point, Math.max(displaySize.width, displaySize.height));
    },
    [disabled, displaySize, onStrokeStart]
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      if (disabled || activePointerRef.current !== event.pointerId) return;

      const point = pointFromPointer(event, true);
      if (!point) return;

      event.preventDefault();
      onStrokeMove(point);
    },
    [disabled, onStrokeMove]
  );

  const handlePointerUp = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      if (activePointerRef.current !== event.pointerId) return;

      event.preventDefault();
      activePointerRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      onStrokeEnd();
    },
    [onStrokeEnd]
  );

  return (
    <div
      className="fixed inset-0 z-30 overflow-hidden bg-neutral-50/90 backdrop-blur-sm"
      onPointerDownCapture={handleWorkspacePointerDown}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="relative flex h-full flex-col px-4 py-4">
        <div className="pointer-events-none flex h-9 items-center justify-between">
          <div className="text-xs font-semibold tracking-[0.18em] text-neutral-500 uppercase">
            Mask edit
          </div>
          <div className="text-xs text-neutral-400">
            {strokes.length} stroke{strokes.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center px-1 pb-36 pt-2">
          <div
            ref={imageFrameRef}
            className="relative overflow-hidden shadow-[0_28px_80px_rgba(15,23,42,0.22)]"
            style={
              displaySize
                ? {
                    width: displaySize.width,
                    height: displaySize.height,
                  }
                : undefined
            }
          >
            <img
              src={image.src}
              alt=""
              draggable={false}
              onLoad={handleImageLoad}
              className="block select-none object-contain"
              style={
                displaySize
                  ? {
                      width: displaySize.width,
                      height: displaySize.height,
                    }
                  : {
                      maxWidth: "calc(100vw - 56px)",
                      maxHeight: "calc(100vh - 224px)",
                    }
              }
            />
            {displaySize && overlaySrc && (
              <img
                src={overlaySrc}
                alt=""
                draggable={false}
                className="pointer-events-none absolute inset-0 h-full w-full select-none"
              />
            )}
            {displaySize && (
              <canvas
                aria-label="Paint edit mask"
                width={displaySize.width}
                height={displaySize.height}
                className="absolute inset-0 h-full w-full touch-none"
                style={{
                  cursor: tool === "eraser" ? "cell" : "crosshair",
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              />
            )}
          </div>
        </div>

        <div
          ref={controlsRef}
          className="pointer-events-auto absolute inset-x-4 bottom-4 mx-auto flex w-[min(780px,calc(100vw-32px))] flex-col gap-2"
        >
          <MaskEditControls
            tool={tool}
            brushSize={brushSize}
            strokesCount={strokes.length}
            disabled={disabled}
            onToolChange={onToolChange}
            onBrushSizeChange={onBrushSizeChange}
            onUndo={onUndo}
            onClear={onClear}
            onCancel={onCancel}
          />

          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
            <div className="flex items-center">
              <Input
                value={prompt}
                onChange={(event) => onPromptChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onSubmit();
                }}
                placeholder="Describe the full edited image..."
                className="h-11 min-w-0 flex-1 border-0 focus-visible:ring-0"
                disabled={disabled}
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Send edit prompt"
                onClick={onSubmit}
                className="h-11 w-11 rounded-none"
                disabled={disabled}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-1 border-t border-neutral-100 px-2 py-1.5">
              <PromptSettingSelect
                label="Size"
                value={settings.size}
                values={IMAGE_SIZES}
                disabled={disabled}
                onValueChange={(value) =>
                  onSettingsChange({
                    ...settings,
                    size: value as ImageSettings["size"],
                  })
                }
              />
              <PromptSettingSelect
                label="Quality"
                value={settings.quality}
                values={IMAGE_QUALITIES}
                disabled={disabled}
                onValueChange={(value) =>
                  onSettingsChange({
                    ...settings,
                    quality: value as ImageSettings["quality"],
                  })
                }
              />
              <PromptSettingSelect
                label="Format"
                value={settings.outputFormat}
                values={IMAGE_OUTPUT_FORMATS}
                disabled={disabled}
                onValueChange={(value) =>
                  onSettingsChange({
                    ...settings,
                    outputFormat: value as ImageSettings["outputFormat"],
                  })
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
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

function pointFromPointer(
  event: PointerEvent<HTMLCanvasElement>,
  clampToCanvas: boolean
): MaskPoint | null {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;

  if (!clampToCanvas && (x < 0 || x > 1 || y < 0 || y > 1)) return null;

  return {
    x: clamp(x, 0, 1),
    y: clamp(y, 0, 1),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
