import { mockActual, mockActualWithErrors } from "../../mocks/actual";
import { mockAlarms } from "../../mocks/alarms";
import { mockConfig } from "../../mocks/config";
import { mockRelays } from "../../mocks/relays";
import type { Alarm, HubConfig, RelayState, SensorData } from "../../types";
import type { HubApiClient, RegisterEndpointResult } from "./HubApiClient";
import { parseAlarmsFromSensorData } from "./alarmsParser";

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const cloneMockConfig = (): HubConfig => ({
  ...mockConfig,
  sensors: mockConfig.sensors.map((sensor) => ({
    ...sensor,
    config: { ...sensor.config },
    zones: sensor.zones ? [...sensor.zones] : undefined,
  })),
  relays: mockConfig.relays.map((relay) => ({
    ...relay,
    config: { ...relay.config },
  })),
});

const cloneMockActual = (): SensorData => ({
  ...mockActual,
  errors: {
    temperature: [...mockActual.errors.temperature],
    humidity: [...mockActual.errors.humidity],
    sensors: [...mockActual.errors.sensors],
    wifi: [...mockActual.errors.wifi],
    rotation: [...mockActual.errors.rotation],
  },
});

const cloneMockRelays = (): readonly RelayState[] =>
  mockRelays.map((relay) => ({
    ...relay,
    state: [relay.state[0], relay.state[1]] as const,
    input_state: [relay.input_state[0], relay.input_state[1]] as const,
    zones: relay.zones ? [...relay.zones] : undefined,
  }));

export function createMockHubApiClient(): HubApiClient {
  return {
    async getConfig() {
      await delay(120);
      return cloneMockConfig();
    },
    async getActual() {
      await delay(120);
      return cloneMockActual();
    },
    async getRelays() {
      await delay(120);
      return cloneMockRelays();
    },
    async toggleRelay() {
      await delay(80);
      return "OK";
    },
    async getAlarms(): Promise<readonly Alarm[]> {
      await delay(120);
      // El contrato real: las alarmas se derivan de /actual.errors.
      // Usamos el mock con errores para reflejar ese flujo end-to-end.
      const parsed = parseAlarmsFromSensorData(mockActualWithErrors);
      if (parsed.length > 0) {
        return parsed;
      }
      // Fallback a alarmas seed para demos cuando no hay errores en actual.
      return mockAlarms.map((alarm) => ({
        ...alarm,
        zones: [...alarm.zones],
      }));
    },
    async pingHub(): Promise<boolean> {
      await delay(80);
      return true;
    },
    async registerPushEndpoint(
      hubIp: string,
      endpointUrl: string,
      instance: string
    ): Promise<RegisterEndpointResult> {
      await delay(80);
      mockSubscribers.add(endpointUrl);
      const fullUrl = `http://${hubIp}/api/notify/subscribe`;
      const requestBody = JSON.stringify({ endpoint: endpointUrl, instance });
      return {
        ok: true,
        url: fullUrl,
        requestBody,
        status: 200,
        responseText: JSON.stringify({ status: "ok", total_subscribers: mockSubscribers.size }),
      };
    },
    async getSubscribers(): Promise<readonly string[]> {
      await delay(80);
      return Array.from(mockSubscribers);
    },
  };
}

const mockSubscribers = new Set<string>();
