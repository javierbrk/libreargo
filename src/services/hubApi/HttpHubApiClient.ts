import type { Alarm } from "../../types";
import type { HubApiClient } from "./HubApiClient";
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

export function createHttpHubApiClient(): HubApiClient {
  return {
    async getConfig(hubIp: string) {
      const response = await request(hubIp, "/config", { method: "GET" });
      return mapConfigurationResponse(await readBody(response));
    },
    async getActual(hubIp: string) {
      const response = await request(hubIp, "/actual", { method: "GET" });
      return mapSensorDataResponse(await readBody(response));
    },
    async getRelays(hubIp: string) {
      const response = await request(hubIp, "/api/relays", { method: "GET" });
      return mapRelayListResponse(await readBody(response));
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
      const sensorData = mapSensorDataResponse(await readBody(response));
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

async function readBody(response: HubResponse): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json") || contentType.includes("+json");

  try {
    return isJson ? await response.json() : await response.text();
  } catch {
    throw new HubApiInvalidResponseError();
  }
}

function isTogglePath(path: string): boolean {
  return path.startsWith("/api/relay/toggle");
}
