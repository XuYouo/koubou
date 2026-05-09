import { Brush, Hand, Minus, Mouse, Plus, Settings, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CanvasTool } from "@/hooks/useCanvas";

type WorkbenchToolbarProps = {
  tool: CanvasTool;
  canUpload: boolean;
  canStartMaskEdit: boolean;
  isMaskEditing: boolean;
  stageScale: number;
  onToolChange: (tool: CanvasTool) => void;
  onStartMaskEdit: () => void;
  onUpload: () => void;
  onOpenSettings: () => void;
  onZoom: (direction: "in" | "out") => void;
  onResetZoom: () => void;
};

export function WorkbenchToolbar({
  tool,
  canUpload,
  canStartMaskEdit,
  isMaskEditing,
  stageScale,
  onToolChange,
  onStartMaskEdit,
  onUpload,
  onOpenSettings,
  onZoom,
  onResetZoom,
}: WorkbenchToolbarProps) {
  return (
    <div
      className="fixed bottom-6 left-1/2 flex -translate-x-1/2 transform items-center gap-4"
      style={{ zIndex: 10 }}
    >
      <div className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white p-1 shadow-sm">
        <Button
          variant={tool === "mouse" ? "default" : "ghost"}
          size="icon"
          aria-label="Select tool"
          onClick={() => onToolChange("mouse")}
          className="h-8 w-8"
        >
          <Mouse className="h-4 w-4" />
        </Button>
        <Button
          variant={tool === "hand" ? "default" : "ghost"}
          size="icon"
          aria-label="Pan tool"
          onClick={() => onToolChange("hand")}
          className="h-8 w-8"
        >
          <Hand className="h-4 w-4" />
        </Button>
        <div className="mx-1 h-6 w-px bg-neutral-200" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isMaskEditing ? "default" : "ghost"}
              size="icon"
              aria-label="Mask brush"
              onClick={isMaskEditing ? undefined : onStartMaskEdit}
              className="h-8 w-8"
              disabled={!canStartMaskEdit && !isMaskEditing}
            >
              <Brush className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Mask brush</TooltipContent>
        </Tooltip>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Upload image"
          onClick={onUpload}
          className="h-8 w-8"
          disabled={!canUpload}
        >
          <Upload className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open settings"
          onClick={onOpenSettings}
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
          onClick={() => onZoom("out")}
          className="h-8 w-8"
        >
          <Minus className="h-4 w-4" />
        </Button>

        <button
          onClick={onResetZoom}
          className="min-w-[60px] rounded px-2 text-center text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
        >
          {Math.round(stageScale * 100)}%
        </button>

        <Button
          variant="ghost"
          size="icon"
          aria-label="Zoom in"
          onClick={() => onZoom("in")}
          className="h-8 w-8"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
