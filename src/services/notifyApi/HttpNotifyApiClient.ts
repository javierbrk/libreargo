import { HubApiInvalidResponseError, HubApiNetworkError } from "../hubApi/errors";
import type { NotifyApiClient, NotifyMessage } from "./NotifyApiClient";

type HttpResponse = {
  ok: boolean;
  status: number;
  text(): Promise<string>;
};

const DEFAULT_TIMEOUT_MS = 5000;

export function createHttpNotifyApiClient(baseUrl: string): NotifyApiClient {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  return {
    async pollMessages(
      topic: string,
      since?: string
    ): Promise<readonly NotifyMessage[]> {
      const params = new URLSearchParams({ poll: "1" });
      if (since && since !== "") {
        params.set("since", since);
      }
      const url = `${normalizedBaseUrl}/${encodeURIComponent(topic)}/json?${params.toString()}`;

      const response = await request(url);
      const body = await response.text();
      return parseNdjson(body, topic);
    },
  };
}

async function request(url: string): Promise<HttpResponse> {
  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : undefined;
  const timer = controller
    ? setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)
    : undefined;

  try {
    const response = (await fetch(url, {
      method: "GET",
      signal: controller?.signal,
    })) as HttpResponse;
    if (!response.ok) {
      throw new HubApiNetworkError(
        `ntfy request failed with status ${response.status}`
      );
    }
    return response;
  } catch (error) {
    if (error instanceof HubApiNetworkError) {
      throw error;
    }
    throw new HubApiNetworkError("No se pudo conectar con ntfy.sh");
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function parseNdjson(body: string, topic: string): readonly NotifyMessage[] {
  if (body.trim() === "") {
    return [];
  }
  const lines = body.split("\n").filter((line) => line.trim() !== "");
  const messages: NotifyMessage[] = [];

  for (const line of lines) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      throw new HubApiInvalidResponseError();
    }
    if (!isPlainObject(parsed)) {
      throw new HubApiInvalidResponseError();
    }
    const data = parsed as Record<string, unknown>;

    // ntfy puede emitir eventos "open"/"keepalive" además de "message"; sólo
    // nos interesan los mensajes con contenido.
    if (data.event !== "message") {
      continue;
    }
    if (
      typeof data.id !== "string" ||
      typeof data.time !== "number" ||
      typeof data.message !== "string"
    ) {
      throw new HubApiInvalidResponseError();
    }

    messages.push({
      id: data.id,
      time: data.time,
      event: data.event,
      topic: typeof data.topic === "string" ? data.topic : topic,
      message: data.message,
      title: typeof data.title === "string" ? data.title : undefined,
      tags: isStringArray(data.tags) ? [...data.tags] : undefined,
      priority:
        typeof data.priority === "number" ? data.priority : undefined,
    });
  }

  return messages;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
