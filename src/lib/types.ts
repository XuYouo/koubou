export type CanvasImageData = {
  id: string | number;
  assetId?: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isPlaceholder?: boolean;
  generationRequestId?: string;
  isGenerating?: boolean;
  inputImageIds?: Array<string | number>;
};

export type SafeUser = {
  id: string;
  username: string;
  role: "ADMIN" | "USER";
};

export type ProjectSummary = {
  id: string;
  name: string;
  canvasJson: string;
  createdAt: string;
  updatedAt: string;
};

export type AssetResponse = {
  id: string;
  url: string;
  mime: string;
  width: number | null;
  height: number | null;
};

export type CanvasProjectState = {
  images: CanvasImageData[];
  stage?: {
    x: number;
    y: number;
    scale: number;
  };
};
