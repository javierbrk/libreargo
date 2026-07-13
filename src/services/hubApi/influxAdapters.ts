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

// Campo Influx → key_var del firmware (core/SensorKey.h): TEMPERATURE=0,
// HUMIDITY=1, CO2=2, MOISTURE=3, PRESSURE=4. `soil_hum` es un alias histórico
// de humedad de suelo.
const FIELD_TO_KEY_VAR: Readonly<Record<string, number>> = {
  temp: 0,
  hum: 1,
  co2: 2,
  moisture: 3,
  soil_hum: 3,
  press: 4,
};

// El tag `sensor` de Influx es el getSensorID() del firmware. Para los
// sensores sin pin/dirección en config (singletons), el prefijo del id
// permite recuperar el getSensorType() que usa resolveSensorReading.
function sensorTypeFromTag(tag: string): string {
  if (tag.startsWith("thc-i2c")) return "SCD30";
  if (tag.startsWith("thp-i2c")) return "BME280";
  if (tag.startsWith("t-1w")) return "OneWire";
  return "";
}

/**
 * Mapea el `last(...)` de cada campo a SensorData. Acepta dos formas:
 * - series agrupadas por sensor (`GROUP BY "sensor"`): llena `sensors[]` con
 *   la lectura individual de cada uno (mismo contrato que /actual del hub,
 *   así resolveSensorReading funciona igual en Online que en Directo);
 * - una única serie agregada (forma legacy): solo campos a_*.
 * Campos ausentes → "--". `wifi_status` = connected si hay dato reciente.
 */
export function mapInfluxActual(series: readonly InfluxSeries[]): SensorData {
  const sensors: {
    id: string;
    type: string;
    readings: { value: string; key_var?: number }[];
  }[] = [];
  const legacy: Record<string, InfluxValue> = {};

  for (const serie of series) {
    const row = seriesRows(serie)[0];
    if (!row) {
      continue;
    }

    // Primer valor no-null de cada campo entre todas las series → a_* legacy.
    for (const field of Object.keys(FIELD_TO_KEY_VAR)) {
      if (legacy[field] === undefined && asNumber(row[field] ?? null) !== null) {
        legacy[field] = row[field];
      }
    }

    const tag = serie.tags?.sensor;
    if (!tag) {
      continue;
    }
    const readings = Object.entries(FIELD_TO_KEY_VAR).flatMap(
      ([field, keyVar]) => {
        const value = asNumber(row[field] ?? null);
        return value === null ? [] : [{ value: String(value), key_var: keyVar }];
      }
    );
    if (readings.length > 0) {
      sensors.push({ id: tag, type: sensorTypeFromTag(tag), readings });
    }
  }

  const hasData = series.some((serie) => seriesRows(serie).length > 0);

  return {
    a_temperature: fmtMeasurement(legacy.temp ?? null),
    a_humidity: fmtMeasurement(
      legacy.hum ?? legacy.soil_hum ?? legacy.moisture ?? null
    ),
    a_co2: fmtMeasurement(legacy.co2 ?? null),
    a_pressure: fmtMeasurement(legacy.press ?? null),
    sensors,
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
