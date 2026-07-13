import type {
  ConnectionMode,
  HubConfig,
  SensorData,
  RelayState,
  Alarm,
  Recommendation,
} from "../types";
import { getHubApiClient } from "./hubApi/backend";
import type { InfluxHubExtras } from "./hubApi/InfluxHubApiClient";
import type { HistoryPoint } from "./hubApi/influxAdapters";
import { getNotifyApiClient } from "./notifyApi/backend";
import type { NotifyMessage } from "./notifyApi/NotifyApiClient";
import { getRecommendationsApiClient } from "./recommendationsApi/backend";
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

/**
 * Poll de notificaciones push del hub vía ntfy.sh.
 * El `topic` se construye a partir del `incubator_name` del hub (ej. `moni-XXXXXXXX`).
 * `since` permite paginación incremental por timestamp/id del último mensaje visto.
 */
export async function pollHubNotifications(
  topic: string,
  since?: string
): Promise<readonly NotifyMessage[]> {
  return getNotifyApiClient().pollMessages(topic, since);
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
