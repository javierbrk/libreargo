import type { Recommendation } from "../../types";
import type { InfluxSeries, InfluxValue } from "../influxApi/influxApi";
import { seriesRows } from "../influxApi/influxApi";

function asString(value: InfluxValue): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function asEpochSeconds(value: InfluxValue): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function toIso(value: InfluxValue): string | undefined {
  const epoch = asEpochSeconds(value);
  if (epoch !== undefined) {
    return new Date(epoch * 1000).toISOString();
  }
  const text = asString(value);
  if (!text) {
    return undefined;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

export function mapInfluxRecommendations(
  series: readonly InfluxSeries[]
): readonly Recommendation[] {
  const rows = seriesRows(series[0]);
  return rows.flatMap((row, index) => {
    const content = asString(row.texto);
    const date = toIso(row.time);
    if (!content || !date) {
      return [];
    }

    const tipo = asString(row.tipo);
    const prioridad = asString(row.prioridad);
    const title = [tipo, prioridad ? `prioridad ${prioridad}` : undefined]
      .filter(Boolean)
      .join(" · ");

    return {
      id: `influx-rec-${row.time ?? index}`,
      title: title || "Recomendación",
      content,
      date,
    };
  });
}
