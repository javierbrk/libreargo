import type { Device, HubConfig, SensorConfig } from "../../types";
import { LABEL_MAP, resolveVisibleSensorMeasurement } from "./sensorMeasurementCatalog";

// El hub permite nombrar cada sensor individualmente (config.name, ej. "Soil5").
// Sin esto, dos sensores del mismo tipo (ej. dos capacitivos) se verían con el
// mismo nombre genérico ("Humedad", "Humedad") y serían indistinguibles en la app.
function resolveDeviceName(sensor: SensorConfig, fallback: string): string {
  const configuredName = sensor.config.name;
  return typeof configuredName === "string" && configuredName.trim() !== ""
    ? configuredName
    : fallback;
}

export function buildHubSensorDevices(config: HubConfig): readonly Device[] {
  return config.sensors.flatMap((sensor, index) => {
    if (!sensor.enabled) {
      return [];
    }

    const sensorType = resolveVisibleSensorMeasurement(sensor);

    if (!sensorType) {
      return [];
    }

    return [
      {
        id: `sensor-${sensor.type}-${index}`,
        type: "sensor" as const,
        name: resolveDeviceName(sensor, LABEL_MAP[sensorType]),
        subtype: sensor.type,
        sensorType,
        zones: sensor.zones ?? [],
      },
    ];
  });
}
