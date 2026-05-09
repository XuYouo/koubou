import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/server/db";
import { callGptImage2, validateGptImageSettings } from "@/lib/server/gpt-image-2";
import { validateImageEditFiles } from "@/lib/server/image-edit-validation";
import { getActiveModelConfig } from "@/lib/server/model-config";
import { requireUser } from "@/lib/server/session";
import { readAssetBytes, writeAssetFile } from "@/lib/server/storage";

import { POST } from "./route";

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>(
    "next/server"
  );
  return {
    ...actual,
    after: vi.fn(),
  };
});

vi.mock("@/lib/server/db", () => ({
  prisma: {
    project: {
      findFirst: vi.fn(),
    },
    asset: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    generationJob: {
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/server/session", () => ({
  requireUser: vi.fn(),
}));

vi.mock("@/lib/server/gpt-image-2", () => ({
  callGptImage2: vi.fn(),
  validateGptImageSettings: vi.fn(() => ({
    size: "1024x1024",
    quality: "auto",
    outputFormat: "png",
  })),
}));

vi.mock("@/lib/server/image-edit-validation", () => ({
  validateImageEditFiles: vi.fn(),
}));

vi.mock("@/lib/server/model-config", () => ({
  getActiveModelConfig: vi.fn(),
}));

vi.mock("@/lib/server/storage", () => ({
  readAssetBytes: vi.fn(),
  writeAssetFile: vi.fn(),
}));

const requireUserMock = vi.mocked(requireUser);
const findProjectMock = vi.mocked(prisma.project.findFirst);
const findAssetMock = vi.mocked(prisma.asset.findFirst);
const createAssetMock = vi.mocked(prisma.asset.create);
const createJobMock = vi.mocked(prisma.generationJob.create);
const updateJobMock = vi.mocked(prisma.generationJob.update);
const callGptImage2Mock = vi.mocked(callGptImage2);
const validateGptImageSettingsMock = vi.mocked(validateGptImageSettings);
const validateImageEditFilesMock = vi.mocked(validateImageEditFiles);
const getActiveModelConfigMock = vi.mocked(getActiveModelConfig);
const readAssetBytesMock = vi.mocked(readAssetBytes);
const writeAssetFileMock = vi.mocked(writeAssetFile);

describe("image edits route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({
      user: {
        id: "user-1",
        username: "ocean",
        role: "USER",
      },
      response: null,
    });
    findProjectMock.mockResolvedValue({
      id: "project-1",
      userId: "user-1",
      name: "Test",
      canvasJson: "{}",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it("rejects unavailable or unauthorized source assets", async () => {
    findAssetMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://test.local/api/image-edits", {
        method: "POST",
        body: editForm(),
      })
    );
    const body = await response.json();

    expect(findAssetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "asset-1",
          userId: "user-1",
          projectId: "project-1",
        },
      })
    );
    expect(response.status).toBe(400);
    expect(body.error).toBe("Source image is unavailable");
  });

  it("falls back to the source asset's generation settings", async () => {
    findAssetMock.mockResolvedValue({
      id: "asset-1",
      userId: "user-1",
      projectId: "project-1",
      type: "GENERATED",
      mime: "image/png",
      width: null,
      height: null,
      storagePath: "user-1/project-1/source.png",
      createdAt: new Date(),
      generationJobs: [
        {
          size: "1536x1024",
          quality: "high",
          outputFormat: "webp",
        },
      ],
    } as any);
    readAssetBytesMock.mockResolvedValue(Buffer.from([1, 2, 3]));
    validateImageEditFilesMock.mockReturnValue({
      sourceDimensions: { width: 1, height: 1 },
      maskDimensions: { width: 1, height: 1 },
    });
    getActiveModelConfigMock.mockResolvedValue({
      id: "model-1",
      provider: "openai-compatible",
      model: "gpt-image-2",
      baseUrl: "https://api.example.com",
      encryptedApiKey: "encrypted",
      apiKey: "test-key",
      enabled: true,
      defaultOptions: "{}",
      options: {
        size: "1024x1024",
        quality: "auto",
        outputFormat: "png",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    createJobMock.mockResolvedValue({ id: "job-1" } as any);
    callGptImage2Mock.mockResolvedValue({
      bytes: new Uint8Array([4, 5, 6]),
      mime: "image/webp",
    });
    writeAssetFileMock.mockResolvedValue("user-1/project-1/output.webp");
    createAssetMock.mockResolvedValue({
      id: "asset-2",
      userId: "user-1",
      projectId: "project-1",
      type: "GENERATED",
      mime: "image/webp",
      width: null,
      height: null,
      storagePath: "user-1/project-1/output.webp",
      createdAt: new Date(),
    });
    updateJobMock.mockResolvedValue({} as any);

    const response = await POST(
      new Request("http://test.local/api/image-edits", {
        method: "POST",
        body: editForm(),
      })
    );

    expect(response.status).toBe(202);
    expect(validateGptImageSettingsMock).toHaveBeenCalledWith({
      size: "1536x1024",
      quality: "high",
      outputFormat: "webp",
    });
  });
});

function editForm() {
  const form = new FormData();
  form.append("projectId", "project-1");
  form.append("assetId", "asset-1");
  form.append("prompt", "change the hat");
  form.append("mask", new File(["mask"], "mask.png", { type: "image/png" }));
  return form;
}
