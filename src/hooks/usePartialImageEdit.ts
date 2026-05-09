import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";

import {
  normalizeImageSettings,
  type ImageSettings,
} from "@/lib/image-options";
import {
  generateMaskBlob,
  loadImageDimensions,
  type MaskEditTool,
  type MaskPoint,
  type MaskStroke,
} from "@/lib/mask-edit";
import type { CanvasImageData } from "@/lib/types";
import { generateId } from "@/lib/utils";

export type PartialImageEditSession = {
  imageId: string | number;
  assetId: string;
  tool: MaskEditTool;
  brushSize: number;
  strokes: MaskStroke[];
  activeStrokeId: string | null;
};

type UsePartialImageEditOptions = {
  projectId: string | null;
  images: CanvasImageData[];
  selectedImages: Set<string | number>;
  setImages: Dispatch<SetStateAction<CanvasImageData[]>>;
  setSelectedImages: Dispatch<SetStateAction<Set<string | number>>>;
  settings: ImageSettings;
};

type AssetSettingsResponse = {
  assets?: Array<{
    id: string;
    generationSettings?: {
      size: string;
      quality: string;
      outputFormat: string;
    } | null;
  }>;
};

type JobResponse = {
  job?: {
    id: string;
    operation: "GENERATION" | "EDIT";
    status: "RUNNING" | "SUCCEEDED" | "FAILED";
    error?: string | null;
    asset?: {
      id: string;
      url: string;
      mime: string;
      width: number | null;
      height: number | null;
    } | null;
  };
  error?: string;
};

const DEFAULT_BRUSH_SIZE = 36;
const POLL_INTERVAL_MS = 1500;

