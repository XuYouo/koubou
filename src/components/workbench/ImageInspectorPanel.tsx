"use client";

import { useEffect, useMemo, useState } from "react";
import { ImageIcon } from "lucide-react";

import type { AssetMetadata, CanvasImageData } from "@/lib/types";

type ImageInspectorPanelProps = {
  images: CanvasImageData[];
  selectedImages: Set<string | number>;
};

type ImageDimensions = {
  width: number;
  height: number;
};

export function ImageInspectorPanel({
  images,
  selectedImages,
}: ImageInspectorPanelProps) {
  const selectedCanvasImages = useMemo(
    () => images.filter((image) => selectedImages.has(image.id)),
    [images, selectedImages]
  );
  const assetIdsKey = useMemo(
    () =>
      Array.from(
        new Set(
          selectedCanvasImages
            .map((image) => image.assetId)
            .filter((assetId): assetId is string => Boolean(assetId))
        )
      ).join(","),
    [selectedCanvasImages]
  );
  const [metadataById, setMetadataById] = useState<Record<string, AssetMetadata>>(
    {}
  );
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [naturalDimensions, setNaturalDimensions] = useState<
    Record<string, ImageDimensions>
  >({});

  useEffect(() => {
    if (!assetIdsKey) {
      setMetadataById({});
      setMetadataLoading(false);
      return;
    }

    let cancelled = false;
    setMetadataLoading(true);
    fetch(`/api/assets?ids=${encodeURIComponent(assetIdsKey)}`)
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(body?.error || "Failed to load image details");
        }
        return Array.isArray(body?.assets) ? (body.assets as AssetMetadata[]) : [];
      })
      .then((assets) => {
        if (cancelled) return;
        setMetadataById(
          Object.fromEntries(assets.map((asset) => [asset.id, asset]))
        );
      })
      .catch(() => {
        if (!cancelled) setMetadataById({});
      })
      .finally(() => {
        if (!cancelled) setMetadataLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [assetIdsKey]);

  useEffect(() => {
    let cancelled = false;
    setNaturalDimensions({});

    selectedCanvasImages.forEach((canvasImage) => {
      if (!canvasImage.src || canvasImage.isGenerating) return;

      const image = new window.Image();
      image.onload = () => {
        if (cancelled) return;
        setNaturalDimensions((current) => ({
          ...current,
          [String(canvasImage.id)]: {
            width: image.naturalWidth,
            height: image.naturalHeight,
          },
        }));
      };
      image.src = canvasImage.src;
    });

    return () => {
      cancelled = true;
    };
  }, [selectedCanvasImages]);

  if (selectedCanvasImages.length === 0) return null;

  return (
    <aside className="fixed right-4 top-4 z-10 max-h-[calc(100vh-2rem)] w-[320px] overflow-y-auto border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-200 p-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-950">
          <ImageIcon className="h-4 w-4" />
          Selection
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          {selectedCanvasImages.length === 1
            ? "1 image selected"
            : `${selectedCanvasImages.length} images selected`}
          {metadataLoading ? " · Loading details..." : ""}
        </p>
      </div>

      <div className="space-y-3 p-3">
        {selectedCanvasImages.map((canvasImage) => {
          const metadata = canvasImage.assetId
            ? metadataById[canvasImage.assetId]
            : null;
          const dimensions = naturalDimensions[String(canvasImage.id)];

          return (
            <SelectedImageDetails
              key={canvasImage.id}
              canvasImage={canvasImage}
              metadata={metadata}
              dimensions={dimensions}
            />
          );
        })}
      </div>
    </aside>
  );
}

function SelectedImageDetails({
  canvasImage,
  metadata,
  dimensions,
}: {
  canvasImage: CanvasImageData;
  metadata: AssetMetadata | null;
  dimensions?: ImageDimensions;
}) {
  const resolution = formatResolution(canvasImage, metadata, dimensions);
  const createdAt = metadata?.generationCreatedAt || metadata?.createdAt || null;
  const type = metadata?.type ? formatAssetType(metadata.type) : "Canvas image";
  const generationSettings = metadata?.generationSettings
    ? [
        metadata.generationSettings.size,
        metadata.generationSettings.quality,
        metadata.generationSettings.outputFormat,
      ].join(" · ")
    : null;

  return (
    <section className="border border-neutral-200 bg-white">
      <div className="flex gap-3 p-2">
        <div className="h-16 w-16 shrink-0 overflow-hidden bg-neutral-100">
          {canvasImage.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={canvasImage.src}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="grid h-full w-full place-items-center">
              <ImageIcon className="h-5 w-5 text-neutral-400" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-neutral-600">
              {type}
            </span>
            {metadata?.operation && (
              <span className="text-[10px] text-neutral-500">
                {formatOperation(metadata.operation)}
              </span>
            )}
          </div>
          <InfoLine label="Resolution" value={resolution} />
          <InfoLine
            label="Created"
            value={createdAt ? new Date(createdAt).toLocaleString() : "-"}
          />
          {metadata?.projectName && (
            <InfoLine label="Project" value={metadata.projectName} />
          )}
          {generationSettings && (
            <InfoLine label="Settings" value={generationSettings} />
          )}
        </div>
      </div>

      {metadata?.prompt && (
        <div className="border-t border-neutral-100 px-2 py-2">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
            Prompt
          </p>
          <p className="max-h-28 overflow-y-auto text-xs leading-5 text-neutral-700">
            {metadata.prompt}
          </p>
        </div>
      )}
    </section>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="grid grid-cols-[64px_1fr] gap-2 text-neutral-500">
      <span>{label}</span>
      <span className="truncate text-neutral-800" title={value}>
        {value}
      </span>
    </p>
  );
}

function formatResolution(
  canvasImage: CanvasImageData,
  metadata: AssetMetadata | null,
  dimensions?: ImageDimensions
) {
  if (dimensions) return `${dimensions.width} x ${dimensions.height}`;
  if (metadata?.width && metadata.height) return `${metadata.width} x ${metadata.height}`;
  if (canvasImage.isGenerating) return "Pending";
  return "Loading...";
}

function formatAssetType(type: AssetMetadata["type"]) {
  return type === "GENERATED" ? "Generated" : "Upload";
}

function formatOperation(operation: NonNullable<AssetMetadata["operation"]>) {
  return operation === "GENERATION" ? "Generation" : "Edit";
}
