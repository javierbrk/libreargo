import type { HubApiClient, HubDataBackend } from "./HubApiClient";
import { createHttpHubApiClient } from "./HttpHubApiClient";
import { createInfluxHubApiClient } from "./InfluxHubApiClient";
import { createMockHubApiClient } from "./MockHubApiClient";
import type { ConnectionMode } from "../../types";

function isHubDataBackend(value: string | undefined): value is HubDataBackend {
  return value === "mock" || value === "http";
}

export function getHubDataBackend(): HubDataBackend {
  const configuredBackend =
    normalizeBackendEnv(process.env.EXPO_PUBLIC_HUB_DATA_BACKEND) ??
    normalizeBackendEnv(process.env.HUB_DATA_BACKEND);
  if (configuredBackend === undefined || configuredBackend.trim() === "") {
    return "mock";
  }
  if (!isHubDataBackend(configuredBackend)) {
    throw new Error(`Unsupported hub data backend: ${configuredBackend}`);
  }
  return configuredBackend;
}

let overrideClient: HubApiClient | undefined;
let cachedMockClient: HubApiClient | undefined;
let cachedHttpClient: HubApiClient | undefined;
let cachedInfluxClient: HubApiClient | undefined;

export function getHubApiClient(
  mode: ConnectionMode = "directo"
): HubApiClient {
  if (overrideClient) {
    return overrideClient;
  }

  const backend = getHubDataBackend();
  switch (backend) {
    case "mock":
      if (!cachedMockClient) {
        cachedMockClient = createMockHubApiClient();
      }
      return cachedMockClient;
    case "http":
      if (mode === "online") {
        if (!cachedInfluxClient) {
          cachedInfluxClient = createInfluxHubApiClient();
        }
        return cachedInfluxClient;
      }
      if (!cachedHttpClient) {
        cachedHttpClient = createHttpHubApiClient();
      }
      return cachedHttpClient;
    default: {
      const exhaustiveCheck: never = backend;
      throw new Error(`Unsupported hub data backend: ${exhaustiveCheck}`);
    }
  }
}

export function resetHubApiClientForTests(): void {
  overrideClient = undefined;
  cachedMockClient = undefined;
  cachedHttpClient = undefined;
  cachedInfluxClient = undefined;
}

export function setHubApiClientForTests(client: HubApiClient | undefined): void {
  overrideClient = client;
}

function normalizeBackendEnv(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}
