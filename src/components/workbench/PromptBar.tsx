import { RotateCcw, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  IMAGE_OUTPUT_FORMATS,
  IMAGE_QUALITIES,
  IMAGE_SIZES,
  type ImageSettings,
} from "@/lib/image-options";

type PromptBarProps = {
  value: string;
  placeholder: string;
  settings: ImageSettings;
  hasGenerationOverride: boolean;
  disabled: boolean;
  onValueChange: (value: string) => void;
  onSend: () => void;
  onSettingsChange: (settings: ImageSettings) => void;
  onResetSettings: () => void;
};

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

export function PromptBar({
  value,
  placeholder,
  settings,
  hasGenerationOverride,
  disabled,
  onValueChange,
  onSend,
  onSettingsChange,
  onResetSettings,
}: PromptBarProps) {
  return (
    <div
      className="fixed bottom-20 left-1/2 w-[min(640px,calc(100vw-32px))] -translate-x-1/2 transform"
      style={{ zIndex: 10 }}
    >
      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div className="flex items-center">
          <Input
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void onSend();
              }
            }}
            placeholder={placeholder}
            className="h-11 min-w-0 flex-1 border-0 focus-visible:ring-0"
            disabled={disabled}
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Send prompt"
            onClick={() => void onSend()}
            className="h-11 w-11 rounded-none"
            disabled={disabled}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center justify-between border-t border-neutral-100 px-2 py-1.5">
          <div className="flex min-w-0 items-center gap-1">
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
          <Button
            variant="ghost"
            size="icon"
            aria-label="Use global generation defaults"
            onClick={onResetSettings}
            className="h-7 w-7 text-neutral-500"
            disabled={!hasGenerationOverride || disabled}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
