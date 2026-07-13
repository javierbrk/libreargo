import { create } from "zustand";
import type {
  ConnectionMode,
  HubConfig,
  SensorData,
  RelayState,
  Alarm,
  Device,
} from "../types";
import {
  getConfig,
  getActual,
  getRelays,
  getAlarms,
  pollHubNotifications,
} from "../services/hubDataService";
import { parseAlarmFromNotifyMessage } from "../services/hubApi/alarmsParser";
import { buildHubSensorDevices } from "../features/sensors/buildHubSensorDevices";
import { useHubConfigStore } from "./hubConfigStore";

interface HubDataState {
  readonly config: HubConfig | null;
  readonly actual: SensorData | null;
  readonly relays: readonly RelayState[];
  readonly alarms: readonly Alarm[];
  readonly devices: readonly Device[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly notifySince: string | null;
}

interface HubDataActions {
  readonly loadHubData: (target: string, mode?: ConnectionMode) => Promise<void>;
  readonly pollNotifications: (topic: string) => Promise<void>;
  readonly clearData: () => void;
}

function buildDevices(
  config: HubConfig,
  relays: readonly RelayState[]
): readonly Device[] {
  const sensorDevices = buildHubSensorDevices(config);

  const relayDevices: Device[] = relays.map((r) => ({
    id: `relay-${r.address}`,
    type: "actuator" as const,
    name: r.alias,
    subtype: r.type,
    zones: r.zones ?? [],
    relayAddress: r.address,
  }));

  return [...sensorDevices, ...relayDevices];
}

export const useHubDataStore = create<HubDataState & HubDataActions>(
  (set, get) => ({
    config: null,
    actual: null,
    relays: [],
    alarms: [],
    devices: [],
    loading: false,
    error: null,
    notifySince: null,

    loadHubData: async (target: string, mode: ConnectionMode = "directo") => {
      set({ loading: true, error: null });
      try {
        // El WebServer del ESP32 (hub real) atiende UNA conexión a la vez.
        // Pedimos en serie en vez de Promise.all para no saturarlo: con
        // requests concurrentes algunas se caían. Es marginalmente más lento
        // pero robusto (y en mock no cambia nada).
        const config =
          mode === "online"
            ? useHubConfigStore.getState().getConfig(target)
            : await getConfig(target, mode);

        if (!config) {
          set({
            error:
              "Para usar Online, agregá este hub en modo Directo primero.",
            loading: false,
          });
          return;
        }

        const actual = await getActual(target, mode);
        const relays = await getRelays(target, mode);
        const alarms = mode === "online" ? [] : await getAlarms(target, mode);
        const devices = buildDevices(config, relays);
        set({ config, actual, relays, alarms, devices, loading: false });
      } catch (e: unknown) {
        // El mensaje genérico solo, sin la causa, hace imposible diagnosticar
        // en campo (¿red? ¿respuesta inválida? ¿timeout?). Los errores de la
        // capa de servicios ya traen mensajes aptos para usuario.
        const detail = e instanceof Error && e.message ? ` (${e.message})` : "";
        set({
          error: `No se pudieron cargar los datos del hub${detail}`,
          loading: false,
        });
      }
    },

    pollNotifications: async (topic: string) => {
      // Suscripción push del hub vía ntfy.sh (topic = incubator_name).
      // Complementa a las alarmas derivadas de /actual.errors. Es best-effort:
      // si falla, no debe afectar la pantalla. Mock-safe (el cliente mock
      // devuelve mensajes seed; en producción se activa con NOTIFY_BACKEND=http).
      try {
        const since = get().notifySince ?? undefined;
        const messages = await pollHubNotifications(topic, since);
        if (messages.length === 0) {
          return;
        }

        const parsed = messages
          .map(parseAlarmFromNotifyMessage)
          .filter((alarm): alarm is Alarm => alarm !== undefined);

        const maxTime = messages.reduce(
          (max, msg) => (msg.time > max ? msg.time : max),
          0
        );

        set((state) => {
          const existingIds = new Set(state.alarms.map((alarm) => alarm.id));
          // Conservamos las existentes (preserva acknowledge local) y
          // anteponemos solo las realmente nuevas.
          const fresh = parsed.filter((alarm) => !existingIds.has(alarm.id));
          return {
            alarms: fresh.length > 0 ? [...fresh, ...state.alarms] : state.alarms,
            notifySince: maxTime > 0 ? String(maxTime) : state.notifySince,
          };
        });
      } catch {
        // ntfy es complementario; ignoramos errores de red.
      }
    },

    clearData: () =>
      set({
        config: null,
        actual: null,
        relays: [],
        alarms: [],
        devices: [],
        error: null,
        notifySince: null,
      }),
  })
);
