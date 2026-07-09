import type {
  HubConfig,
  RelayState,
  SensorData,
} from "../../types";
import {
  HubApiInvalidResponseError,
} from "./errors";
import { InvalidHubConfigError, validateHubConfig } from "./validation";

export function mapConfigurationResponse(payload: unknown): HubConfig {
  try {
    const config = validateHubConfig(payload);
    return {
      incubator_name: config.incubator_name,
      hash: config.hash,
      min_temperature: config.min_temperature,
      max_temperature: config.max_temperature,
      min_hum: config.min_hum,
      max_hum: config.max_hum,
      sensors: config.sensors.map((sensor) => ({
        type: sensor.type,
        enabled: sensor.enabled,
        config: deepCloneRecord(sensor.config),
        zones: sensor.zones ? [...sensor.zones] : undefined,
      })),
      relays: config.relays.map((relay) => ({
        type: relay.type,
        enabled: relay.enabled,
        config: deepCloneRecord(relay.config) as typeof relay.config,
      })),
    };
  } catch (error) {
    if (!(error instanceof InvalidHubConfigError)) {
      throw error;
    }
    throw new HubApiInvalidResponseError();
  }
}

export function mapSensorDataResponse(payload: unknown): SensorData {
  if (!isPlainObject(payload)) {
    throw new HubApiInvalidResponseError();
  }

  const data = payload as Record<string, unknown>;
  const errors = data.errors;
  if (
    typeof data.a_temperature !== "string" ||
    typeof data.a_humidity !== "string" ||
    typeof data.a_co2 !== "string" ||
    typeof data.a_pressure !== "string" ||
    !isWifiStatus(data.wifi_status) ||
    !isErrorCollection(errors)
  ) {
    throw new HubApiInvalidResponseError();
  }

  return {
    a_temperature: data.a_temperature,
    a_humidity: data.a_humidity,
    a_co2: data.a_co2,
    a_pressure: data.a_pressure,
    sensors: parseActualSensors(data.sensors),
    wifi_status: data.wifi_status,
    errors: {
      temperature: [...errors.temperature],
      humidity: [...errors.humidity],
      sensors: [...errors.sensors],
      wifi: [...errors.wifi],
      rotation: [...errors.rotation],
    },
  };
}

// El array `sensors` de /actual es adicional a los campos legacy a_* (no lo
// exige validateHubConfig ni el contrato histórico): si falta o viene mal
// formado, degradamos a [] en vez de rechazar toda la respuesta.
function parseActualSensors(value: unknown): SensorData["sensors"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (
      !isPlainObject(entry) ||
      typeof entry.id !== "string" ||
      typeof entry.type !== "string" ||
      !Array.isArray(entry.readings)
    ) {
      return [];
    }

    const readings = entry.readings.flatMap((reading) => {
      if (!isPlainObject(reading) || typeof reading.value !== "string") {
        return [];
      }
      return [
        {
          value: reading.value,
          key_var: typeof reading.key_var === "number" ? reading.key_var : undefined,
        },
      ];
    });

    return [{ id: entry.id, type: entry.type, readings }];
  });
}

export function mapRelayListResponse(payload: unknown): readonly RelayState[] {
  if (!Array.isArray(payload)) {
    throw new HubApiInvalidResponseError();
  }

  return payload.map((relay) => {
    if (!isPlainObject(relay)) {
      throw new HubApiInvalidResponseError();
    }

    const data = relay as Record<string, unknown>;
    if (
      typeof data.type !== "string" ||
      typeof data.address !== "number" ||
      typeof data.alias !== "string" ||
      typeof data.active !== "boolean" ||
      !isBooleanChannelArray(data.state) ||
      !isBooleanChannelArray(data.input_state) ||
      !isOptionalStringArray(data.zones)
    ) {
      throw new HubApiInvalidResponseError();
    }

    return {
      type: data.type,
      address: data.address,
      alias: data.alias,
      active: data.active,
      state: [...data.state],
      input_state: [...data.input_state],
      zones: data.zones ? [...data.zones] : undefined,
    };
  });
}

export function mapToggleRelayResponse(payload: unknown): string {
  if (typeof payload !== "string") {
    throw new HubApiInvalidResponseError();
  }

  const value = payload.trim();
  if (value === "") {
    throw new HubApiInvalidResponseError();
  }

  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isErrorCollection(
  value: unknown
): value is SensorData["errors"] {
  return (
    isPlainObject(value) &&
    isStringArray(value.temperature) &&
    isStringArray(value.humidity) &&
    isStringArray(value.sensors) &&
    isStringArray(value.wifi) &&
    isStringArray(value.rotation)
  );
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isOptionalStringArray(
  value: unknown
): value is readonly string[] | undefined {
  return (
    value === undefined ||
    (Array.isArray(value) && value.every((item) => typeof item === "string"))
  );
}

// Un booleano por canal: gpio=1, relay_2ch=2, relay_4ch=4 (ver firmware
// RelayModule2CH.h / RelayModule4CH.h / handleRelayList).
function isBooleanChannelArray(value: unknown): value is readonly boolean[] {
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= 4 &&
    value.every((item) => typeof item === "boolean")
  );
}

function isWifiStatus(value: unknown): value is SensorData["wifi_status"] {
  return (
    value === "connected" ||
    value === "disconnected" ||
    value === "unknown"
  );
}

function deepCloneRecord<T extends Record<string, unknown>>(value: T): T {
  return deepCloneValue(value) as T;
}

function deepCloneValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => deepCloneValue(item));
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, deepCloneValue(entry)])
    );
  }
  return value;
}
