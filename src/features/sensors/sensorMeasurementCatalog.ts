import type { AlarmDataType, SensorConfig, SensorData, SensorReading } from "../../types";

export type MeasurementKey = "temperature" | "humidity" | "co2" | "pressure";
export interface SensorMeasurementDefinition {
  readonly key: MeasurementKey;
  readonly label: string;
  readonly isPrimaryVisual?: true;
}

type ActualMeasurementKey = keyof Pick<
  SensorData,
  "a_temperature" | "a_humidity" | "a_co2" | "a_pressure"
>;

const SENSOR_SUBTYPE_CATALOG: Record<
  string,
  { readonly measurements: readonly SensorMeasurementDefinition[] }
> = {
  scd30: {
    measurements: [
      { key: "temperature", label: "Temperatura", isPrimaryVisual: true },
      { key: "humidity", label: "Humedad" },
      { key: "co2", label: "CO2" },
    ],
  },
  bme280: {
    measurements: [
      { key: "temperature", label: "Temperatura" },
      { key: "humidity", label: "Humedad", isPrimaryVisual: true },
      { key: "pressure", label: "Presión" },
    ],
  },
  capacitive: {
    measurements: [{ key: "humidity", label: "Humedad", isPrimaryVisual: true }],
  },
  onewire: {
    measurements: [{ key: "temperature", label: "Temperatura", isPrimaryVisual: true }],
  },
  modbus_th: {
    measurements: [
      { key: "temperature", label: "Temperatura", isPrimaryVisual: true },
      { key: "humidity", label: "Humedad" },
    ],
  },
  modbus_soil_7in1: {
    measurements: [
      { key: "temperature", label: "Temperatura", isPrimaryVisual: true },
      { key: "humidity", label: "Humedad" },
    ],
  },
  hd38: {
    measurements: [{ key: "humidity", label: "Humedad", isPrimaryVisual: true }],
  },
  internal_temp: {
    measurements: [{ key: "temperature", label: "Temperatura", isPrimaryVisual: true }],
  },
};

export const LABEL_MAP: Record<MeasurementKey, string> = {
  temperature: "Temperatura",
  humidity: "Humedad",
  co2: "CO2",
  pressure: "Presión",
};

export const UNIT_MAP: Record<MeasurementKey, string> = {
  temperature: "°C",
  humidity: "%",
  co2: "ppm",
  pressure: "hPa",
};

export const ACTUAL_KEY_MAP: Record<MeasurementKey, ActualMeasurementKey> = {
  temperature: "a_temperature",
  humidity: "a_humidity",
  co2: "a_co2",
  pressure: "a_pressure",
};

export const READING_KEY_MAP: Record<MeasurementKey, keyof SensorReading> = {
  temperature: "temperature",
  humidity: "humidity",
  co2: "co2",
  pressure: "pressure",
};

export function getSensorMeasurements(
  subtype: string
): readonly SensorMeasurementDefinition[] | null {
  return SENSOR_SUBTYPE_CATALOG[subtype]?.measurements ?? null;
}

export function getPrimaryVisualMeasurement(
  subtype: string
): SensorMeasurementDefinition | null {
  return (
    getSensorMeasurements(subtype)?.find((measurement) => measurement.isPrimaryVisual) ??
    null
  );
}

function isMeasurementKey(value: unknown): value is MeasurementKey {
  return (
    value === "temperature" ||
    value === "humidity" ||
    value === "co2" ||
    value === "pressure"
  );
}

export function resolveVisibleSensorMeasurement(
  sensor: SensorConfig
): AlarmDataType | null {
  if (isMeasurementKey(sensor.config.measurementKey)) {
    return sensor.config.measurementKey;
  }

  return getPrimaryVisualMeasurement(sensor.type)?.key ?? null;
}
