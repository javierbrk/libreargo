import type { Device, HubConfig, SensorData, SensorRangeVisual } from "../types";
import {
  ACTUAL_KEY_MAP,
  LABEL_MAP,
  UNIT_MAP,
} from "../features/sensors/sensorMeasurementCatalog";
import { getMeasurementRange } from "../features/sensors/getMeasurementRange";
import { resolveSensorReading } from "../features/sensors/resolveSensorReading";

export function getSensorRangeVisual(
  device: Device,
  config: HubConfig | null,
  actual: SensorData | null,
): SensorRangeVisual | null {
  if (device.type !== "sensor" || !config || !actual) {
    return null;
  }

  const measurementKey = device.sensorType;
  if (!measurementKey) {
    return null;
  }
  const range = getMeasurementRange(measurementKey, config);
  const actualKey = ACTUAL_KEY_MAP[measurementKey];
  const perSensor = resolveSensorReading(device, config, actual);
  // Solo caemos al agregado legacy a_* cuando NO hay datos por sensor
  // (firmware viejo sin sensors[]). Si los hay y este sensor no aparece,
  // es que no reporta: mostrar el valor de otro sensor sería inventar.
  const current =
    perSensor ??
    (actual.sensors.length === 0
      ? Number.parseFloat(actual[actualKey])
      : Number.NaN);

  if (!range || !Number.isFinite(current) || range.min >= range.max) {
    return null;
  }

  return {
    label: LABEL_MAP[measurementKey],
    unit: UNIT_MAP[measurementKey],
    min: range.min,
    max: range.max,
    current,
  };
}
