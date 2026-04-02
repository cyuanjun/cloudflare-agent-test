import type { AgentSummary, Env, RunRecord } from "./contracts";

const REGISTRY_NAME = "agent-registry";

export function getRegistryStub(env: Env): DurableObjectStub {
  const id = env.AGENT_REGISTRY.idFromName(REGISTRY_NAME);
  return env.AGENT_REGISTRY.get(id);
}

export async function upsertAgent(env: Env, record: RunRecord): Promise<void> {
  await getRegistryStub(env).fetch("https://registry.internal/upsert", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      runId: record.runId,
      profileId: record.profileId ?? record.result?.profileId ?? null,
      status: record.status,
      progress: record.progress,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      error: record.error,
    } satisfies AgentSummary),
  });
}

export async function listAgents(env: Env): Promise<AgentSummary[]> {
  const response = await getRegistryStub(env).fetch("https://registry.internal/agents");
  if (!response.ok) {
    throw new Error(`Failed to load agent registry (${response.status}).`);
  }
  return await response.json() as AgentSummary[];
}
