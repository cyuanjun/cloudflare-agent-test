import type { DurableObjectState } from "@cloudflare/workers-types";
import type { Env, SharedDataset as SharedDatasetPayload } from "../domain/contracts";
import { buildSharedDataset, isSharedDatasetUsable } from "../domain/sharedDataset";

const DATASET_KEY = "dataset";
const META_KEY = "meta";

function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });
}

export class SharedDataset {
  public constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  public async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/dataset") {
      const dataset = await this.loadDataset();
      if (!dataset) {
        return json({ error: "Shared dataset has not been built yet." }, { status: 404 });
      }
      return json(dataset);
    }

    if (request.method === "GET" && url.pathname === "/meta") {
      const dataset = await this.loadDataset();
      return json({
        available: Boolean(dataset),
        datasetVersion: dataset?.datasetVersion ?? null,
        refreshedAt: dataset?.refreshedAt ?? null,
        currentGameweek: dataset?.currentGameweek ?? null,
        playerCount: dataset?.playerCount ?? 0,
        schemaVersion: dataset?.schemaVersion ?? null,
      });
    }

    if (request.method === "POST" && url.pathname === "/refresh") {
      try {
        const dataset = await buildSharedDataset(this.env);
        await this.state.storage.put(DATASET_KEY, dataset);
        await this.state.storage.put(META_KEY, {
          refreshedAt: dataset.refreshedAt,
          datasetVersion: dataset.datasetVersion,
        });
        return json({
          available: true,
          schemaVersion: dataset.schemaVersion,
          datasetVersion: dataset.datasetVersion,
          refreshedAt: dataset.refreshedAt,
          currentGameweek: dataset.currentGameweek,
          playerCount: dataset.playerCount,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Shared dataset refresh failed.";
        return json({ error: message }, { status: 500 });
      }
    }

    return json({ error: "Not found." }, { status: 404 });
  }

  private async loadDataset(): Promise<SharedDatasetPayload | null> {
    const dataset = (await this.state.storage.get<SharedDatasetPayload>(DATASET_KEY)) ?? null;
    return isSharedDatasetUsable(dataset) ? dataset : null;
  }
}
