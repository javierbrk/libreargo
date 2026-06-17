import type { Recommendation } from "../../types";
import {
  deviceTagForHash,
  escapeInfluxTag,
  queryInflux,
} from "../influxApi/influxApi";
import type { RecommendationsApiClient } from "./RecommendationsApiClient";
import { mapInfluxRecommendations } from "./influxAdapters";

const DEFAULT_WINDOW = "30d";

function whereDevice(hash: string): string {
  return `device='${escapeInfluxTag(deviceTagForHash(hash))}'`;
}

export function createInfluxRecommendationsApiClient(): RecommendationsApiClient {
  return {
    async getLatest(
      limit: number,
      hubHash?: string
    ): Promise<readonly Recommendation[]> {
      if (!hubHash) {
        return [];
      }

      const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
      const series = await queryInflux(
        `SELECT * FROM "recomendaciones" WHERE ${whereDevice(hubHash)} ` +
          `AND time > now()-${DEFAULT_WINDOW} ORDER BY time DESC LIMIT ${safeLimit}`
      );
      return mapInfluxRecommendations(series).slice(0, safeLimit);
    },

    async submitQuery(): Promise<void> {
      // InfluxDB es solo lectura desde la app. El firmware/backend externo
      // publica recomendaciones; la consulta manual queda deshabilitada aquí.
    },
  };
}
