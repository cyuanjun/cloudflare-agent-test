import type { DurableObjectState } from "@cloudflare/workers-types";
import type { Env, RunInput, RunRecord } from "../domain/contracts";
import { upsertAgent } from "../domain/registry";
import { executeRun } from "../domain/pipeline";

const INPUT_KEY = "input";
const RECORD_KEY = "record";

function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });
}

async function loadRecord(storage: DurableObjectStorage): Promise<RunRecord | null> {
  return (await storage.get<RunRecord>(RECORD_KEY)) ?? null;
}

async function loadInput(storage: DurableObjectStorage): Promise<RunInput | null> {
  return (await storage.get<RunInput>(INPUT_KEY)) ?? null;
}

export class RunAgent {
  public constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  public async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/initialize") {
      return this.initialize(request);
    }
    if (request.method === "POST" && url.pathname === "/start") {
      return this.start();
    }
    if (request.method === "GET" && url.pathname === "/status") {
      const record = await loadRecord(this.state.storage);
      return record ? json(record) : json({ error: "Run not found." }, { status: 404 });
    }
    if (request.method === "GET" && url.pathname === "/details") {
      const [record, input] = await Promise.all([
        loadRecord(this.state.storage),
        loadInput(this.state.storage),
      ]);
      return record
        ? json({ record, input })
        : json({ error: "Run not found." }, { status: 404 });
    }
    return json({ error: "Not found." }, { status: 404 });
  }

  private async initialize(request: Request): Promise<Response> {
    const input = (await request.json()) as RunInput;
    const now = new Date().toISOString();
    const runId = new URL(request.url).searchParams.get("runId") ?? this.state.id.toString();
    const record: RunRecord = {
      runId,
      status: "queued",
      progress: "Run created and waiting to start.",
      createdAt: now,
      updatedAt: now,
      profileId: input.userProfile.agent_id,
    };

    await this.state.storage.put(INPUT_KEY, input);
    await this.state.storage.put(RECORD_KEY, record);
    await upsertAgent(this.env, record);
    return json(record, { status: 201 });
  }

  private async start(): Promise<Response> {
    const record = await loadRecord(this.state.storage);
    if (!record) {
      return json({ error: "Run not initialized." }, { status: 400 });
    }
    if (record.status === "running" || record.status === "completed") {
      return json(record);
    }

    const input = await loadInput(this.state.storage);
    if (!input) {
      return json({ error: "Missing run input." }, { status: 400 });
    }

    try {
      await this.updateRecord({
        ...record,
        status: "running",
        progress: "Agent started.",
      });

      const result = await executeRun(this.env, input.userProfile, input.userPreferences, async (message) => {
        const latest = await loadRecord(this.state.storage);
        if (!latest) {
          return;
        }
        await this.updateRecord({
          ...latest,
          status: "running",
          progress: message,
        });
      });

      const completed = await loadRecord(this.state.storage);
      if (!completed) {
        throw new Error("Run record disappeared during execution.");
      }

      await this.updateRecord({
        ...completed,
        status: "completed",
        progress: "Run completed successfully.",
        result,
        error: undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown run failure.";
      const latest = await loadRecord(this.state.storage);
      if (latest) {
        await this.updateRecord({
          ...latest,
          status: "failed",
          progress: "Run failed.",
          error: message,
        });
      }
    }

    const finalRecord = await loadRecord(this.state.storage);
    return json(finalRecord ?? { error: "Run record missing after execution." }, { status: finalRecord ? 200 : 500 });
  }

  private async updateRecord(record: RunRecord): Promise<void> {
    const nextRecord = {
      ...record,
      updatedAt: new Date().toISOString(),
    };
    await this.state.storage.put(RECORD_KEY, nextRecord);
    await upsertAgent(this.env, nextRecord);
  }
}
