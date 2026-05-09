import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/server/db";
import { requireUser } from "@/lib/server/session";

import { GET } from "./route";

vi.mock("@/lib/server/db", () => ({
  prisma: {
    generationJob: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/server/session", () => ({
  requireUser: vi.fn(),
}));

const requireUserMock = vi.mocked(requireUser);
const findJobMock = vi.mocked(prisma.generationJob.findFirst);

describe("generation job status route", () => {
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
  });

  it("scopes job lookup to the current user", async () => {
    findJobMock.mockResolvedValue(null);

    const response = await GET(new Request("http://test.local"), {
      params: Promise.resolve({ jobId: "job-1" }),
    });

    expect(findJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "job-1",
          userId: "user-1",
        },
      })
    );
    expect(response.status).toBe(404);
  });

  it("returns the completed asset for a user's own job", async () => {
    findJobMock.mockResolvedValue({
      id: "job-1",
      operation: "EDIT",
      status: "SUCCEEDED",
      error: null,
      outputAsset: {
        id: "asset-1",
        mime: "image/png",
        width: null,
        height: null,
      },
    } as any);

    const response = await GET(new Request("http://test.local"), {
      params: Promise.resolve({ jobId: "job-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.job.asset).toMatchObject({
      id: "asset-1",
      url: "/api/assets/asset-1/blob",
      mime: "image/png",
    });
  });
});
