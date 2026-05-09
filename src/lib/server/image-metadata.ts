import { inflateSync } from "node:zlib";

export type ImageDimensions = {
  width: number;
  height: number;
};

export type PngMetadata = ImageDimensions & {
  bitDepth: number;
  colorType: number;
  hasAlpha: boolean;
  interlaceMethod: number;
};

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

export function readImageDimensions(bytes: Uint8Array, mime: string) {
  const buffer = Buffer.from(bytes);
  if (mime === "image/png") return readPngMetadata(buffer);
  if (mime === "image/jpeg" || mime === "image/jpg") {
    return readJpegDimensions(buffer);
  }
  if (mime === "image/webp") return readWebpDimensions(buffer);
  throw new Error("Unsupported source image format");
}

export function readPngMetadata(bytes: Uint8Array): PngMetadata {
  const buffer = Buffer.from(bytes);
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("Mask must be a valid PNG file");
  }

  let offset = 8;
  let hasTransparencyChunk = false;

  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > buffer.length) break;

    if (type === "IHDR") {
      const colorType = buffer[dataStart + 9];
      const bitDepth = buffer[dataStart + 8];
      const interlaceMethod = buffer[dataStart + 12];
      return {
        width: buffer.readUInt32BE(dataStart),
        height: buffer.readUInt32BE(dataStart + 4),
        bitDepth,
        colorType,
        hasAlpha: colorType === 4 || colorType === 6 || hasTransparencyChunk,
        interlaceMethod,
      };
    }

    if (type === "tRNS") {
      hasTransparencyChunk = true;
    }

    offset = dataEnd + 4;
  }

  throw new Error("Mask PNG is missing image metadata");
}

export function pngHasTransparentPixels(bytes: Uint8Array) {
  const buffer = Buffer.from(bytes);
  const metadata = readPngMetadata(buffer);

  if (!metadata.hasAlpha) return false;
  if (metadata.bitDepth !== 8 || metadata.interlaceMethod !== 0) {
    throw new Error("Mask must be an 8-bit non-interlaced PNG");
  }
  if (metadata.colorType !== 4 && metadata.colorType !== 6) {
    throw new Error("Mask must include an alpha channel");
  }

  const idatParts: Buffer[] = [];
  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > buffer.length) break;
    if (type === "IDAT") idatParts.push(buffer.subarray(dataStart, dataEnd));
    offset = dataEnd + 4;
  }

  if (idatParts.length === 0) {
    throw new Error("Mask PNG does not contain image data");
  }

  const channels = metadata.colorType === 6 ? 4 : 2;
  const bytesPerPixel = channels;
  const rowLength = metadata.width * channels;
  const inflated = inflateSync(Buffer.concat(idatParts));
  const expectedLength = (rowLength + 1) * metadata.height;
  if (inflated.length < expectedLength) {
    throw new Error("Mask PNG image data is incomplete");
  }

  let previous = Buffer.alloc(rowLength);
  let sourceOffset = 0;
  for (let y = 0; y < metadata.height; y++) {
    const filterType = inflated[sourceOffset];
    const row = Buffer.from(
      inflated.subarray(sourceOffset + 1, sourceOffset + 1 + rowLength)
    );
    sourceOffset += rowLength + 1;
    unfilterRow(row, previous, bytesPerPixel, filterType);

    for (let x = channels - 1; x < row.length; x += channels) {
      if (row[x] < 255) return true;
    }

    previous = row;
  }

  return false;
}

function unfilterRow(
  row: Buffer,
  previous: Buffer,
  bytesPerPixel: number,
  filterType: number
) {
  if (filterType === 0) return;

  for (let i = 0; i < row.length; i++) {
    const left = i >= bytesPerPixel ? row[i - bytesPerPixel] : 0;
    const up = previous[i] || 0;
    const upLeft = i >= bytesPerPixel ? previous[i - bytesPerPixel] || 0 : 0;

    if (filterType === 1) {
      row[i] = (row[i] + left) & 0xff;
    } else if (filterType === 2) {
      row[i] = (row[i] + up) & 0xff;
    } else if (filterType === 3) {
      row[i] = (row[i] + Math.floor((left + up) / 2)) & 0xff;
    } else if (filterType === 4) {
      row[i] = (row[i] + paeth(left, up, upLeft)) & 0xff;
    } else {
      throw new Error("Mask PNG uses an unsupported filter");
    }
  }
}

function paeth(left: number, up: number, upLeft: number) {
  const estimate = left + up - upLeft;
  const distanceLeft = Math.abs(estimate - left);
  const distanceUp = Math.abs(estimate - up);
  const distanceUpLeft = Math.abs(estimate - upLeft);

  if (distanceLeft <= distanceUp && distanceLeft <= distanceUpLeft) return left;
  if (distanceUp <= distanceUpLeft) return up;
  return upLeft;
}

function readJpegDimensions(buffer: Buffer): ImageDimensions {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    throw new Error("Source image must be a valid JPEG file");
  }

  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    offset += 2;
    if (marker === 0xd9 || marker === 0xda) break;
    if (offset + 2 > buffer.length) break;

    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) break;

    if (isJpegStartOfFrame(marker)) {
      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5),
      };
    }

    offset += length;
  }

  throw new Error("JPEG image metadata could not be read");
}

function isJpegStartOfFrame(marker: number) {
  return (
    marker >= 0xc0 &&
    marker <= 0xcf &&
    marker !== 0xc4 &&
    marker !== 0xc8 &&
    marker !== 0xcc
  );
}

function readWebpDimensions(buffer: Buffer): ImageDimensions {
  if (
    buffer.length < 30 ||
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WEBP"
  ) {
    throw new Error("Source image must be a valid WebP file");
  }

  const format = buffer.toString("ascii", 12, 16);
  if (format === "VP8X") {
    return {
      width: readUInt24LE(buffer, 24) + 1,
      height: readUInt24LE(buffer, 27) + 1,
    };
  }

  if (format === "VP8 ") {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }

  if (format === "VP8L") {
    const b0 = buffer[21];
    const b1 = buffer[22];
    const b2 = buffer[23];
    const b3 = buffer[24];
    return {
      width: 1 + (((b1 & 0x3f) << 8) | b0),
      height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
    };
  }

  throw new Error("WebP image metadata could not be read");
}

function readUInt24LE(buffer: Buffer, offset: number) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}
