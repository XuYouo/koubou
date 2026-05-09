import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";

import type { CanvasImageData } from "@/lib/types";
import type { ImageSettings } from "@/lib/image-options";
import { generateId } from "@/lib/utils";

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
  const generationMapRef = useRef<Record<string, string | number>>({});

  const callGenerateImage = useCallback(
    async (prompt: string, selectedIds: Set<string | number>) => {
      if (!projectId) {
        setConfigOpen(true);
        toast.error("Create or select a project before generating.");
        return;
      }

      if (selectedIds.size > 16) {
        toast.error("You can edit with up to 16 selected reference images.");
        return;
      }

      const selectedSourceImages = Array.from(selectedIds)
        .map((id) => images.find((image) => image.id === id))
        .filter((image): image is CanvasImageData => Boolean(image));
      const selectedAssetIds = selectedSourceImages
        .map((image) => image.assetId)
        .filter((assetId): assetId is string => Boolean(assetId));

      if (
        selectedIds.size > 0 &&
        selectedAssetIds.length !== selectedSourceImages.length
      ) {
        toast.error("Selected references must be uploaded or generated images.");
        return;
      }

      const placeholderId = generateId("placeholder");
      const center = getCurrentCenterPosition();
      const placeholderSize = 500;
      const placeholderPosition =
        selectedSourceImages.length > 0
          ? getEditResultPosition(selectedSourceImages, placeholderSize)
          : {
              x: center.x - placeholderSize / 2,
              y: center.y - placeholderSize / 2,
            };
      const placeholderImage: CanvasImageData = {
        id: placeholderId,
        src: "",
        createdAt: new Date().toISOString(),
        x: placeholderPosition.x,
        y: placeholderPosition.y,
        width: placeholderSize,
        height: placeholderSize,
        isPlaceholder: true,
        isGenerating: true,
        inputImageIds: selectedSourceImages.map((image) => image.id),
      };

      setIsGenerating(true);
      setImages((prev) => [...prev, placeholderImage]);

      const requestId = generateId("genreq");
      generationMapRef.current[requestId] = placeholderId;

      try {
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

        const loadedImage = await loadImage(dataUrl);
        const aspectRatio = loadedImage.width / loadedImage.height;
        const maxSize = 500;
        const width =
          loadedImage.width > loadedImage.height
            ? maxSize
            : maxSize * aspectRatio;
        const height =
          loadedImage.width > loadedImage.height
            ? maxSize / aspectRatio
            : maxSize;

        await new Promise((resolve) => window.setTimeout(resolve, 350));

        setImages((prev) =>
          prev.map((imgObj) =>
            imgObj.id === placeholderImageId
              ? {
                  ...imgObj,
                  assetId: asset.id,
                  src: dataUrl,
                  width,
                  height,
                  x: placeholderPosition.x + placeholderSize / 2 - width / 2,
                  y: placeholderPosition.y + placeholderSize / 2 - height / 2,
                  isPlaceholder: false,
                  isGenerating: false,
                  generationRequestId: undefined,
                  inputImageIds: selectedSourceImages.map((image) => image.id),
                }
              : imgObj
          )
        );

        delete generationMapRef.current[requestId];
        setIsGenerating(false);
      } catch (err) {
        const placeholderImageId = generationMapRef.current[requestId];
        setImages((prev) =>
          prev.filter((img) => img.id !== placeholderImageId)
        );
        toast.error(err instanceof Error ? err.message : "Generation failed");
        setIsGenerating(false);
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

  return { isGenerating, callGenerateImage };
}

function getEditResultPosition(images: CanvasImageData[], size: number) {
  const bounds = images.reduce(
    (acc, image) => ({
      left: Math.min(acc.left, image.x),
      top: Math.min(acc.top, image.y),
      right: Math.max(acc.right, image.x + image.width),
      bottom: Math.max(acc.bottom, image.y + image.height),
    }),
    {
      left: Number.POSITIVE_INFINITY,
      top: Number.POSITIVE_INFINITY,
      right: Number.NEGATIVE_INFINITY,
      bottom: Number.NEGATIVE_INFINITY,
    }
  );

  const centerY = (bounds.top + bounds.bottom) / 2;
  return {
    x: bounds.right + 140,
    y: centerY - size / 2,
  };
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load generated image"));
    img.src = src;
  });
}
