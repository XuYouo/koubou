import { Brush, Eraser, RotateCcw, Undo2, X } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { MaskEditTool } from "@/lib/mask-edit";
import { cn } from "@/lib/utils";

type MaskEditControlsProps = {
  tool: MaskEditTool;
  brushSize: number;
  strokesCount: number;
  disabled: boolean;
  className?: string;
  onToolChange: (tool: MaskEditTool) => void;
  onBrushSizeChange: (size: number) => void;
  onUndo: () => void;
  onClear: () => void;
  onCancel: () => void;
};

export function MaskEditControls({
  tool,
  brushSize,
  strokesCount,
  disabled,
  className,
  onToolChange,
  onBrushSizeChange,
  onUndo,
  onClear,
  onCancel,
}: MaskEditControlsProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-2.5 py-2 shadow-sm",
        className
      )}
    >
      <div className="flex items-center gap-1">
        <ToolButton
          label="Brush"
          active={tool === "brush"}
          disabled={disabled}
          onClick={() => onToolChange("brush")}
        >
          <Brush className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="Eraser"
          active={tool === "eraser"}
          disabled={disabled}
          onClick={() => onToolChange("eraser")}
        >
          <Eraser className="h-4 w-4" />
        </ToolButton>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-2 px-1">
        <span className="text-xs font-medium text-neutral-500">Size</span>
        <input
          aria-label="Brush size"
          type="range"
          min={8}
          max={120}
          value={brushSize}
          disabled={disabled}
          onChange={(event) => onBrushSizeChange(Number(event.target.value))}
          className="h-2 min-w-0 flex-1 accent-neutral-900"
        />
        <span className="w-8 text-right text-xs tabular-nums text-neutral-500">
          {brushSize}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <ToolButton
          label="Undo"
          disabled={disabled || strokesCount === 0}
          onClick={onUndo}
        >
          <Undo2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="Clear mask"
          disabled={disabled || strokesCount === 0}
          onClick={onClear}
        >
          <RotateCcw className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="Cancel mask edit"
          disabled={disabled}
          onClick={onCancel}
        >
          <X className="h-4 w-4" />
        </ToolButton>
      </div>
    </div>
  );
}

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={active ? "default" : "ghost"}
          size="icon"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          className="h-8 w-8"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}
