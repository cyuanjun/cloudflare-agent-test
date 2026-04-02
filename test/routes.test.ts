import { describe, expect, it, vi } from "vitest";
import { routeRequest } from "../src/index";
import { validPreferences, validProfile } from "./fixtures/referenceInputs";

describe("routeRequest", () => {
  it("creates runs and fetches status through the durable object stub", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/initialize")) {
        return new Response(JSON.stringify({ runId: "run-1", status: "queued" }), { status: 201 });
      }
      if (url.includes("/start")) {
        return new Response(JSON.stringify({ runId: "run-1", status: "running" }), { status: 200 });
      }
      return new Response(JSON.stringify({ runId: "run-1", status: "completed", progress: "done", createdAt: "x", updatedAt: "x" }), { status: 200 });
    });

    const env = {
      AGENT_REGISTRY: {
        idFromName: () => ({}),
        get: () => ({ fetch: fetchMock }),
      },
      RUN_AGENT: {
        idFromName: () => ({}),
        get: () => ({ fetch: fetchMock }),
      },
    } as any;

    const waitUntil = vi.fn();
    const createResponse = await routeRequest(new Request("https://example.com/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userProfile: validProfile, userPreferences: validPreferences }),
    }), env, { waitUntil } as any);

    expect(createResponse.status).toBe(202);
    expect(waitUntil).toHaveBeenCalledTimes(1);

    const statusResponse = await routeRequest(new Request("https://example.com/api/runs/run-1"), env, { waitUntil } as any);
    expect(statusResponse.status).toBe(200);
    const payload = await statusResponse.json() as { status: string };
    expect(payload.status).toBe("completed");
  });

  it("returns shared dataset metadata and payload", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/meta")) {
        return new Response(JSON.stringify({
          available: true,
          datasetVersion: "v1",
          refreshedAt: "2026-04-02T00:00:00.000Z",
          currentGameweek: 30,
          playerCount: 600,
          schemaVersion: 2,
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
        schemaVersion: 2,
        datasetVersion: "v1",
        refreshedAt: "2026-04-02T00:00:00.000Z",
        currentGameweek: 30,
        playerCount: 600,
        players: [],
        playerFeatures: [],
        fixtureDifficultySummary: [],
      }), { status: 200 });
    });

    const env = {
      AGENT_REGISTRY: {
        idFromName: () => ({}),
        get: () => ({ fetch: fetchMock }),
      },
      DATASET_CACHE: {
        idFromName: () => ({}),
        get: () => ({ fetch: fetchMock }),
      },
      RUN_AGENT: {
        idFromName: () => ({}),
        get: () => ({ fetch: fetchMock }),
      },
    } as any;

    const response = await routeRequest(new Request("https://example.com/api/data"), env, { waitUntil: vi.fn() } as any);
    expect(response.status).toBe(200);
    const payload = await response.json() as { available: boolean; datasetVersion: string };
    expect(payload.available).toBe(true);
    expect(payload.datasetVersion).toBe("v1");
  });

  it("returns shared players and features collections", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      schemaVersion: 2,
      datasetVersion: "v1",
      refreshedAt: "2026-04-02T00:00:00.000Z",
      currentGameweek: 30,
      playerCount: 1,
      players: [{ id: 1, web_name: "Salah", total_points: 200, form: "7.1", ict_index: "220.3", status: "a" }],
      playerFeatures: [{ player_id: 1, xGI_per90: 0.9 }],
      fixtureDifficultySummary: [],
    }), { status: 200 }));

    const env = {
      AGENT_REGISTRY: {
        idFromName: () => ({}),
        get: () => ({ fetch: fetchMock }),
      },
      DATASET_CACHE: {
        idFromName: () => ({}),
        get: () => ({ fetch: fetchMock }),
      },
      RUN_AGENT: {
        idFromName: () => ({}),
        get: () => ({ fetch: fetchMock }),
      },
    } as any;

    const playersResponse = await routeRequest(new Request("https://example.com/api/players"), env, { waitUntil: vi.fn() } as any);
    expect(playersResponse.status).toBe(200);
    const playersPayload = await playersResponse.json() as Array<{ web_name: string }>;
    expect(playersPayload[0].web_name).toBe("Salah");

    const featuresResponse = await routeRequest(new Request("https://example.com/api/features"), env, { waitUntil: vi.fn() } as any);
    expect(featuresResponse.status).toBe(200);
    const featuresPayload = await featuresResponse.json() as Array<{ xGI_per90: number }>;
    expect(featuresPayload[0].xGI_per90).toBe(0.9);
  });

  it("returns deployed agent registry rows", async () => {
    const registryFetch = vi.fn(async () => new Response(JSON.stringify([
      {
        runId: "run-1",
        profileId: "test_001",
        status: "completed",
        progress: "done",
        createdAt: "2026-04-02T00:00:00.000Z",
        updatedAt: "2026-04-02T00:10:00.000Z",
      },
    ]), { status: 200 }));

    const env = {
      AGENT_REGISTRY: {
        idFromName: () => ({}),
        get: () => ({ fetch: registryFetch }),
      },
      DATASET_CACHE: {
        idFromName: () => ({}),
        get: () => ({ fetch: registryFetch }),
      },
      RUN_AGENT: {
        idFromName: () => ({}),
        get: () => ({ fetch: registryFetch }),
      },
    } as any;

    const response = await routeRequest(new Request("https://example.com/api/agents"), env, { waitUntil: vi.fn() } as any);
    expect(response.status).toBe(200);
    const payload = await response.json() as Array<{ runId: string }>;
    expect(payload[0].runId).toBe("run-1");
  });

  it("returns profile detail with latest input and run history", async () => {
    const registryFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/details")) {
        return new Response(JSON.stringify({
          record: {
            runId: "run-1",
            profileId: "test_001",
            status: "completed",
            progress: "done",
            createdAt: "2026-04-02T00:00:00.000Z",
            updatedAt: "2026-04-02T00:10:00.000Z",
            result: {
              profileId: "test_001",
              generatedAt: "2026-04-02T00:10:00.000Z",
              datasetVersion: "v1",
              rankings: { GKP: [], DEF: [], MID: [], FWD: [] },
              shortlists: { GKP: [], DEF: [], MID: [], FWD: [] },
              squad: [],
              totalCost: 100,
              budgetRemaining: 0,
              totalScore: 123.4,
              constraintViolations: [],
            },
          },
          input: {
            userProfile: validProfile,
            userPreferences: validPreferences,
          },
        }), { status: 200 });
      }
      return new Response(JSON.stringify([
        {
          runId: "run-1",
          profileId: "test_001",
          status: "completed",
          progress: "done",
          createdAt: "2026-04-02T00:00:00.000Z",
          updatedAt: "2026-04-02T00:10:00.000Z",
        },
      ]), { status: 200 });
    });

    const env = {
      AGENT_REGISTRY: {
        idFromName: () => ({}),
        get: () => ({ fetch: registryFetch }),
      },
      DATASET_CACHE: {
        idFromName: () => ({}),
        get: () => ({ fetch: registryFetch }),
      },
      RUN_AGENT: {
        idFromName: () => ({}),
        get: () => ({ fetch: registryFetch }),
      },
    } as any;

    const response = await routeRequest(new Request("https://example.com/api/profiles/test_001"), env, { waitUntil: vi.fn() } as any);
    expect(response.status).toBe(200);
    const payload = await response.json() as {
      profileId: string;
      latestInput: { userProfile: { agent_id: string } };
      latestResult: { totalScore: number };
      runs: Array<{ runId: string }>;
      summary: { totalRuns: number };
    };
    expect(payload.profileId).toBe("test_001");
    expect(payload.latestInput.userProfile.agent_id).toBe(validProfile.agent_id);
    expect(payload.latestResult.totalScore).toBe(123.4);
    expect(payload.runs[0].runId).toBe("run-1");
    expect(payload.summary.totalRuns).toBe(1);
  });
});
