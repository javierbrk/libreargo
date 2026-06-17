import type { Alarm, HubConfig, RelayState, SensorData } from "../../types";
import type { HubApiClient } from "./HubApiClient";
import { HubApiToggleError } from "./errors";
import {
  deviceTagForHash,
  escapeInfluxTag,
  queryInflux,
} from "../influxApi/influxApi";
import {
  mapInfluxActual,
  mapInfluxHistory,
  mapInfluxRelays,
  type HistoryPoint,
} from "./influxAdapters";

/**
 * Cliente del hub en modo **Online**: lee la telemetría publicada por el hub
 * en InfluxDB (measurement `medicionesCO2`, tag `device='moni-<hash>'`) en vez
 * de pegarle al hub. Solo lectura.
 *
 * `getConfig` NO sale de InfluxDB (allí no hay config): en Online se reusa la
 * `HubConfig` persistida al dar de alta en Directo. El store inyecta esa config
 * y nunca llama a este `getConfig` (queda como salvaguarda).
 */

const RECENT_WINDOW = "1h";
const SAFE_IDENTIFIER = /^[a-zA-Z0-9_]+$/;
const SAFE_DURATION = /^[0-9]+[smhdw]$/;

export interface InfluxHubExtras {
  getHistory(
    hash: string,
    field: string,
    range: string,
    bucket: string
  ): Promise<readonly HistoryPoint[]>;
}

function whereDevice(hash: string): string {
  return `device='${escapeInfluxTag(deviceTagForHash(hash))}'`;
}

export function createInfluxHubApiClient(): HubApiClient & InfluxHubExtras {
  return {
    async getConfig(): Promise<HubConfig> {
      throw new Error(
        "En modo Online la config se reusa del alta en Directo (no viene de InfluxDB)"
      );
    },

    async getActual(hash: string): Promise<SensorData> {
      const series = await queryInflux(
        `SELECT last("temp") AS temp, last("hum") AS hum, last("co2") AS co2, ` +
          `last("press") AS press, last("moisture") AS moisture, ` +
          `last("soil_hum") AS soil_hum ` +
          `FROM "medicionesCO2" WHERE ${whereDevice(hash)} AND time > now()-${RECENT_WINDOW}`
      );
      return mapInfluxActual(series);
    },

    async getRelays(hash: string): Promise<readonly RelayState[]> {
      const series = await queryInflux(
        `SELECT last("relay1") AS relay1, last("relay2") AS relay2, ` +
          `last("in1") AS in1, last("in2") AS in2 ` +
          `FROM "medicionesCO2" WHERE ${whereDevice(hash)} AND time > now()-${RECENT_WINDOW} ` +
          `GROUP BY "sensor"`
      );
      return mapInfluxRelays(series);
    },

    async toggleRelay(): Promise<string> {
      throw new HubApiToggleError(
        "El control de relés no está disponible en modo Online"
      );
    },

    async getAlarms(): Promise<readonly Alarm[]> {
      // InfluxDB no guarda los strings de /actual.errors. v1: sin alarmas en Online.
      return [];
    },

    async pingHub(hash: string): Promise<boolean> {
      try {
        const series = await queryInflux(
          `SELECT * FROM "medicionesCO2" WHERE ${whereDevice(hash)} ` +
            `AND time > now()-${RECENT_WINDOW} LIMIT 1`
        );
        return series.length > 0;
      } catch {
        return false;
      }
    },

    async getHistory(
      hash: string,
      field: string,
      range: string,
      bucket: string
    ): Promise<readonly HistoryPoint[]> {
      if (!SAFE_IDENTIFIER.test(field)) {
        throw new Error(`Campo inválido para histórico: ${field}`);
      }
      if (!SAFE_DURATION.test(range) || !SAFE_DURATION.test(bucket)) {
        throw new Error("Rango/bucket inválido para histórico");
      }
      const series = await queryInflux(
        `SELECT mean("${field}") FROM "medicionesCO2" ` +
          `WHERE ${whereDevice(hash)} AND time > now()-${range} ` +
          `GROUP BY time(${bucket}) fill(none)`
      );
      return mapInfluxHistory(series);
    },
  };
}