export function usePartialImageEdit({
  projectId,
  images,
  selectedImages,
  setImages,
  setSelectedImages,
  settings,
}: UsePartialImageEditOptions) {
  const [session, setSession] = useState<PartialImageEditSession | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editSettings, setEditSettings] = useState<ImageSettings>(settings);
  const inheritedSettingsRequestRef = useRef(0);
  const hasEditedSettingsRef = useRef(false);

  const targetImage = useMemo(
    () => images.find((image) => image.id === session?.imageId) || null,
    [images, session?.imageId]
  );

  const canStart = useMemo(() => {
    if (selectedImages.size !== 1) return false;
    const selectedId = selectedImages.values().next().value;
    const selected = images.find((image) => image.id === selectedId);
    return Boolean(selected?.assetId && !selected.isGenerating);
  }, [images, selectedImages]);

  useEffect(() => {
    if (session && !targetImage) {
      setSession(null);
      setIsSubmitting(false);
    }
  }, [session, targetImage]);

  useEffect(() => {
    if (session) return;
    setEditSettings(settings);
  }, [session, settings]);

  const updateEditSettings = useCallback((nextSettings: ImageSettings) => {
    hasEditedSettingsRef.current = true;
    setEditSettings(nextSettings);
  }, []);

  const loadInheritedSettings = useCallback(
    async (assetId: string, requestId: number) => {
      try {
        const response = await fetch(
          `/api/assets?ids=${encodeURIComponent(assetId)}`
        );
        const body =
          (await response.json().catch(() => null)) as AssetSettingsResponse | null;
        if (!response.ok) return;

        const inheritedSettings = body?.assets?.find(
          (asset) => asset.id === assetId
        )?.generationSettings;
        if (!inheritedSettings) return;
        if (inheritedSettingsRequestRef.current !== requestId) return;
        if (hasEditedSettingsRef.current) return;

        setEditSettings(normalizeImageSettings(inheritedSettings));
      } catch {
        // Uploaded images and transient metadata failures fall back to current settings.
      }
    },
    []
  );

  const startForImage = useCallback(
    (image: CanvasImageData) => {
      if (!projectId) {
        toast.error("Create or select a project before editing.");
        return;
      }
      if (!image.assetId || image.isGenerating) {
        toast.error("Select an uploaded or generated image before masking.");
        return;
      }

      const requestId = inheritedSettingsRequestRef.current + 1;
      inheritedSettingsRequestRef.current = requestId;
      hasEditedSettingsRef.current = false;
      setEditSettings(settings);
      setSelectedImages(new Set([image.id]));
      setSession({
        imageId: image.id,
        assetId: image.assetId,
        tool: "brush",
        brushSize: DEFAULT_BRUSH_SIZE,
        strokes: [],
        activeStrokeId: null,
      });
      void loadInheritedSettings(image.assetId, requestId);
    },
    [loadInheritedSettings, projectId, setSelectedImages, settings]
  );

  const start = useCallback(() => {
    if (!projectId) {
      toast.error("Create or select a project before editing.");
      return;
    }
    if (selectedImages.size !== 1) {
      toast.error("Select one image to edit with a mask.");
      return;
    }

    const selectedId = selectedImages.values().next().value;
    const image = images.find((item) => item.id === selectedId);
    if (!image?.assetId || image.isGenerating) {
      toast.error("Select an uploaded or generated image before masking.");
      return;
    }

    startForImage(image);
  }, [images, projectId, selectedImages, startForImage]);

  const cancel = useCallback(() => {
    if (isSubmitting) return;
    inheritedSettingsRequestRef.current += 1;
    setSession(null);
  }, [isSubmitting]);

  const clear = useCallback(() => {
    if (isSubmitting) return;
    setSession((prev) =>
      prev ? { ...prev, strokes: [], activeStrokeId: null } : prev
    );
  }, [isSubmitting]);

  const undo = useCallback(() => {
    if (isSubmitting) return;
    setSession((prev) =>
      prev
        ? {
            ...prev,
            strokes: prev.strokes.slice(0, -1),
            activeStrokeId: null,
          }
        : prev
    );
  }, [isSubmitting]);

  const setTool = useCallback((tool: MaskEditTool) => {
    setSession((prev) => (prev ? { ...prev, tool } : prev));
  }, []);

  const setBrushSize = useCallback((brushSize: number) => {
    setSession((prev) =>
      prev ? { ...prev, brushSize: clamp(brushSize, 8, 120) } : prev
    );
  }, []);

  const beginStroke = useCallback(
    (point: MaskPoint, displayMaxSize: number) => {
      if (!session || !targetImage || isSubmitting) return;

      const strokeId = generateId("maskstroke");
      const stroke: MaskStroke = {
        id: strokeId,
        tool: session.tool,
        radius: session.brushSize / Math.max(1, displayMaxSize),
        points: [point],
      };

      setSession((prev) =>
        prev
          ? {
              ...prev,
              strokes: [...prev.strokes, stroke],
              activeStrokeId: strokeId,
            }
          : prev
      );
    },
    [isSubmitting, session, targetImage]
  );

  const extendStroke = useCallback(
    (point: MaskPoint) => {
      if (!session?.activeStrokeId || !targetImage || isSubmitting) return;

      setSession((prev) =>
        prev
          ? {
              ...prev,
              strokes: prev.strokes.map((stroke) =>
                stroke.id === prev.activeStrokeId
                  ? {
                      ...stroke,
                      points: appendPoint(stroke.points, point),
                    }
                  : stroke
              ),
            }
          : prev
      );
    },
    [isSubmitting, session?.activeStrokeId, targetImage]
  );

  const endStroke = useCallback(() => {
    setSession((prev) =>
      prev ? { ...prev, activeStrokeId: null } : prev
    );
  }, []);

  const handlePointerDown = useCallback(
    (event: any) => {
      if (!session || !targetImage || isSubmitting) return;
      if (event.evt.button === 2) return;

      const point = pointForEvent(event, targetImage, false);
      if (!point) return;

      event.cancelBubble = true;
      event.evt.preventDefault();
      beginStroke(point, Math.max(targetImage.width, targetImage.height));
    },
    [beginStroke, isSubmitting, session, targetImage]
  );

  const handlePointerMove = useCallback(
    (event: any) => {
      if (!session?.activeStrokeId || !targetImage || isSubmitting) return;

      const point = pointForEvent(event, targetImage, true);
      if (!point) return;

      event.cancelBubble = true;
      event.evt.preventDefault();
      extendStroke(point);
    },
    [extendStroke, isSubmitting, session?.activeStrokeId, targetImage]
  );

  const pollImageEditJob = useCallback(
    async ({
      jobId,
      placeholderId,
      placeholderPosition,
      placeholderSize,
      sourceImageId,
    }: {
      jobId: string;
      placeholderId: string | number;
      placeholderPosition: { x: number; y: number };
      placeholderSize: number;
      sourceImageId: string | number;
    }) => {
      try {
        for (;;) {
          await sleep(POLL_INTERVAL_MS);

          const response = await fetch(`/api/generation-jobs/${jobId}`);
          const body = (await response.json().catch(() => null)) as JobResponse | null;
          if (!response.ok) {
            throw new Error(body?.error || "Failed to check edit status");
          }

          const job = body?.job;
          if (!job) throw new Error("Generation job response was empty");
          if (job.status === "RUNNING") continue;

          if (job.status === "FAILED") {
            throw new Error(job.error || "Image edit failed");
          }

          const asset = job.asset;
          if (!asset?.id || !asset.url) {
            throw new Error("Image edit completed without an image");
          }

          const src = `${asset.url}?v=${Date.now()}`;
          const loadedImage = await loadCanvasImage(src);
          const fitted = fitImageInBox(
            loadedImage.width,
            loadedImage.height,
            placeholderSize
          );

          setImages((prev) =>
            prev.map((image) =>
              image.id === placeholderId
                ? {
                    ...image,
                    assetId: asset.id,
                    src,
                    width: fitted.width,
                    height: fitted.height,
                    x:
                      placeholderPosition.x +
                      placeholderSize / 2 -
                      fitted.width / 2,
                    y:
                      placeholderPosition.y +
                      placeholderSize / 2 -
                      fitted.height / 2,
                    isPlaceholder: false,
                    isGenerating: false,
                    inputImageIds: [sourceImageId],
                  }
                : image
            )
          );
          setSelectedImages(new Set([placeholderId]));
          setIsSubmitting(false);
          return;
        }
      } catch (error) {
        setImages((prev) => prev.filter((image) => image.id !== placeholderId));
        toast.error(error instanceof Error ? error.message : "Image edit failed");
        setIsSubmitting(false);
      }
    },
    [setImages, setSelectedImages]
  );

  const submit = useCallback(
    async (prompt: string) => {
      if (!projectId || !session || !targetImage) return false;
      if (isSubmitting) return false;

      setIsSubmitting(true);
      try {
        const naturalSize = await loadImageDimensions(targetImage.src);
        const mask = await generateMaskBlob({
          width: naturalSize.width,
          height: naturalSize.height,
          strokes: session.strokes,
        });

        if (!mask.hasTransparentPixels) {
          toast.error("Paint the area you want to edit before submitting.");
          setIsSubmitting(false);
          return false;
        }

        const form = new FormData();
        form.append("projectId", projectId);
        form.append("assetId", session.assetId);
        form.append("prompt", withPreservationHint(prompt));
        form.append("size", editSettings.size);
        form.append("quality", editSettings.quality);
        form.append("outputFormat", editSettings.outputFormat);
        form.append("mask", mask.blob, "mask.png");

        const response = await fetch("/api/image-edits", {
          method: "POST",
          body: form,
        });
        const body = (await response.json().catch(() => null)) as JobResponse | null;
        if (!response.ok) {
          throw new Error(body?.error || "Image edit failed");
        }

        const jobId = body?.job?.id;
        if (!jobId) throw new Error("Image edit response did not include a job");

        const placeholderId = generateId("placeholder");
        const placeholderSize = 500;
        const placeholderPosition = getEditResultPosition(
          targetImage,
          placeholderSize
        );
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
          inputImageIds: [targetImage.id],
        };

        setImages((prev) => [...prev, placeholderImage]);
        setSelectedImages(new Set([placeholderId]));
        inheritedSettingsRequestRef.current += 1;
        setSession(null);
        setIsSubmitting(false);

        void pollImageEditJob({
          jobId,
          placeholderId,
          placeholderPosition,
          placeholderSize,
          sourceImageId: targetImage.id,
        });

        return true;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Image edit failed");
        setIsSubmitting(false);
        return false;
      }
    },
    [
      isSubmitting,
      editSettings.outputFormat,
      editSettings.quality,
      editSettings.size,
      projectId,
      session,
      pollImageEditJob,
      setImages,
      setSelectedImages,
      targetImage,
    ]
  );

  return {
    session,
    targetImage,
    canStart,
    isSubmitting,
    editSettings,
    start,
    startForImage,
    cancel,
    clear,
    undo,
    setTool,
    setBrushSize,
    setEditSettings: updateEditSettings,
    beginStroke,
    extendStroke,
    endStroke,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp: endStroke,
    submit,
  };
}

