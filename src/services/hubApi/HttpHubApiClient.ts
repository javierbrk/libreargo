import type { Alarm } from "../../types";
import type { HubApiClient, RegisterEndpointResult } from "./HubApiClient";
import {
  mapConfigurationResponse,
  mapRelayListResponse,
  mapSensorDataResponse,
  mapToggleRelayResponse,
} from "./adapters";
import { parseAlarmsFromSensorData } from "./alarmsParser";
import {
  HubApiInvalidResponseError,
  HubApiNetworkError,
  HubApiToggleError,
} from "./errors";

type HubResponse = {
  ok: boolean;
  status: number;
  headers: {
    get(name: string): string | null;
  };
  json(): Promise<unknown>;
  text(): Promise<string>;
};

const PING_TIMEOUT_MS = 3000;
const DEFAULT_TIMEOUT_MS = 5000;

export function createHttpHubApiClient(): HubApiClient {
  return {
    async getConfig(hubIp: string) {
      const response = await request(hubIp, "/config", { method: "GET" });
      return mapConfigurationResponse(await readJsonBody(response));
    },
    async getActual(hubIp: string) {
      const response = await request(hubIp, "/actual", { method: "GET" });
      return mapSensorDataResponse(await readJsonBody(response));
    },
    async getRelays(hubIp: string) {
      const response = await request(hubIp, "/api/relays", { method: "GET" });
      return mapRelayListResponse(await readJsonBody(response));
    },
    async toggleRelay(hubIp: string, addr: number, ch: number) {
      const response = await request(
        hubIp,
        `/api/relay/toggle?addr=${addr}&ch=${ch}`,
        { method: "POST" }
      );

      if (!response.ok) {
        throw new HubApiToggleError();
      }

      return mapToggleRelayResponse(await readBody(response));
    },
    async getAlarms(hubIp: string): Promise<readonly Alarm[]> {
      // Contrato confirmado por firmware (V2): las alarmas se derivan
      // del campo `errors` de /actual. Cada entrada llega como
      // "<texto>,<timestamp>" y se parsea localmente.
      // La suscripción push a `notify/<Hub_ID>` queda fuera de MVP.
      const response = await request(hubIp, "/actual", { method: "GET" });
      const sensorData = mapSensorDataResponse(await readJsonBody(response));
      return parseAlarmsFromSensorData(sensorData);
    },
    async pingHub(hubIp: string): Promise<boolean> {
      try {
        const response = await request(
          hubIp,
          "/actual",
          { method: "GET" },
          PING_TIMEOUT_MS
        );
        return response.ok;
      } catch {
        return false;
      }
    },
    async registerPushEndpoint(
      hubIp: string,
      endpointUrl: string,
      instance: string
    ): Promise<RegisterEndpointResult> {
      const fullUrl = `http://${hubIp}/api/notify/subscribe`;
      const requestBody = JSON.stringify({ endpoint: endpointUrl, instance });
      try {
        const response = await request(
          hubIp,
          "/api/notify/subscribe",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: requestBody,
          },
          DEFAULT_TIMEOUT_MS
        );
        let responseText = "";
        try {
          responseText = await response.text();
        } catch {
          responseText = response.ok ? "OK" : "Error";
        }
        return {
          ok: response.ok,
          url: fullUrl,
          requestBody,
          status: response.status,
          responseText,
        };
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : "Network error / Timeout";
        return {
          ok: false,
          url: fullUrl,
          requestBody,
          responseText: errMsg,
        };
      }
    },
    async getSubscribers(hubIp: string): Promise<readonly string[]> {
      try {
        const response = await request(
          hubIp,
          "/api/notify/subscribers",
          { method: "GET" },
          DEFAULT_TIMEOUT_MS
        );
        const data = (await readJsonBody(response)) as {
          subscribers?: Array<{ endpoint?: string } | string>;
        };
        if (Array.isArray(data.subscribers)) {
          return data.subscribers
            .map((item) => (typeof item === "string" ? item : item.endpoint))
            .filter((e): e is string => typeof e === "string" && e.trim() !== "");
        }
        return [];
      } catch {
        return [];
      }
    },
  };
}

async function request(
  hubIp: string,
  path: string,
  init?: RequestInit,
  timeoutMs?: number
): Promise<HubResponse> {
  const controller =
    typeof timeoutMs === "number" && typeof AbortController !== "undefined"
      ? new AbortController()
      : undefined;
  const timer =
    controller && typeof timeoutMs === "number"
      ? setTimeout(() => controller.abort(), timeoutMs)
      : undefined;

  try {
    const response = (await fetch(`http://${hubIp}${path}`, {
      ...init,
      signal: controller?.signal,
    })) as HubResponse;
    if (!response.ok && !isTogglePath(path)) {
      throw new HubApiNetworkError(
        `Hub request failed with status ${response.status}`
      );
    }
    return response;
  } catch (error) {
    if (error instanceof HubApiToggleError || error instanceof HubApiNetworkError) {
      throw error;
    }
    throw new HubApiNetworkError();
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

async function readJsonBody(response: HubResponse): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new HubApiInvalidResponseError();
  }
}

async function readBody(response: HubResponse): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  const isJson =
    contentType.includes("application/json") || contentType.includes("+json");

  try {
    return isJson ? await response.json() : await response.text();
  } catch {
    throw new HubApiInvalidResponseError();
  }
}

function isTogglePath(path: string): boolean {
  return path.startsWith("/api/relay/toggle");
}
