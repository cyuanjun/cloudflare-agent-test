import type { Env, SharedDataset } from "./contracts";
import { deriveDataset } from "./features";
import { FplClient, mapWithConcurrency } from "./fplClient";

const DATASET_NAME = "shared-fpl-dataset";

export function isSharedDatasetUsable(dataset: SharedDataset | null): dataset is SharedDataset {
  if (!dataset || !Array.isArray(dataset.players) || dataset.players.length === 0) {
    return false;
  }

  const firstPlayer = dataset.players[0] as unknown as Record<string, unknown>;
  return (
    dataset.schemaVersion >= 2 &&
    typeof firstPlayer.total_points === "number" &&
    typeof firstPlayer.form === "string" &&
    typeof firstPlayer.ict_index === "string" &&
    typeof firstPlayer.status === "string"
  );
}

function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });
}

export async function buildSharedDataset(env: Env): Promise<SharedDataset> {
  const client = new FplClient(env);
  const [bootstrap, fixtures] = await Promise.all([
    client.getBootstrap(),
    client.getFixtures(),
  ]);
  const historyResponses = await mapWithConcurrency(
    bootstrap.elements.map((element) => element.id),
    12,
    async (playerId) => [playerId, await client.getPlayerHistory(playerId)] as const,
  );
  return deriveDataset(bootstrap, fixtures, new Map(historyResponses));
}

export function getDatasetStub(env: Env): DurableObjectStub {
  const id = env.DATASET_CACHE.idFromName(DATASET_NAME);
  return env.DATASET_CACHE.get(id);
}

export async function fetchSharedDataset(env: Env): Promise<SharedDataset | null> {
  const response = await getDatasetStub(env).fetch("https://dataset.internal/dataset");
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load shared dataset (${response.status}).`);
  }
  const dataset = await response.json() as SharedDataset;
  return isSharedDatasetUsable(dataset) ? dataset : null;
}

export async function refreshSharedDataset(env: Env): Promise<SharedDataset> {
  const response = await getDatasetStub(env).fetch("https://dataset.internal/refresh", {
    method: "POST",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: "Shared dataset refresh failed." })) as Record<string, unknown>;
    throw new Error(typeof payload.error === "string" ? payload.error : "Shared dataset refresh failed.");
  }
  const dataset = await fetchSharedDataset(env);
  if (!dataset) {
    throw new Error("Shared dataset refresh completed but no usable dataset was stored.");
  }
  return dataset;
}

export async function refreshSharedDatasetMeta(env: Env): Promise<Record<string, unknown>> {
  const response = await getDatasetStub(env).fetch("https://dataset.internal/refresh", {
    method: "POST",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: "Shared dataset refresh failed." })) as Record<string, unknown>;
    throw new Error(typeof payload.error === "string" ? payload.error : "Shared dataset refresh failed.");
  }
  return await response.json() as Record<string, unknown>;
}

export async function ensureSharedDataset(
  env: Env,
  onProgress?: (message: string) => Promise<void>,
): Promise<SharedDataset> {
  const existing = await fetchSharedDataset(env);
  if (existing) {
    await onProgress?.(`Using cached shared dataset from ${existing.refreshedAt}.`);
    return existing;
  }

  await onProgress?.("No shared dataset is cached yet. Refreshing the shared dataset now.");
  return refreshSharedDataset(env);
}

export { json };
