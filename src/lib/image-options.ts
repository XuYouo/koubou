export const IMAGE_SIZES = [
  "auto",
  "1024x1024",
  "1536x1024",
  "1024x1536",
  "2048x2048",
  "2048x1152",
  "3840x2160",
  "2160x3840",
] as const;

export const IMAGE_QUALITIES = ["auto", "low", "medium", "high"] as const;
export const IMAGE_OUTPUT_FORMATS = ["png", "jpeg", "webp"] as const;

export type ImageSize = (typeof IMAGE_SIZES)[number];
export type ImageQuality = (typeof IMAGE_QUALITIES)[number];
export type ImageOutputFormat = (typeof IMAGE_OUTPUT_FORMATS)[number];

export type ImageSettings = {
  size: ImageSize;
  quality: ImageQuality;
  outputFormat: ImageOutputFormat;
};

export const DEFAULT_IMAGE_SETTINGS: ImageSettings = {
  size: "1024x1024",
  quality: "auto",
  outputFormat: "png",
};

export function normalizeImageSettings(input: {
  size?: unknown;
  quality?: unknown;
  outputFormat?: unknown;
}): ImageSettings {
  return {
    size: IMAGE_SIZES.includes(input.size as ImageSize)
      ? (input.size as ImageSize)
      : DEFAULT_IMAGE_SETTINGS.size,
    quality: IMAGE_QUALITIES.includes(input.quality as ImageQuality)
      ? (input.quality as ImageQuality)
      : DEFAULT_IMAGE_SETTINGS.quality,
    outputFormat: IMAGE_OUTPUT_FORMATS.includes(
      input.outputFormat as ImageOutputFormat
    )
      ? (input.outputFormat as ImageOutputFormat)
      : DEFAULT_IMAGE_SETTINGS.outputFormat,
  };
}
