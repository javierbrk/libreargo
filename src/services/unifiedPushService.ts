/**
 * Servicio UnifiedPush para LibreAgro.
 *
 * Gestiona el registro de hubs como instancias UnifiedPush usando
 * expo-unified-push (el Distribuidor es la app ntfy instalada en el dispositivo).
 *
 * Responsabilidades:
 * - Verificar que ntfy está disponible como Distribuidor.
 * - Registrar cada hub como una instancia separada (instance = topic ntfy) con VAPID válido.
 * - Suscribir callbacks para cuando llegan mensajes mientras la app está abierta.
 * - Almacenar las URLs de endpoint de UnifiedPush generadas por el distribuidor.
 * - Detectar cambios en las URLs de endpoint para sincronizar con el ESP en modo Directo.
 * - Exponer herramientas de prueba end-to-end.
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

/** VAPID Public Key para suscripciones WebPush / UnifiedPush. */
export const LIBREAGRO_VAPID_PUBLIC_KEY =
  "BKuOL1EnGg0iPE9Ma_Whv-Q2qgRr4a1VqUL1vzCFAdd6XVDjHnE0UCExQBKA-LWxr0F3hiOJz7tVWASWRr9YnP0";

export interface EndpointRecord {
  currentUrl: string;
  previousUrl: string | null;
  hasChanged: boolean;
  syncedWithHub: boolean;
}

/** Mapa de instancias (topic ntfy) -> Registro de endpoint */
const endpointRegistry = new Map<string, EndpointRecord>();
type EndpointChangeCallback = (instance: string, record: EndpointRecord) => void;
const endpointListeners = new Set<EndpointChangeCallback>();

export function getRegisteredEndpoint(instance: string): string | undefined {
  return endpointRegistry.get(instance)?.currentUrl;
}

export function getEndpointInfo(instance: string): EndpointRecord | undefined {
  return endpointRegistry.get(instance);
}

export function markEndpointSynced(instance: string): void {
  const existing = endpointRegistry.get(instance);
  if (existing) {
    existing.hasChanged = false;
    existing.syncedWithHub = true;
  }
}

export function onEndpointChange(cb: EndpointChangeCallback): () => void {
  endpointListeners.add(cb);
  return () => {
    endpointListeners.delete(cb);
  };
}

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

  ExpoUnifiedPush.saveDistributor(NTFY_DISTRIBUTOR_PACKAGE);

  for (const hub of hubs) {
    const topic = getHubNotifyTopic(hub);
    try {
      await ExpoUnifiedPush.registerDevice(LIBREAGRO_VAPID_PUBLIC_KEY, topic);
    } catch {
      // Best effort
    }
  }

  return true;
}

export type MessageCallback = (instance: string, rawMessage: string) => void;

/**
 * Suscribe callbacks para eventos del distribuidor.
 * Registra endpoints recibidos y notifica si el endpoint cambió.
 */
export function subscribeToMessages(onMessage: MessageCallback): () => void {
  if (!subscribeDistributorMessages) {
    return () => {};
  }

  const unsub = subscribeDistributorMessages((callbackData: CallbackData) => {
    if (callbackData.action === "registered" && callbackData.data) {
      const { url, instance } = callbackData.data;
      if (url && instance) {
        const prev = endpointRegistry.get(instance);
        const previousUrl = prev ? prev.currentUrl : null;
        const hasChanged = previousUrl !== null && previousUrl !== url;

        const record: EndpointRecord = {
          currentUrl: url,
          previousUrl,
          hasChanged,
          syncedWithHub: !hasChanged && (prev?.syncedWithHub ?? false),
        };

        endpointRegistry.set(instance, record);
        endpointListeners.forEach((listener) => listener(instance, record));
      }
    }

    if (callbackData.action === "message" && callbackData.data) {
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

export interface TestPushResult {
  readonly ok: boolean;
  readonly targetUrl: string;
  readonly isUnifiedPushEndpoint: boolean;
}

/**
 * Publica una alarma de prueba al topic o endpoint de ntfy.
 */
export async function sendTestPushNotification(
  topic: string,
  messageText = "[T] temperature too high: 39.5 (Prueba Push LibreAgro)"
): Promise<TestPushResult> {
  try {
    const endpointUrl = getRegisteredEndpoint(topic);
    const isUnifiedPushEndpoint = Boolean(endpointUrl);
    const url = endpointUrl
      ? endpointUrl
      : `${getBaseUrl().replace(/\/+$/, "")}/${encodeURIComponent(topic)}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Title": "⚠️ Prueba de Alarma LibreAgro",
        "Priority": "high",
        "Tags": "warning",
      },
      body: messageText,
    });

    return {
      ok: response.ok,
      targetUrl: url,
      isUnifiedPushEndpoint,
    };
  } catch {
    return {
      ok: false,
      targetUrl: "",
      isUnifiedPushEndpoint: false,
    };
  }
}

/** Publica directamente al topic del hub (ntfy.sh/moni-XXXX). */
export async function sendTestTopicNotification(
  topic: string,
  messageText = "[T] temperature too high: 39.5 (Prueba Topic Hub)"
): Promise<boolean> {
  try {
    const url = `${getBaseUrl().replace(/\/+$/, "")}/${encodeURIComponent(topic)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Title": "⚠️ Prueba Topic Hub",
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
 * Abre el selector de distribuidor del sistema.
 */
export function openDistributorSelector(): void {
  if (Platform.OS !== "android" || !ExpoUnifiedPush) {
    return;
  }
  ExpoUnifiedPush.saveDistributor(null);
}
