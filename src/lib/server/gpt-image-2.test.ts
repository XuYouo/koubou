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

  it("calls edits with multipart image inputs", async () => {
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
      expect(form.getAll("image")).toHaveLength(1);
      expect(form.getAll("image[]")).toHaveLength(0);
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

  it("calls edits with multipart mask input", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "koubou-test-"));
    process.env.APP_STORAGE_DIR = root;
    await fs.mkdir(path.join(root, "u1", "p1"), { recursive: true });
    await fs.writeFile(path.join(root, "u1", "p1", "source.png"), "source");

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.body).toBeInstanceOf(FormData);
      const form = init?.body as FormData;
      expect(form.getAll("image")).toHaveLength(1);
      const mask = form.get("mask");
      expect(mask).toBeInstanceOf(File);
      expect((mask as File).name).toBe("mask.png");
      expect((mask as File).type).toBe("image/png");
      return new Response(
        JSON.stringify({
          data: [{ b64_json: Buffer.from("masked edit").toString("base64") }],
        }),
        { status: 200 }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await callGptImage2({
      config: { baseUrl: "https://api.example.com", model: "gpt-image-2" },
      apiKey: "test-key",
      prompt: "edit a masked area",
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
      mask: {
        bytes: Buffer.from("mask"),
        mime: "image/png",
        filename: "mask.png",
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/v1/images/edits",
      expect.any(Object)
    );
  });

  it("retries edits with image[] when a gateway rejects image fields", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "koubou-test-"));
    process.env.APP_STORAGE_DIR = root;
    await fs.mkdir(path.join(root, "u1", "p1"), { recursive: true });
    await fs.writeFile(path.join(root, "u1", "p1", "source.png"), "source");

    const fetchMock = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) => {
        const form = init?.body as FormData;
        if (fetchMock.mock.calls.length === 1) {
          expect(form.getAll("image")).toHaveLength(1);
          return new Response(
            JSON.stringify({ error: { message: "image[] is required" } }),
            { status: 400 }
          );
        }

        expect(form.getAll("image[]")).toHaveLength(1);
        return new Response(
          JSON.stringify({
            data: [{ b64_json: Buffer.from("edited").toString("base64") }],
          }),
          { status: 200 }
        );
      }
    );
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

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
