import type {
  RecommendationsApiClient,
  RecommendationsBackend,
} from "./RecommendationsApiClient";
import { createHttpRecommendationsApiClient } from "./HttpRecommendationsApiClient";
import { createInfluxRecommendationsApiClient } from "./InfluxRecommendationsApiClient";
import { createMockRecommendationsApiClient } from "./MockRecommendationsApiClient";

function isRecommendationsBackend(
  value: string | undefined
): value is RecommendationsBackend {
  return value === "mock" || value === "http" || value === "influx";
}

export function getRecommendationsBackend(): RecommendationsBackend {
  const configured =
    normalizeEnv(process.env.EXPO_PUBLIC_RECOMMENDATIONS_BACKEND) ??
    normalizeEnv(process.env.RECOMMENDATIONS_BACKEND);

  if (configured === undefined) {
    return "mock";
  }
  if (!isRecommendationsBackend(configured)) {
    throw new Error(`Unsupported recommendations backend: ${configured}`);
  }
  return configured;
}

function getBaseUrl(): string | undefined {
  return (
    normalizeEnv(process.env.EXPO_PUBLIC_RECOMMENDATIONS_BASE_URL) ??
    normalizeEnv(process.env.RECOMMENDATIONS_BASE_URL)
  );
}

let cachedClient: RecommendationsApiClient | undefined;

export function getRecommendationsApiClient(): RecommendationsApiClient {
  if (!cachedClient) {
    const backend = getRecommendationsBackend();
    switch (backend) {
      case "mock":
        cachedClient = createMockRecommendationsApiClient();
        break;
      case "http": {
        const baseUrl = getBaseUrl();
        if (!baseUrl) {
          throw new Error(
            "RECOMMENDATIONS_BASE_URL no está configurado para el backend http"
          );
        }
        cachedClient = createHttpRecommendationsApiClient(baseUrl);
        break;
      }
      case "influx":
        cachedClient = createInfluxRecommendationsApiClient();
        break;
      default: {
        const exhaustive: never = backend;
        throw new Error(`Unsupported recommendations backend: ${exhaustive}`);
      }
    }
  }
  return cachedClient;
}

export function resetRecommendationsApiClientForTests(): void {
  cachedClient = undefined;
}

export function setRecommendationsApiClientForTests(
  client: RecommendationsApiClient | undefined
): void {
  cachedClient = client;
}

function normalizeEnv(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}
