import { deflateSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { validateImageEditFiles } from "./image-edit-validation";

describe("image edit file validation", () => {
  it("accepts a same-size RGBA mask with transparent pixels", () => {
    const source = png({
      width: 2,
      height: 2,
      colorType: 6,
      pixels: Buffer.from([
        255, 255, 255, 255, 255, 255, 255, 255,
        255, 255, 255, 255, 255, 255, 255, 255,
      ]),
    });
    const mask = png({
      width: 2,
      height: 2,
      colorType: 6,
      pixels: Buffer.from([
        255, 255, 255, 255, 255, 255, 255, 0,
        255, 255, 255, 255, 255, 255, 255, 255,
      ]),
    });

    expect(() =>
      validateImageEditFiles({
        sourceBytes: source,
        sourceMime: "image/png",
        maskBytes: mask,
        maskMime: "image/png",
      })
    ).not.toThrow();
  });

  it("rejects a mask without alpha", () => {
    const source = transparentPng(2, 2);
    const mask = png({
      width: 2,
      height: 2,
      colorType: 2,
      pixels: Buffer.alloc(2 * 2 * 3, 255),
    });

    expect(() =>
      validateImageEditFiles({
        sourceBytes: source,
        sourceMime: "image/png",
        maskBytes: mask,
        maskMime: "image/png",
      })
    ).toThrow("Mask must include an alpha channel");
  });

  it("rejects a mask with different dimensions", () => {
    expect(() =>
      validateImageEditFiles({
        sourceBytes: transparentPng(2, 2),
        sourceMime: "image/png",
        maskBytes: transparentPng(1, 1),
        maskMime: "image/png",
      })
    ).toThrow("Mask must be the same size as the source image");
  });

  it("rejects a fully opaque mask", () => {
    expect(() =>
      validateImageEditFiles({
        sourceBytes: transparentPng(2, 2),
        sourceMime: "image/png",
        maskBytes: opaquePng(2, 2),
        maskMime: "image/png",
      })
    ).toThrow("Paint the area you want to edit before submitting");
  });

  it("rejects oversized source and mask files before decoding", () => {
    expect(() =>
      validateImageEditFiles({
        sourceBytes: new Uint8Array(25 * 1024 * 1024 + 1),
        sourceMime: "image/png",
        maskBytes: transparentPng(1, 1),
        maskMime: "image/png",
      })
    ).toThrow("Source image must be smaller than 25MB");

    expect(() =>
      validateImageEditFiles({
        sourceBytes: transparentPng(1, 1),
        sourceMime: "image/png",
        maskBytes: new Uint8Array(4 * 1024 * 1024 + 1),
        maskMime: "image/png",
      })
    ).toThrow("Mask must be smaller than 4MB");
  });
});

function transparentPng(width: number, height: number) {
  const pixels = Buffer.alloc(width * height * 4, 255);
  pixels[3] = 0;
  return png({ width, height, colorType: 6, pixels });
}

function opaquePng(width: number, height: number) {
  return png({
    width,
    height,
    colorType: 6,
    pixels: Buffer.alloc(width * height * 4, 255),
  });
}

function png({
  width,
  height,
  colorType,
  pixels,
}: {
  width: number;
  height: number;
  colorType: 2 | 6;
  pixels: Buffer;
}) {
  const channels = colorType === 6 ? 4 : 3;
  const rowLength = width * channels;
  const rows: Buffer[] = [];
  for (let y = 0; y < height; y++) {
    rows.push(Buffer.from([0]));
    rows.push(pixels.subarray(y * rowLength, (y + 1) * rowLength));
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = colorType;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function chunk(type: string, data: Buffer) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
