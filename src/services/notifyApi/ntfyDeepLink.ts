import { Linking } from "react-native";
import type { Hub } from "../../types";
import { getBaseUrl } from "./backend";
import { getHubNotifyTopic } from "./topic";

export interface NtfyHostInfo {
  readonly host: string;
  readonly secure: boolean;
}

const PROTOCOL_REGEX = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/([^/?#]+)/;

/**
 * Separa protocolo/host de una base URL tipo "https://ntfy.sh" o
 * "http://192.168.1.5:8080". Sin protocolo explícito, asume https (mismo
 * default que getBaseUrl()).
 */
export function parseNtfyHost(baseUrl: string): NtfyHostInfo {
  const trimmed = baseUrl.trim();
  const match = PROTOCOL_REGEX.exec(trimmed);
  if (!match) {
    return { host: trimmed.replace(/\/+$/, ""), secure: true };
  }
  const [, protocol, host] = match;
  return { host, secure: protocol.toLowerCase() !== "http" };
}

/**
 * Arma la URL `ntfy://<host>/<topic>` que la app ntfy Android interpreta
 * como "suscribime a este topic si no lo estoy ya" (docs.ntfy.sh/subscribe/phone/).
 */
export function buildNtfySubscribeUrl(
  baseUrl: string,
  topic: string,
  displayName?: string
): string {
  const { host, secure } = parseNtfyHost(baseUrl);
  const params: string[] = [];
  const trimmedDisplay = displayName?.trim();
  if (trimmedDisplay) {
    params.push(`display=${encodeURIComponent(trimmedDisplay)}`);
  }
  if (!secure) {
    params.push("secure=false");
  }
  const query = params.length > 0 ? `?${params.join("&")}` : "";
  return `ntfy://${host}/${encodeURIComponent(topic)}${query}`;
}

/** URL de suscripción para un hub puntual, usando el backend/topic configurados. */
export function buildNtfySubscribeUrlForHub(hub: Hub): string {
  const topic = getHubNotifyTopic(hub);
  const trimmedName = hub.name.trim();
  const displayName = trimmedName === topic ? undefined : trimmedName;
  return buildNtfySubscribeUrl(getBaseUrl(), topic, displayName);
}

/**
 * Intenta abrir una URL. No lanza: si no hay app que resuelva el intent
 * (ej. ntfy no instalado), la promesa de Linking.openURL rechaza y acá se
 * traduce a `false` para que la UI decida qué mostrar.
 */
export async function tryOpenUrl(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/** Arma la URL de suscripción del hub y la intenta abrir en la app ntfy. */
export async function openNtfySubscriptionForHub(hub: Hub): Promise<boolean> {
  return tryOpenUrl(buildNtfySubscribeUrlForHub(hub));
}
