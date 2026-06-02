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
      !isBooleanTuple(data.state) ||
      !isBooleanTuple(data.input_state) ||
      !isOptionalStringArray(data.zones)
    ) {
      throw new HubApiInvalidResponseError();
    }

    return {
      type: data.type,
      address: data.address,
      alias: data.alias,
      active: data.active,
      state: [data.state[0], data.state[1]],
      input_state: [data.input_state[0], data.input_state[1]],
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

function isBooleanTuple(
  value: unknown
): value is readonly [boolean, boolean] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "boolean" &&
    typeof value[1] === "boolean"
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
