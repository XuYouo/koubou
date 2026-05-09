export type MaskEditTool = "brush" | "eraser";

export type MaskPoint = {
  x: number;
  y: number;
};

export type MaskStroke = {
  id: string;
  tool: MaskEditTool;
  radius: number;
  points: MaskPoint[];
};

export type MaskBlobResult = {
  blob: Blob;
  hasTransparentPixels: boolean;
};

export function renderMaskOverlayDataUrl({
  width,
  height,
  strokes,
}: {
  width: number;
  height: number;
  strokes: MaskStroke[];
}) {
  if (width <= 0 || height <= 0 || strokes.length === 0) return "";

  const canvas = renderEditMaskCanvas(width, height, strokes);
  const context = canvas.getContext("2d");
  if (!context) return "";

  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const alpha = pixels.data[index + 3];
    if (alpha === 0) continue;

    pixels.data[index] = 0;
    pixels.data[index + 1] = 122;
    pixels.data[index + 2] = 255;
    pixels.data[index + 3] = Math.round((alpha / 255) * 96);
  }
  context.globalCompositeOperation = "source-over";
  context.putImageData(pixels, 0, 0);

  return canvas.toDataURL("image/png");
}

export async function generateMaskBlob({
  width,
  height,
  strokes,
}: {
  width: number;
  height: number;
  strokes: MaskStroke[];
}): Promise<MaskBlobResult> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Could not create mask canvas");

  const editMask = renderEditMaskCanvas(canvas.width, canvas.height, strokes);

  context.fillStyle = "white";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = "destination-out";
  context.drawImage(editMask, 0, 0);
  context.globalCompositeOperation = "source-over";

  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let hasTransparentPixels = false;
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] < 255) {
      hasTransparentPixels = true;
      break;
    }
  }

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
  if (!blob) throw new Error("Could not export mask PNG");

  return { blob, hasTransparentPixels };
}

export function loadImageDimensions(src: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      resolve({
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
      });
    image.onerror = () => reject(new Error("Failed to read source image size"));
    image.src = src;
  });
}

function renderEditMaskCanvas(
  width: number,
  height: number,
  strokes: MaskStroke[]
) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext("2d");
  if (!context) return canvas;

  context.clearRect(0, 0, canvas.width, canvas.height);

  for (const stroke of strokes) {
    context.globalCompositeOperation =
      stroke.tool === "brush" ? "source-over" : "destination-out";
    drawStroke(context, canvas.width, canvas.height, stroke, {
      strokeStyle: "black",
      fillStyle: "black",
    });
  }

  context.globalCompositeOperation = "source-over";
  return canvas;
}

function drawStroke(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  stroke: MaskStroke,
  styles: {
    strokeStyle: string;
    fillStyle: string;
  }
) {
  if (stroke.points.length === 0) return;

  const radius = Math.max(1, stroke.radius * Math.max(width, height));
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = radius * 2;
  context.strokeStyle = styles.strokeStyle;
  context.fillStyle = styles.fillStyle;

  if (stroke.points.length === 1) {
    const point = stroke.points[0];
    context.beginPath();
    context.arc(point.x * width, point.y * height, radius, 0, Math.PI * 2);
    context.fill();
    return;
  }

  context.beginPath();
  context.moveTo(stroke.points[0].x * width, stroke.points[0].y * height);
  for (const point of stroke.points.slice(1)) {
    context.lineTo(point.x * width, point.y * height);
  }
  context.stroke();
}
