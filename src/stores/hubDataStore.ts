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
} from "../services/hubDataService";
import { buildHubSensorDevices } from "../features/sensors/buildHubSensorDevices";
import { useHubConfigStore } from "./hubConfigStore";
import { getNotifyApiClient } from "../services/notifyApi/backend";
import { getHubNotifyTopicFromHash } from "../services/notifyApi/topic";
import { parseAlarmFromNotifyMessage } from "../services/hubApi/alarmsParser";

interface HubDataState {
  readonly config: HubConfig | null;
  readonly actual: SensorData | null;
  readonly relays: readonly RelayState[];
  readonly alarms: readonly Alarm[];
  readonly devices: readonly Device[];
  readonly loading: boolean;
  readonly error: string | null;
}

interface HubDataActions {
  readonly loadHubData: (target: string, mode?: ConnectionMode) => Promise<void>;
  readonly addAlarm: (alarm: Alarm) => void;
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

    addAlarm: (newAlarm: Alarm) => {
      set((state) => {
        const existingIds = new Set(state.alarms.map((a) => a.id));
        if (existingIds.has(newAlarm.id)) {
          return state;
        }
        return {
          alarms: [newAlarm, ...state.alarms],
        };
      });
    },

    loadHubData: async (target: string, mode: ConnectionMode = "directo") => {
      set({ loading: true, error: null });
      try {
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

        let alarms: Alarm[] = [];
        if (mode === "online") {
          try {
            const topic = getHubNotifyTopicFromHash(config.hash ?? target);
            const messages = await getNotifyApiClient().pollMessages(topic);
            const parsed = messages
              .map(parseAlarmFromNotifyMessage)
              .filter((a): a is Alarm => a !== undefined);
            
            // Combinar con alarmas que ya llegaron por push en vivo
            const currentAlarms = get().alarms;
            const knownIds = new Set(parsed.map((a) => a.id));
            const livePushAlarms = currentAlarms.filter((a) => !knownIds.has(a.id));
            alarms = [...livePushAlarms, ...parsed].sort(
              (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
          } catch {
            alarms = [...get().alarms];
          }
        } else {
          alarms = [...(await getAlarms(target, mode))];
        }

        const devices = buildDevices(config, relays);
        set({ config, actual, relays, alarms, devices, loading: false });
      } catch (e: unknown) {
        const detail = e instanceof Error && e.message ? ` (${e.message})` : "";
        set({
          error: `No se pudieron cargar los datos del hub${detail}`,
          loading: false,
        });
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
      }),
  })
);
