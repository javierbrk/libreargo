import type {
  HubConfig,
  SensorData,
  RelayState,
  Alarm,
  Recommendation,
} from "../types";
import { getHubApiClient } from "./hubApi/backend";
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

export async function getConfig(hubIp: string): Promise<HubConfig> {
  return getHubApiClient().getConfig(hubIp);
}

export async function getActual(hubIp: string): Promise<SensorData> {
  return getHubApiClient().getActual(hubIp);
}

export async function getRelays(
  hubIp: string
): Promise<readonly RelayState[]> {
  return getHubApiClient().getRelays(hubIp);
}

export async function getAlarms(hubIp: string): Promise<readonly Alarm[]> {
  return getHubApiClient().getAlarms(hubIp);
}

export async function toggleRelay(
  hubIp: string,
  addr: number,
  ch: number
): Promise<string> {
  return getHubApiClient().toggleRelay(hubIp, addr, ch);
}

export async function getRecommendations(
  limit: number = DEFAULT_RECOMMENDATIONS_LIMIT
): Promise<readonly Recommendation[]> {
  return getRecommendationsApiClient().getLatest(limit);
}

/**
 * Encola una query asíncrona al backend (POST /messages).
 * La respuesta aparecerá luego en getRecommendations().
 */
export async function submitRecommendationQuery(text: string): Promise<void> {
  return getRecommendationsApiClient().submitQuery(text);
}

/** Ping al hub para verificar conectividad real (GET /actual con timeout). */
export async function pingHub(hubIp: string): Promise<boolean> {
  return getHubApiClient().pingHub(hubIp);
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
