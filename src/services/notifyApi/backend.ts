import type { NotifyApiClient, NotifyBackend } from "./NotifyApiClient";
import { createHttpNotifyApiClient } from "./HttpNotifyApiClient";
import { createMockNotifyApiClient } from "./MockNotifyApiClient";

const DEFAULT_BASE_URL = "https://ntfy.sh";

function isNotifyBackend(value: string | undefined): value is NotifyBackend {
  return value === "mock" || value === "http";
}

export function getNotifyBackend(): NotifyBackend {
  const configured =
    normalizeEnv(process.env.EXPO_PUBLIC_NOTIFY_BACKEND) ??
    normalizeEnv(process.env.NOTIFY_BACKEND);

  if (configured === undefined) {
    return "mock";
  }
  if (!isNotifyBackend(configured)) {
    throw new Error(`Unsupported notify backend: ${configured}`);
  }
  return configured;
}

function getBaseUrl(): string {
  return (
    normalizeEnv(process.env.EXPO_PUBLIC_NOTIFY_BASE_URL) ??
    normalizeEnv(process.env.NOTIFY_BASE_URL) ??
    DEFAULT_BASE_URL
  );
}

let cachedClient: NotifyApiClient | undefined;

export function getNotifyApiClient(): NotifyApiClient {
  if (!cachedClient) {
    const backend = getNotifyBackend();
    switch (backend) {
      case "mock":
        cachedClient = createMockNotifyApiClient();
        break;
      case "http":
        cachedClient = createHttpNotifyApiClient(getBaseUrl());
        break;
      default: {
        const exhaustive: never = backend;
        throw new Error(`Unsupported notify backend: ${exhaustive}`);
      }
    }
  }
  return cachedClient;
}

export function resetNotifyApiClientForTests(): void {
  cachedClient = undefined;
}

export function setNotifyApiClientForTests(
  client: NotifyApiClient | undefined
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
