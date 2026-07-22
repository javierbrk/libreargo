import type { Alarm, HubConfig, RelayState, SensorData } from "../../types";

export interface RegisterEndpointResult {
  readonly ok: boolean;
  readonly url: string;
  readonly requestBody: string;
  readonly status?: number;
  readonly responseText?: string;
}

export interface HubApiClient {
  getConfig(hubIp: string): Promise<HubConfig>;
  getActual(hubIp: string): Promise<SensorData>;
  getRelays(hubIp: string): Promise<readonly RelayState[]>;
  toggleRelay(hubIp: string, addr: number, ch: number): Promise<string>;
  getAlarms(hubIp: string): Promise<readonly Alarm[]>;
  pingHub(hubIp: string): Promise<boolean>;
  registerPushEndpoint?(
    hubIp: string,
    endpointUrl: string,
    instance: string
  ): Promise<RegisterEndpointResult>;
  getSubscribers?(hubIp: string): Promise<readonly string[]>;
}

export type HubDataBackend = "mock" | "http";