function pointForEvent(
  event: any,
  image: CanvasImageData,
  clampToImage: boolean
): MaskPoint | null {
  const stage = event.target.getStage();
  const pointer = stage?.getPointerPosition();
  if (!stage || !pointer) return null;

  const world = {
    x: (pointer.x - stage.x()) / stage.scaleX(),
    y: (pointer.y - stage.y()) / stage.scaleY(),
  };
  const x = (world.x - image.x) / image.width;
  const y = (world.y - image.y) / image.height;

  if (!clampToImage && (x < 0 || x > 1 || y < 0 || y > 1)) {
    return null;
  }

  return {
    x: clamp(x, 0, 1),
    y: clamp(y, 0, 1),
  };
}

function appendPoint(points: MaskPoint[], point: MaskPoint) {
  const previous = points.at(-1);
  if (previous && Math.hypot(previous.x - point.x, previous.y - point.y) < 0.002) {
    return points;
  }
  return [...points, point];
}

function withPreservationHint(prompt: string) {
  if (/preserve|unchanged|keep.*same|保持|不变/i.test(prompt)) {
    return prompt;
  }
  return `${prompt}\n\nKeep all unmasked areas unchanged.`;
}

function getEditResultPosition(image: CanvasImageData, size: number) {
  return {
    x: image.x + image.width + 140,
    y: image.y + image.height / 2 - size / 2,
  };
}

function fitImageInBox(width: number, height: number, maxSize: number) {
  const aspectRatio = width / height;
  return width > height
    ? {
        width: maxSize,
        height: maxSize / aspectRatio,
      }
    : {
        width: maxSize * aspectRatio,
        height: maxSize,
      };
}

function loadCanvasImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load edited image"));
    image.src = src;
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
