import type { Alarm, HubConfig, RelayState, SensorData } from "../../types";

export interface HubApiClient {
  getConfig(hubIp: string): Promise<HubConfig>;
  getActual(hubIp: string): Promise<SensorData>;
  getRelays(hubIp: string): Promise<readonly RelayState[]>;
  toggleRelay(hubIp: string, addr: number, ch: number): Promise<string>;
  getAlarms(hubIp: string): Promise<readonly Alarm[]>;
  pingHub(hubIp: string): Promise<boolean>;
}

export type HubDataBackend = "mock" | "http";
