import { RunAgent } from "./agent/RunAgent";
import { AgentRegistry } from "./agent/AgentRegistry";
import { SharedDataset } from "./agent/SharedDataset";
import type { Env, RunInput, RunRecord } from "./domain/contracts";
import { listAgents } from "./domain/registry";
import { getDatasetStub, refreshSharedDataset, refreshSharedDatasetMeta } from "./domain/sharedDataset";
import { validateRunInput } from "./domain/schemas";
import { getTemplate } from "./domain/templates";
import { renderAgentProfilePage } from "./ui/agentProfilePage";
import { renderAgentsPage } from "./ui/agentsPage";
import { renderCreateAgentPage } from "./ui/createAgentPage";
import { renderDataPage } from "./ui/dataPage";
import { renderOverviewPage } from "./ui/overviewPage";
import { renderPlayersPage } from "./ui/playersPage";

function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(init?.headers ?? {}),
    },
  });
}

function summarizeRuns(runs: Array<{ status: string; updatedAt: string }>) {
  return {
    totalRuns: runs.length,
    queuedRuns: runs.filter((run) => run.status === "queued").length,
    runningRuns: runs.filter((run) => run.status === "running").length,
    completedRuns: runs.filter((run) => run.status === "completed").length,
    failedRuns: runs.filter((run) => run.status === "failed").length,
    lastUpdated: runs[0]?.updatedAt ?? null,
  };
}

export async function routeRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/") {
    return new Response(renderOverviewPage(), {
      headers: {
        "content-type": "text/html; charset=utf-8",
      },
    });
  }

  if (request.method === "GET" && url.pathname === "/data") {
    return new Response(renderDataPage(), {
      headers: {
        "content-type": "text/html; charset=utf-8",
      },
    });
  }

  if (request.method === "GET" && url.pathname === "/players") {
    return new Response(renderPlayersPage(), {
      headers: {
        "content-type": "text/html; charset=utf-8",
      },
    });
  }

  if (request.method === "GET" && url.pathname === "/create-agent") {
    return new Response(renderCreateAgentPage(), {
      headers: {
        "content-type": "text/html; charset=utf-8",
      },
    });
  }

  if (request.method === "GET" && url.pathname === "/agents") {
    return new Response(renderAgentsPage(), {
      headers: {
        "content-type": "text/html; charset=utf-8",
      },
    });
  }

  if (request.method === "GET" && url.pathname.startsWith("/agents/")) {
    const profileId = decodeURIComponent(url.pathname.replace("/agents/", ""));
    return new Response(renderAgentProfilePage(profileId), {
      headers: {
        "content-type": "text/html; charset=utf-8",
      },
    });
  }

  if (request.method === "GET" && url.pathname.startsWith("/api/templates/")) {
    const name = url.pathname.replace("/api/templates/", "");
    const template = getTemplate(name);
    return template ? json(template) : json({ error: "Unknown template." }, { status: 404 });
  }

  if (request.method === "GET" && url.pathname === "/api/data") {
    const metaResponse = await getDatasetStub(env).fetch(`${url.origin}/meta`);
    const meta = await metaResponse.json() as Record<string, unknown>;
    if (!metaResponse.ok) {
      return json(meta, { status: metaResponse.status });
    }

    let dataset: unknown = null;
    const datasetResponse = await getDatasetStub(env).fetch(`${url.origin}/dataset`);
    if (datasetResponse.ok) {
      dataset = await datasetResponse.json();
    }

    return json({
      ...meta,
      dataset,
    });
  }

  if (request.method === "GET" && url.pathname === "/api/players") {
    const datasetResponse = await getDatasetStub(env).fetch(`${url.origin}/dataset`);
    if (!datasetResponse.ok) {
      const payload = await datasetResponse.json().catch(() => ({ error: "Shared dataset unavailable." }));
      return json(payload, { status: datasetResponse.status });
    }
    const dataset = await datasetResponse.json() as { players: unknown[] };
    return json(dataset.players);
  }

  if (request.method === "GET" && url.pathname === "/api/features") {
    const datasetResponse = await getDatasetStub(env).fetch(`${url.origin}/dataset`);
    if (!datasetResponse.ok) {
      const payload = await datasetResponse.json().catch(() => ({ error: "Shared dataset unavailable." }));
      return json(payload, { status: datasetResponse.status });
    }
    const dataset = await datasetResponse.json() as { playerFeatures: unknown[] };
    return json(dataset.playerFeatures);
  }

  if (request.method === "POST" && url.pathname === "/api/data/refresh") {
    try {
      const meta = await refreshSharedDatasetMeta(env);
      return json(meta);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Shared dataset refresh failed.";
      return json({ error: message }, { status: 500 });
    }
  }

  if (request.method === "GET" && url.pathname === "/api/agents") {
    try {
      const agents = await listAgents(env);
      return json(agents);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load deployed agents.";
      return json({ error: message }, { status: 500 });
    }
  }

  if (request.method === "GET" && url.pathname.startsWith("/api/profiles/")) {
    try {
      const profileId = decodeURIComponent(url.pathname.replace("/api/profiles/", ""));
      const agents = await listAgents(env);
      const profileRuns = agents.filter((agent) => agent.profileId === profileId);
      if (!profileRuns.length) {
        return json({ error: "Profile not found." }, { status: 404 });
      }

      const details = await Promise.all(profileRuns.map(async (agent) => {
        const id = env.RUN_AGENT.idFromName(agent.runId);
        const stub = env.RUN_AGENT.get(id);
        const response = await stub.fetch(`${url.origin}/details`);
        if (!response.ok) {
          return {
            record: {
              runId: agent.runId,
              profileId: agent.profileId ?? undefined,
              status: agent.status,
              progress: agent.progress,
              createdAt: agent.createdAt,
              updatedAt: agent.updatedAt,
              error: agent.error,
            } satisfies RunRecord,
            input: null,
          };
        }
        return await response.json() as { record: RunRecord; input: RunInput | null };
      }));

      const runs = details
        .map((detail) => detail.record)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      const latestInput = details.find((detail) => detail.input)?.input ?? null;
      const latestResult = runs.find((run) => run.result)?.result ?? null;

      return json({
        profileId,
        latestInput,
        latestResult,
        runs,
        summary: summarizeRuns(runs),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load profile detail.";
      return json({ error: message }, { status: 500 });
    }
  }

  if (request.method === "POST" && url.pathname === "/api/runs") {
    try {
      const payload = validateRunInput(await request.json());
      const runId = crypto.randomUUID();
      const id = env.RUN_AGENT.idFromName(runId);
      const stub = env.RUN_AGENT.get(id);
      const baseUrl = new URL(request.url).origin;

      await stub.fetch(`${baseUrl}/initialize?runId=${encodeURIComponent(runId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      ctx.waitUntil(stub.fetch(`${baseUrl}/start`, { method: "POST" }));

      return json({ runId, status: "queued" }, { status: 202 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid run request.";
      return json({ error: message }, { status: 400 });
    }
  }

  if (request.method === "GET" && url.pathname.startsWith("/api/runs/")) {
    const runId = url.pathname.replace("/api/runs/", "");
    const id = env.RUN_AGENT.idFromName(runId);
    const stub = env.RUN_AGENT.get(id);
    return stub.fetch(`${url.origin}/status`);
  }

  return json({ error: "Not found." }, { status: 404 });
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return routeRequest(request, env as Env, ctx);
  },
  scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(refreshSharedDataset(env));
  },
};

export { RunAgent };
export { SharedDataset };
export { AgentRegistry };
