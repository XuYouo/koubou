import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  DEFAULT_IMAGE_SETTINGS,
  type ImageSettings,
} from "@/lib/image-options";

function settingsEqual(left: ImageSettings, right: ImageSettings) {
  return (
    left.size === right.size &&
    left.quality === right.quality &&
    left.outputFormat === right.outputFormat
  );
}

export function useGenerationSettings() {
  const [globalSettings, setGlobalSettings] = useState<ImageSettings>(
    DEFAULT_IMAGE_SETTINGS
  );
  const [generationSettings, setGenerationSettings] = useState<ImageSettings>(
    DEFAULT_IMAGE_SETTINGS
  );
  const [hasGenerationOverride, setHasGenerationOverride] = useState(false);
  const settingsSaveRequestRef = useRef(0);

  useEffect(() => {
    let ignore = false;

    async function loadGenerationDefaults() {
      const response = await fetch("/api/settings/generation");
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.settings || ignore) return;
      setGlobalSettings(body.settings);
      setGenerationSettings(body.settings);
      setHasGenerationOverride(false);
    }

    void loadGenerationDefaults();

    return () => {
      ignore = true;
    };
  }, []);

  const updateGlobalSettings = useCallback(
    (nextSettings: ImageSettings) => {
      const previousSettings = globalSettings;
      const requestId = settingsSaveRequestRef.current + 1;
      settingsSaveRequestRef.current = requestId;
      setGlobalSettings(nextSettings);
      setGenerationSettings(nextSettings);
      setHasGenerationOverride(false);

      void fetch("/api/settings/generation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextSettings),
      })
        .then(async (response) => {
          const body = await response.json().catch(() => null);
          if (!response.ok) {
            throw new Error(body?.error || "Failed to save generation defaults");
          }
          if (settingsSaveRequestRef.current !== requestId) return;
          if (body?.settings) {
            setGlobalSettings(body.settings);
            setGenerationSettings(body.settings);
          }
        })
        .catch((error) => {
          if (settingsSaveRequestRef.current !== requestId) return;
          setGlobalSettings(previousSettings);
          setGenerationSettings(previousSettings);
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to save generation defaults"
          );
        });
    },
    [globalSettings]
  );

  const updateGenerationSettings = useCallback(
    (nextSettings: ImageSettings) => {
      setGenerationSettings(nextSettings);
      setHasGenerationOverride(!settingsEqual(nextSettings, globalSettings));
    },
    [globalSettings]
  );

  const resetGenerationSettings = useCallback(() => {
    setGenerationSettings(globalSettings);
    setHasGenerationOverride(false);
  }, [globalSettings]);

  return {
    globalSettings,
    generationSettings,
    hasGenerationOverride,
    updateGlobalSettings,
    updateGenerationSettings,
    resetGenerationSettings,
  };
}
