import type { Recommendation } from "../../types";
import { HubApiInvalidResponseError, HubApiNetworkError } from "../hubApi/errors";
import type { RecommendationsApiClient } from "./RecommendationsApiClient";
import { mapRecommendationListResponse } from "./adapters";

type HttpResponse = {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
  text(): Promise<string>;
};

const DEFAULT_TIMEOUT_MS = 5000;
const MESSAGES_PATH = "/messages";

export function createHttpRecommendationsApiClient(
  baseUrl: string
): RecommendationsApiClient {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  return {
    async getLatest(limit: number): Promise<readonly Recommendation[]> {
      const response = await request(
        `${normalizedBaseUrl}${MESSAGES_PATH}?limit=${limit}`,
        { method: "GET" }
      );
      const recommendations = mapRecommendationListResponse(
        await readBody(response)
      );
      return [...recommendations]
        .sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        )
        .slice(0, limit);
    },
    async submitQuery(text: string): Promise<void> {
      await request(`${normalizedBaseUrl}${MESSAGES_PATH}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
    },
  };
}

async function request(url: string, init: RequestInit): Promise<HttpResponse> {
  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : undefined;
  const timer = controller
    ? setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)
    : undefined;

  try {
    const response = (await fetch(url, {
      ...init,
      signal: controller?.signal,
    })) as HttpResponse;
    if (!response.ok) {
      throw new HubApiNetworkError(
        `Recommendations request failed with status ${response.status}`
      );
    }
    return response;
  } catch (error) {
    if (error instanceof HubApiNetworkError) {
      throw error;
    }
    throw new HubApiNetworkError(
      "No se pudo conectar con el backend de recomendaciones"
    );
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

async function readBody(response: HttpResponse): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  const isJson =
    contentType.includes("application/json") || contentType.includes("+json");
  try {
    return isJson ? await response.json() : await response.text();
  } catch {
    throw new HubApiInvalidResponseError();
  }
}
