import { useCallback, useEffect, useRef } from "react";
import type { ChangeEvent } from "react";
import { toast } from "sonner";

import type { AssetResponse, CanvasImageData } from "@/lib/types";

type UseCanvasUploadsOptions = {
  currentProjectId: string | null;
  addImageFromSrc: (
    src: string,
    offsetIndex: number,
    getCurrentCenterPosition: () => { x: number; y: number },
    assetId?: string
  ) => Promise<CanvasImageData>;
  getCurrentCenterPosition: () => { x: number; y: number };
  pasteCopiedImage: () => void;
};

export function useCanvasUploads({
  currentProjectId,
  addImageFromSrc,
  getCurrentCenterPosition,
  pasteCopiedImage,
}: UseCanvasUploadsOptions) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const uploadAsset = useCallback(
    async (file: File): Promise<AssetResponse> => {
      if (!currentProjectId) throw new Error("Select a project first");
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(
        `/api/projects/${currentProjectId}/assets`,
        {
          method: "POST",
          body: form,
        }
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error || "Upload failed");
      }
      return body.asset;
    },
    [currentProjectId]
  );

  const uploadAndAddImage = useCallback(
    async (file: File, index = 0) => {
      try {
        const asset = await uploadAsset(file);
        await addImageFromSrc(
          `${asset.url}?v=${Date.now()}`,
          index,
          getCurrentCenterPosition,
          asset.id
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Upload failed");
      }
    },
    [addImageFromSrc, getCurrentCenterPosition, uploadAsset]
  );

  const handleFileUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith("image/")) {
          await uploadAndAddImage(file, i);
        }
      }
      event.target.value = "";
    },
    [uploadAndAddImage]
  );

  useEffect(() => {
    const handlePaste = async (event: ClipboardEvent) => {
      const items = (event.clipboardData as DataTransfer)?.items;
      if (!items) return;

      const imageItems = Array.from(items).filter((item) =>
        item.type.startsWith("image/")
      );

      if (imageItems.length > 0) {
        for (let i = 0; i < imageItems.length; i++) {
          const file = imageItems[i].getAsFile();
          if (file) await uploadAndAddImage(file, i);
        }
      } else {
        pasteCopiedImage();
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [pasteCopiedImage, uploadAndAddImage]);

  return {
    fileInputRef,
    handleFileUpload,
    uploadAndAddImage,
  };
}
