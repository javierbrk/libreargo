import type { RelayState, SensorData } from "../../types";
import type { InfluxSeries, InfluxValue } from "../influxApi/influxApi";
import { seriesRows } from "../influxApi/influxApi";

/**
 * Adapters InfluxDB → tipos de la app. Funciones puras (sin red) para testear
 * el mapeo contra respuestas reales de `medicionesCO2`.
 */

const MISSING = "--";

function asNumber(value: InfluxValue): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function fmtMeasurement(value: InfluxValue): string {
  const n = asNumber(value);
  return n === null ? MISSING : n.toFixed(2);
}

function asBool(value: InfluxValue): boolean {
  const n = asNumber(value);
  return n !== null ? n > 0 : value === true;
}

/**
 * Mapea el último `temp/hum/co2/press` (query con `last(...) AS ...`) a SensorData.
 * Campos ausentes → "--". `wifi_status` = connected si hay fila (dato reciente).
 */
export function mapInfluxActual(series: readonly InfluxSeries[]): SensorData {
  const rows = seriesRows(series[0]);
  const row = rows[0] ?? {};
  const hasData = rows.length > 0;

  return {
    a_temperature: fmtMeasurement(row.temp ?? null),
    a_humidity: fmtMeasurement(row.hum ?? row.soil_hum ?? row.moisture ?? null),
    a_co2: fmtMeasurement(row.co2 ?? null),
    a_pressure: fmtMeasurement(row.press ?? null),
    // Online (Influx) no expone lecturas por sensor individual, solo el
    // último agregado por hub: resolveSensorReading cae al legacy a_* acá.
    sensors: [],
    wifi_status: hasData ? "connected" : "disconnected",
    errors: {
      temperature: [],
      humidity: [],
      sensors: [],
      wifi: [],
      rotation: [],
    },
  };
}

function addressFromSensorTag(tag: string, index: number): number {
  const matches = tag.match(/\d+/g);
  if (matches && matches.length > 0) {
    const parsed = Number.parseInt(matches[matches.length - 1], 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return index + 1;
}

/**
 * Mapea series agrupadas por `sensor` (GROUP BY "sensor") a RelayState[].
 * Solo se consideran relays las series cuyo `relay1` no es null.
 */
export function mapInfluxRelays(
  series: readonly InfluxSeries[]
): readonly RelayState[] {
  const relays: RelayState[] = [];

  series.forEach((serie, index) => {
    const row = seriesRows(serie)[0];
    if (!row) {
      return;
    }
    const relay1 = row.relay1 ?? null;
    if (relay1 === null) {
      return; // serie de sensor, no de relé
    }

    const sensorTag = serie.tags?.sensor ?? `relay_${index + 1}`;
    const hasSecondChannel = (row.relay2 ?? null) !== null;

    relays.push({
      type: hasSecondChannel ? "relay_2ch" : "gpio",
      address: addressFromSensorTag(sensorTag, index),
      alias: sensorTag.replace(/_/g, " "),
      active: true,
      state: [asBool(relay1), asBool(row.relay2 ?? null)],
      input_state: [asBool(row.in1 ?? null), asBool(row.in2 ?? null)],
    });
  });

  return relays;
}

export interface HistoryPoint {
  /** epoch en segundos. */
  readonly t: number;
  readonly v: number;
}

/**
 * Mapea una serie `SELECT mean("<field>") ... GROUP BY time(...)` a puntos {t,v}.
 * Descarta buckets sin dato (fill(none) → null).
 */
export function mapInfluxHistory(
  series: readonly InfluxSeries[]
): readonly HistoryPoint[] {
  const serie = series[0];
  if (!serie) {
    return [];
  }
  const timeIdx = serie.columns.indexOf("time");
  const valueIdx = serie.columns.findIndex((c) => c !== "time");
  if (timeIdx < 0 || valueIdx < 0) {
    return [];
  }
  const points: HistoryPoint[] = [];
  for (const row of serie.values) {
    const t = asNumber(row[timeIdx]);
    const v = asNumber(row[valueIdx]);
    if (t !== null && v !== null) {
      points.push({ t, v });
    }
  }
  return points;
}
