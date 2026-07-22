/**
 * Servicio UnifiedPush para LibreAgro.
 *
 * Gestiona el registro de hubs como instancias UnifiedPush usando
 * expo-unified-push (el Distribuidor es la app ntfy instalada en el dispositivo).
 *
 * Responsabilidades:
 * - Verificar que ntfy está disponible como Distribuidor.
 * - Registrar cada hub como una instancia separada (instance = topic ntfy).
 * - Suscribir callbacks para cuando llegan mensajes mientras la app está abierta.
 * - Exponer herramientas de prueba end-to-end.
 *
 * La notificación nativa cuando la app está CERRADA la construye el
 * NtfyPushPayloadRenderer (Kotlin) sin pasar por el puente JS.
 */

import { Platform } from "react-native";
import { getHubNotifyTopic } from "./notifyApi/topic";
import { getBaseUrl } from "./notifyApi/backend";
import type { Hub } from "../types";
import type {
  CallbackData,
  Distributor,
} from "expo-unified-push/build/ExpoUnifiedPush.types";

type ExpoUnifiedPushModule = {
  getDistributors: () => Distributor[];
  getSavedDistributor: () => string | null;
  saveDistributor: (distributor: string | null) => void;
  registerDevice: (vapid: string, instance?: string) => Promise<void>;
};

type SubscribeFn = (fn: (data: CallbackData) => void) => () => void;

let ExpoUnifiedPush: ExpoUnifiedPushModule | null = null;
let subscribeDistributorMessages: SubscribeFn | null = null;

if (Platform.OS === "android") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ExpoUnifiedPush = require("expo-unified-push").default as ExpoUnifiedPushModule;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    subscribeDistributorMessages = require(
      "expo-unified-push/build/ExpoUnifiedPushModule"
    ).subscribeDistributorMessages as SubscribeFn;
  } catch {
    ExpoUnifiedPush = null;
    subscribeDistributorMessages = null;
  }
}

/** Package name del Distribuidor ntfy (app oficial de ntfy.sh). */
export const NTFY_DISTRIBUTOR_PACKAGE = "io.heckel.ntfy";

/** Placeholder VAPID (ntfy lo ignora pero la API de UP lo requiere). */
const NTFY_VAPID_PLACEHOLDER = "";

export type UnifiedPushStatus =
  | "not_android"       // plataforma no soportada
  | "ntfy_missing"      // ntfy no está instalado
  | "ntfy_ready"        // ntfy está disponible y registrado
  | "no_distributor";   // no hay ningún Distribuidor configurado

/**
 * Verifica si ntfy está disponible como Distribuidor UnifiedPush.
 */
export function checkUnifiedPushStatus(): UnifiedPushStatus {
  if (Platform.OS !== "android" || !ExpoUnifiedPush) {
    return "not_android";
  }

  const distributors = ExpoUnifiedPush.getDistributors();
  const hasNtfy = distributors.some(
    (d: Distributor) => d.id === NTFY_DISTRIBUTOR_PACKAGE
  );

  if (!hasNtfy) {
    return "ntfy_missing";
  }

  const saved = ExpoUnifiedPush.getSavedDistributor();
  if (saved === NTFY_DISTRIBUTOR_PACKAGE || saved == null) {
    return "ntfy_ready";
  }

  return "no_distributor";
}

/**
 * Selecciona ntfy como Distribuidor y registra todos los hubs como instancias.
 *
 * @param hubs Lista de hubs configurados en la app.
 */
export async function initUnifiedPush(hubs: readonly Hub[]): Promise<boolean> {
  if (Platform.OS !== "android" || !ExpoUnifiedPush) {
    return false;
  }

  const status = checkUnifiedPushStatus();
  if (status === "ntfy_missing") {
    return false;
  }

  // Guardar ntfy como distribuidor principal
  ExpoUnifiedPush.saveDistributor(NTFY_DISTRIBUTOR_PACKAGE);

  // Registrar cada hub como una instancia UnifiedPush (topic de ntfy)
  for (const hub of hubs) {
    const topic = getHubNotifyTopic(hub);
    try {
      await ExpoUnifiedPush.registerDevice(NTFY_VAPID_PLACEHOLDER, topic);
    } catch {
      // Best effort
    }
  }

  return true;
}

export type MessageCallback = (instance: string, rawMessage: string) => void;

/**
 * Suscribe un callback que se llama cuando llega un mensaje push
 * mientras la app está ABIERTA.
 */
export function subscribeToMessages(onMessage: MessageCallback): () => void {
  if (!subscribeDistributorMessages) {
    return () => {};
  }

  const unsub = subscribeDistributorMessages((callbackData: CallbackData) => {
    if (callbackData.action === "message") {
      const { instance, message } = callbackData.data;
      const rawMessage =
        typeof message === "string"
          ? message
          : new TextDecoder().decode(message);
      onMessage(instance, rawMessage);
    }
  });

  return unsub;
}

/**
 * Publica una alarma de prueba directamente al topic de ntfy.sh vía HTTP POST.
 * Esto dispara el flujo real: ntfy.sh -> ntfy app -> UnifiedPush -> LibreAgro.
 */
export async function sendTestPushNotification(
  topic: string,
  messageText = "[T] temperature too high: 39.5 (Prueba Push LibreAgro)"
): Promise<boolean> {
  try {
    const url = `${getBaseUrl().replace(/\/+$/, "")}/${encodeURIComponent(topic)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Title": "⚠️ Prueba de Alarma LibreAgro",
        "Priority": "high",
        "Tags": "warning",
      },
      body: messageText,
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Abre el selector de distribuidor del sistema si se desea cambiar.
 */
export function openDistributorSelector(): void {
  if (Platform.OS !== "android" || !ExpoUnifiedPush) {
    return;
  }
  ExpoUnifiedPush.saveDistributor(null);
}
