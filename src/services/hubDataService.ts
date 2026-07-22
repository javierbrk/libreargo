import type {
  ConnectionMode,
  HubConfig,
  SensorData,
  RelayState,
  Alarm,
  Recommendation,
  Hub,
} from "../types";
import { getHubApiClient } from "./hubApi/backend";
import type { RegisterEndpointResult } from "./hubApi/HubApiClient";
import type { InfluxHubExtras } from "./hubApi/InfluxHubApiClient";
import type { HistoryPoint } from "./hubApi/influxAdapters";
import { getRecommendationsApiClient } from "./recommendationsApi/backend";
import { getRegisteredEndpoint, markEndpointSynced } from "./unifiedPushService";
import { getHubNotifyTopic } from "./notifyApi/topic";
import { resolveHubTarget } from "./connectivity";
import { DIRECT_MODE_IP } from "../constants";
export {
  InvalidHubConfigError,
  validateHubConfig,
} from "./hubApi/validation";

/**
 * Servicio de datos del hub.
 * Delega cada llamada a la implementación seleccionada del backend
 * (mock | http). Las pantallas y stores no conocen el transporte.
 */

const DEFAULT_RECOMMENDATIONS_LIMIT = 3;

export async function getConfig(
  hubIp: string,
  mode: ConnectionMode = "directo"
): Promise<HubConfig> {
  return getHubApiClient(mode).getConfig(hubIp);
}

export async function getActual(
  hubIp: string,
  mode: ConnectionMode = "directo"
): Promise<SensorData> {
  return getHubApiClient(mode).getActual(hubIp);
}

export async function getRelays(
  hubIp: string,
  mode: ConnectionMode = "directo"
): Promise<readonly RelayState[]> {
  return getHubApiClient(mode).getRelays(hubIp);
}

export async function getAlarms(
  hubIp: string,
  mode: ConnectionMode = "directo"
): Promise<readonly Alarm[]> {
  return getHubApiClient(mode).getAlarms(hubIp);
}

export async function toggleRelay(
  hubIp: string,
  addr: number,
  ch: number,
  mode: ConnectionMode = "directo"
): Promise<string> {
  return getHubApiClient(mode).toggleRelay(hubIp, addr, ch);
}

export async function getRecommendations(
  limit: number = DEFAULT_RECOMMENDATIONS_LIMIT,
  hubHash?: string
): Promise<readonly Recommendation[]> {
  return getRecommendationsApiClient().getLatest(limit, hubHash);
}

/**
 * Encola una query asíncrona al backend (POST /messages).
 * La respuesta aparecerá luego en getRecommendations().
 */
export async function submitRecommendationQuery(text: string): Promise<void> {
  return getRecommendationsApiClient().submitQuery(text);
}

/** Ping al hub para verificar conectividad real (GET /actual con timeout). */
export async function pingHub(
  hubIp: string,
  mode: ConnectionMode = "directo"
): Promise<boolean> {
  return getHubApiClient(mode).pingHub(hubIp);
}

export async function registerPushEndpointWithHub(
  hubIp: string,
  endpointUrl: string,
  instance: string,
  mode: ConnectionMode = "directo"
): Promise<RegisterEndpointResult> {
  const client = getHubApiClient(mode);
  if (client.registerPushEndpoint) {
    return client.registerPushEndpoint(hubIp, endpointUrl, instance);
  }
  return {
    ok: false,
    url: `http://${hubIp}/api/notify/subscribe`,
    requestBody: JSON.stringify({ endpoint: endpointUrl, instance }),
    responseText: "Cliente no soporta registerPushEndpoint",
  };
}

export async function getSubscribersFromHub(
  hubIp: string,
  mode: ConnectionMode = "directo"
): Promise<readonly string[]> {
  const client = getHubApiClient(mode);
  if (client.getSubscribers) {
    return client.getSubscribers(hubIp);
  }
  return [];
}

/**
 * Proceso 100% automático: cuando se establece conexión Directa con un hub y la app
 * cuenta con un endpoint UP (otorgado por ntfy), verifica si el endpoint está en la lista del ESP32.
 * Si no está en la lista, se suscribe automáticamente enviando POST /api/notify/subscribe.
 */
export async function autoSyncPushEndpointWithHub(
  hub: Hub,
  mode: ConnectionMode = "directo"
): Promise<boolean> {
  if (mode !== "directo") {
    return false;
  }

  const topic = getHubNotifyTopic(hub);
  const endpoint = getRegisteredEndpoint(topic);
  if (!endpoint) {
    return false;
  }

  const targetIp = resolveHubTarget("directo", hub);
  const ipsToTry = Array.from(
    new Set([targetIp, hub.ip, DIRECT_MODE_IP].filter((ip): ip is string => Boolean(ip && ip.trim())))
  );

  for (const ip of ipsToTry) {
    try {
      const subscribers = await getSubscribersFromHub(ip, "directo");
      const isSubscribed = subscribers.includes(endpoint);

      if (!isSubscribed) {
        const result = await registerPushEndpointWithHub(ip, endpoint, topic, "directo");
        if (result.ok) {
          markEndpointSynced(topic);
          return true;
        }
      } else {
        markEndpointSynced(topic);
        return true;
      }
    } catch {
      // Intentar con la siguiente IP si falla la conexión a una IP secundaria
    }
  }

  return false;
}


export async function getSensorHistory(
  hubHash: string,
  field: string,
  range: string,
  bucket: string,
  sensorId?: string
): Promise<readonly HistoryPoint[]> {
  const client = getHubApiClient("online") as Partial<InfluxHubExtras>;
  if (!client.getHistory) {
    return [];
  }
  return client.getHistory(hubHash, field, range, bucket, sensorId);
}
