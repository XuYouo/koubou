import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  callGptImage2,
  imageApiUrl,
  validateGptImageSettings,
} from "./gpt-image-2";

const settings = {
  size: "1024x1024" as const,
  quality: "auto" as const,
  outputFormat: "png" as const,
};

describe("gpt-image-2 adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.APP_STORAGE_DIR;
  });

  it("builds compatible Images API URLs", () => {
    expect(imageApiUrl("https://api.example.com", "generations")).toBe(
      "https://api.example.com/v1/images/generations"
    );
    expect(imageApiUrl("https://api.example.com/v1", "edits")).toBe(
      "https://api.example.com/v1/images/edits"
    );
    expect(imageApiUrl("https://api.example.com/v1/images", "edits")).toBe(
      "https://api.example.com/v1/images/edits"
    );
  });

  it("rejects unsupported output controls", () => {
    expect(() =>
      validateGptImageSettings({ ...settings, size: "512x512" as never })
    ).toThrow("Unsupported image size");
    expect(() =>
      validateGptImageSettings({ ...settings, quality: "ultra" as never })
    ).toThrow("Unsupported image quality");
  });

  it("calls generations with JSON and extracts b64_json", async () => {
    const imageBytes = Buffer.from("image-bytes");
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        Authorization: "Bearer test-key",
        "Content-Type": "application/json",
      });
      expect(JSON.parse(String(init?.body))).toMatchObject({
        model: "gpt-image-2",
        prompt: "draw a cat",
        size: "1024x1024",
        quality: "auto",
        output_format: "png",
        response_format: "b64_json",
      });
      return new Response(
        JSON.stringify({
          data: [{ b64_json: imageBytes.toString("base64") }],
        }),
        { status: 200 }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await callGptImage2({
      config: { baseUrl: "https://api.example.com", model: "gpt-image-2" },
      apiKey: "test-key",
      prompt: "draw a cat",
      settings,
      inputAssets: [],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/v1/images/generations",
      expect.any(Object)
    );
    expect(Buffer.from(result.bytes)).toEqual(imageBytes);
    expect(result.mime).toBe("image/png");
  });

  it("calls edits with multipart image[] inputs", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "koubou-test-"));
    process.env.APP_STORAGE_DIR = root;
    await fs.mkdir(path.join(root, "u1", "p1"), { recursive: true });
    await fs.writeFile(path.join(root, "u1", "p1", "source.png"), "source");

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        Authorization: "Bearer test-key",
      });
      expect(init?.body).toBeInstanceOf(FormData);
      const form = init?.body as FormData;
      expect(form.get("model")).toBe("gpt-image-2");
      expect(form.get("prompt")).toBe("edit it");
      expect(form.getAll("image[]")).toHaveLength(1);
      return new Response(
        JSON.stringify({
          data: [{ b64_json: Buffer.from("edited").toString("base64") }],
        }),
        { status: 200 }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await callGptImage2({
      config: { baseUrl: "https://api.example.com", model: "gpt-image-2" },
      apiKey: "test-key",
      prompt: "edit it",
      settings,
      inputAssets: [
        {
          id: "a1",
          userId: "u1",
          projectId: "p1",
          type: "UPLOAD",
          mime: "image/png",
          width: null,
          height: null,
          storagePath: "u1/p1/source.png",
          createdAt: new Date(),
        },
      ],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/v1/images/edits",
      expect.any(Object)
    );
  });
});
