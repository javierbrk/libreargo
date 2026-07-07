import type {
  ActualSensorEntry,
  Device,
  HubConfig,
  SensorConfig,
  SensorData,
} from "../../types";
import type { MeasurementKey } from "./sensorMeasurementCatalog";

// Ver firmware core/SensorKey.h: TEMPERATURE=0, HUMIDITY=1, CO2=2, MOISTURE=3,
// PRESSURE=4. "humidity" cubre tanto humedad ambiente (1, ej. bme280/scd30)
// como humedad de suelo (3, ej. capacitive/hd38/modbus_soil_7in1): son
// magnitudes físicas distintas que la app agrupa bajo el mismo tipo visual.
const KEY_VARS_FOR_MEASUREMENT: Record<MeasurementKey, readonly number[]> = {
  temperature: [0],
  humidity: [1, 3],
  co2: [2],
  pressure: [4],
};

// Para sensores sin pin/dirección propia (singleton por diseño: solo puede
// haber uno por hub), el firmware expone un getSensorType() estable que sirve
// para correlacionar sin ambigüedad (SensorSCD30.h, SensorOneWire.h,
// SensorBME280.h).
const ACTUAL_TYPE_FOR_SINGLETON_CONFIG_TYPE: Record<string, string> = {
  scd30: "SCD30",
  onewire: "OneWire",
  bme280: "BME280",
};

// Reconstruye el id que arma el firmware en getSensorID() (SensorCapacitive.h,
// HD38Sensor.h, ModbusSoil7in1Sensor.h, ModbusTHSensor.h) a partir de los
// campos de config.json, para correlacionar un sensor de /config con su
// entrada en /actual.sensors[].
function reconstructActualSensorId(sensor: SensorConfig): string | null {
  const pin = sensor.config.pin;
  if ((sensor.type === "capacitive" || sensor.type === "hd38") && typeof pin === "number") {
    return `m-adc-${pin}`;
  }

  const address = resolveModbusAddress(sensor.config);
  if (sensor.type === "modbus_soil_7in1" && address !== null) {
    return `soil7-mod-${address}`;
  }
  if (sensor.type === "modbus_th" && address !== null) {
    return `th-mod-${address}`;
  }

  return null;
}

function resolveModbusAddress(config: Record<string, unknown>): number | null {
  if (typeof config.address === "number") {
    return config.address;
  }
  if (Array.isArray(config.addresses) && typeof config.addresses[0] === "number") {
    return config.addresses[0];
  }
  return null;
}

function extractConfigIndex(deviceId: string): number | null {
  const match = /-(\d+)$/.exec(deviceId);
  return match ? Number.parseInt(match[1], 10) : null;
}

function readMeasurement(
  entry: ActualSensorEntry,
  targetKeyVars: readonly number[]
): number | null {
  const reading = entry.readings.find(
    (r) => r.key_var !== undefined && targetKeyVars.includes(r.key_var)
  );
  if (!reading) {
    return null;
  }
  const parsed = Number.parseFloat(reading.value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Valor real del sensor físico representado por `device`, leído de su propia
 * entrada en /actual.sensors[] — en vez del agregado legacy a_* (que solo
 * trae la primera lectura de cada tipo, compartida por todos los sensores
 * del mismo tipo). Devuelve null si no se puede correlacionar con certeza,
 * en vez de arriesgar el valor de otro sensor.
 */
export function resolveSensorReading(
  device: Device,
  config: HubConfig,
  actual: SensorData
): number | null {
  if (!device.sensorType) {
    return null;
  }

  const index = extractConfigIndex(device.id);
  const sensorConfig = index !== null ? config.sensors[index] : undefined;
  if (!sensorConfig) {
    return null;
  }

  const targetKeyVars = KEY_VARS_FOR_MEASUREMENT[device.sensorType];
  const expectedId = reconstructActualSensorId(sensorConfig);

  if (expectedId) {
    const match = actual.sensors.find((entry) => entry.id === expectedId);
    return match ? readMeasurement(match, targetKeyVars) : null;
  }

  const expectedType = ACTUAL_TYPE_FOR_SINGLETON_CONFIG_TYPE[sensorConfig.type];
  if (!expectedType) {
    // Tipo sin id derivable ni type singleton conocido: no arriesgamos.
    return null;
  }

  const candidates = actual.sensors.filter((entry) => entry.type === expectedType);
  return candidates.length === 1 ? readMeasurement(candidates[0], targetKeyVars) : null;
}
