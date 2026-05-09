"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Images, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AssetMetadata } from "@/lib/types";

type UserGalleryPanelProps = {
  open: boolean;
  onClose: () => void;
};

export function UserGalleryPanel({ open, onClose }: UserGalleryPanelProps) {
  const [assets, setAssets] = useState<AssetMetadata[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAssets = useCallback(async (cursor: string | null = null) => {
    if (cursor) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setAssets([]);
      setNextCursor(null);
    }
    setError(null);

    const params = new URLSearchParams({ limit: "60" });
    if (cursor) params.set("cursor", cursor);

    const response = await fetch(`/api/assets?${params}`);
    const body = await response.json().catch(() => null);

    setLoading(false);
    setLoadingMore(false);

    if (!response.ok) {
      setError(body?.error || "Failed to load gallery");
      return;
    }

    const nextAssets = Array.isArray(body?.assets) ? body.assets : [];
    setAssets((current) => (cursor ? [...current, ...nextAssets] : nextAssets));
    setNextCursor(body?.nextCursor || null);
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadAssets();
  }, [loadAssets, open]);

  if (!open) return null;

  return (
    <section className="fixed left-[284px] top-4 z-20 max-h-[calc(100vh-2rem)] w-[min(560px,calc(100vw-316px))] overflow-hidden border border-neutral-200 bg-white shadow-lg">
      <div className="flex items-start justify-between gap-3 border-b border-neutral-200 p-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-950">
            <Images className="h-4 w-4" />
            Gallery
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            Generated images and uploaded references.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close gallery"
          className="h-7 w-7"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="max-h-[calc(100vh-8rem)] overflow-y-auto p-3">
        {error && (
          <div className="mb-3 flex items-center justify-between gap-3 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={() => void loadAssets()}>
              Retry
            </Button>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-44 animate-pulse rounded border border-neutral-200 bg-neutral-100"
              />
            ))}
          </div>
        ) : assets.length === 0 && !error ? (
          <div className="flex min-h-64 flex-col items-center justify-center border border-dashed border-neutral-300 px-6 py-10 text-center">
            <Images className="h-8 w-8 text-neutral-400" />
            <h3 className="mt-3 text-sm font-medium text-neutral-950">
              No image assets
            </h3>
            <p className="mt-1 text-sm text-neutral-500">
              Generated outputs and uploaded references will appear here.
            </p>
          </div>
        ) : (
          <div className="columns-2 gap-3 md:columns-3">
            {assets.map((asset) => (
              <a
                key={asset.id}
                href={asset.url}
                target="_blank"
                rel="noreferrer"
                className="group mb-3 block break-inside-avoid overflow-hidden rounded border border-neutral-200 bg-white transition hover:border-neutral-300"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset.url}
                  alt={`${formatAssetType(asset.type)} image`}
                  loading="lazy"
                  className="w-full bg-neutral-100 object-cover transition group-hover:opacity-90"
                />
                <div className="space-y-2 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-neutral-600">
                      {formatAssetType(asset.type)}
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 text-neutral-400" />
                  </div>
                  <div className="space-y-0.5 text-xs text-neutral-500">
                    <p className="truncate text-neutral-700">{asset.projectName}</p>
                    <p>{new Date(asset.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}

        {nextCursor && !loading && (
          <div className="flex justify-center pt-1">
            <Button
              variant="outline"
              onClick={() => void loadAssets(nextCursor)}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading..." : "Load more"}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

function formatAssetType(type: AssetMetadata["type"]) {
  return type === "GENERATED" ? "Generated" : "Upload";
}
