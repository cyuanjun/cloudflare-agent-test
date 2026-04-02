import type { DurableObjectState } from "@cloudflare/workers-types";
import type { AgentSummary, Env } from "../domain/contracts";

const AGENTS_KEY = "agents";

function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });
}

export class AgentRegistry {
  public constructor(
    private readonly state: DurableObjectState,
    private readonly _env: Env,
  ) {}

  public async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/agents") {
      const agents = await this.loadAgents();
      return json(agents);
    }

    if (request.method === "POST" && url.pathname === "/upsert") {
      const incoming = await request.json() as AgentSummary;
      const agents = await this.loadAgents();
      const next = agents.filter((agent) => agent.runId !== incoming.runId);
      next.push(incoming);
      next.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      await this.state.storage.put(AGENTS_KEY, next);
      return json({ ok: true });
    }

    return json({ error: "Not found." }, { status: 404 });
  }

  private async loadAgents(): Promise<AgentSummary[]> {
    return (await this.state.storage.get<AgentSummary[]>(AGENTS_KEY)) ?? [];
  }
}
