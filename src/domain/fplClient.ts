import type { Env, FplBootstrap, FplFixture, FplHistoryResponse } from "./contracts";

const DEFAULT_BASE_URL = "https://fantasy.premierleague.com/api";
const CACHE_TTL_SECONDS = 300;

async function getCachedJson<T>(request: Request, cacheKey: string): Promise<T> {
  const cache = await caches.open("fpl-api-cache");
  const key = new Request(cacheKey, { method: "GET" });
  const cached = await cache.match(key);

  if (cached) {
    return (await cached.json()) as T;
  }

  const response = await fetch(request);
  if (!response.ok) {
    throw new Error(`FPL request failed: ${request.url} (${response.status})`);
  }

  const cloned = response.clone();
  const cacheResponse = new Response(cloned.body, cloned);
  cacheResponse.headers.set("Cache-Control", `public, max-age=${CACHE_TTL_SECONDS}`);
  await cache.put(key, cacheResponse);

  return (await response.json()) as T;
}

export class FplClient {
  private readonly baseUrl: string;

  public constructor(env: Env) {
    this.baseUrl = (env.FPL_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  }

  public async getBootstrap(): Promise<FplBootstrap> {
    return getCachedJson<FplBootstrap>(
      new Request(`${this.baseUrl}/bootstrap-static/`),
      `${this.baseUrl}/bootstrap-static/`,
    );
  }

  public async getFixtures(): Promise<FplFixture[]> {
    return getCachedJson<FplFixture[]>(
      new Request(`${this.baseUrl}/fixtures/`),
      `${this.baseUrl}/fixtures/`,
    );
  }

  public async getPlayerHistory(playerId: number): Promise<FplHistoryResponse> {
    return getCachedJson<FplHistoryResponse>(
      new Request(`${this.baseUrl}/element-summary/${playerId}/`),
      `${this.baseUrl}/element-summary/${playerId}/`,
    );
  }
}

export async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < values.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await mapper(values[current], current);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, values.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
