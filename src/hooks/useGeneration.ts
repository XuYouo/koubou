import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";

import type { CanvasImageData } from "@/lib/types";
import type { ImageSettings } from "@/lib/image-options";
import { generateId, makePlaceholderSVGDataUrl } from "@/lib/utils";

export function useGeneration(
  projectId: string | null,
  setConfigOpen: (open: boolean) => void,
  images: CanvasImageData[],
  setImages: (
    images: CanvasImageData[] | ((prev: CanvasImageData[]) => CanvasImageData[])
  ) => void,
  getCurrentCenterPosition: () => { x: number; y: number },
  settings: ImageSettings
) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [shouldBlur, setShouldBlur] = useState(false);
  const generationMapRef = useRef<Record<string, string | number>>({});

  const callGenerateImage = useCallback(
    async (prompt: string, selectedIds: Set<string | number>) => {
      if (!projectId) {
        setConfigOpen(true);
        toast.error("Create or select a project before generating.");
        return;
      }

      setIsGenerating(true);
      setShouldBlur(true);

      const placeholderId = generateId("placeholder");
      const placeholderSrc = makePlaceholderSVGDataUrl(500, 500);
      const center = getCurrentCenterPosition();
      const placeholderImage: CanvasImageData = {
        id: placeholderId,
        src: placeholderSrc,
        x: center.x - 250,
        y: center.y - 250,
        width: 500,
        height: 500,
        isPlaceholder: true,
        isGenerating: true,
      };

      setImages((prev) => [...prev, placeholderImage]);

      const requestId = generateId("genreq");
      generationMapRef.current[requestId] = placeholderId;

      try {
        const selectedAssetIds = Array.from(selectedIds)
          .map((id) => images.find((image) => image.id === id)?.assetId)
          .filter((assetId): assetId is string => Boolean(assetId));

        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            prompt,
            selectedAssetIds,
            size: settings.size,
            quality: settings.quality,
            outputFormat: settings.outputFormat,
          }),
        });

        const body = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(body?.error || "Generation failed");
        }

        const asset = body?.asset;
        if (!asset?.url || !asset?.id) {
          throw new Error("Generation response did not include an image");
        }

        const dataUrl = `${asset.url}?v=${Date.now()}`;
        const placeholderImageId = generationMapRef.current[requestId];

        const img = new Image();
        img.onload = () => {
          const aspectRatio = img.width / img.height;
          const maxSize = 500;
          let width, height;

          if (img.width > img.height) {
            width = maxSize;
            height = maxSize / aspectRatio;
          } else {
            height = maxSize;
            width = maxSize * aspectRatio;
          }

          setTimeout(() => {
            setImages((prev) =>
              prev.map((imgObj) =>
                imgObj.id === placeholderImageId
                  ? {
                      ...imgObj,
                      assetId: asset.id,
                      src: dataUrl,
                      width,
                      height,
                      x: center.x - width / 2,
                      y: center.y - height / 2,
                      isPlaceholder: false,
                      isGenerating: false,
                      generationRequestId: undefined,
                    }
                  : imgObj
              )
            );

            setTimeout(() => {
              setShouldBlur(false);
              setIsGenerating(false);
            }, 300);

            delete generationMapRef.current[requestId];
          }, 500);
        };

        img.onerror = () => {
          throw new Error("Failed to load generated image");
        };
        img.src = dataUrl;
      } catch (err) {
        const placeholderImageId = generationMapRef.current[requestId];
        setImages((prev) =>
          prev.filter((img) => img.id !== placeholderImageId)
        );
        toast.error(err instanceof Error ? err.message : "Generation failed");
        setIsGenerating(false);
        setShouldBlur(false);
      }
    },
    [
      projectId,
      settings,
      images,
      getCurrentCenterPosition,
      setConfigOpen,
      setImages,
    ]
  );

  return { isGenerating, shouldBlur, callGenerateImage };
}
