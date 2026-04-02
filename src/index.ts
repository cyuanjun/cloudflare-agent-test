import { RunAgent } from "./agent/RunAgent";
import { SharedDataset } from "./agent/SharedDataset";
import type { Env } from "./domain/contracts";
import { getDatasetStub, refreshSharedDataset } from "./domain/sharedDataset";
import { validateRunInput } from "./domain/schemas";
import { getTemplate } from "./domain/templates";
import { renderDataPage } from "./ui/dataPage";
import { renderHomePage } from "./ui/page";
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

export async function routeRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/") {
    return new Response(renderHomePage(), {
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
      const dataset = await refreshSharedDataset(env);
      return json(dataset);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Shared dataset refresh failed.";
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
