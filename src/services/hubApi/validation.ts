import type { HubConfig } from "../../types";

const HUB_ID_REGEX = /^[a-fA-F0-9]{8,}$/;

export class InvalidHubConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidHubConfigError";
  }
}

export function validateHubConfig(config: unknown): HubConfig {
  if (!isPlainObject(config)) {
    throw new InvalidHubConfigError("El hub respondió con datos inválidos");
  }
  const c = config as Partial<HubConfig>;
  if (typeof c.hash !== "string" || !HUB_ID_REGEX.test(c.hash)) {
    throw new InvalidHubConfigError("El hub respondió con un ID inválido");
  }
  if (typeof c.incubator_name !== "string" || c.incubator_name.trim() === "") {
    throw new InvalidHubConfigError("El hub respondió sin nombre");
  }
  if (!Array.isArray(c.sensors)) {
    throw new InvalidHubConfigError("La lista de sensores ('sensors') no está presente o es inválida");
  }
  if (!Array.isArray(c.relays)) {
    throw new InvalidHubConfigError("La lista de relés ('relays') no está presente o es inválida");
  }
  const min_temperature =
    typeof c.min_temperature === "number" && Number.isFinite(c.min_temperature)
      ? c.min_temperature
      : 0;
  const max_temperature =
    typeof c.max_temperature === "number" && Number.isFinite(c.max_temperature)
      ? c.max_temperature
      : 99;
  const min_hum =
    typeof c.min_hum === "number" && Number.isFinite(c.min_hum)
      ? c.min_hum
      : 0;
  const max_hum =
    typeof c.max_hum === "number" && Number.isFinite(c.max_hum)
      ? c.max_hum
      : 99;

  if (min_temperature > max_temperature) {
    throw new InvalidHubConfigError("El rango de temperatura configurado en el hub es inválido");
  }
  if (min_hum > max_hum) {
    throw new InvalidHubConfigError("El rango de humedad configurado en el hub es inválido");
  }

  for (let i = 0; i < c.sensors.length; i++) {
    const sensor = c.sensors[i];
    if (!isPlainObject(sensor)) {
      throw new InvalidHubConfigError(`El sensor en la posición ${i + 1} no tiene un formato válido`);
    }
    if (
      typeof sensor.type !== "string" ||
      typeof sensor.enabled !== "boolean" ||
      !isPlainObject(sensor.config)
    ) {
      throw new InvalidHubConfigError(`El sensor '${String(sensor.type || i + 1)}' contiene un formato o configuración incompleta`);
    }
    if (
      sensor.zones !== undefined &&
      (!Array.isArray(sensor.zones) ||
        !sensor.zones.every((zone) => typeof zone === "string"))
    ) {
      throw new InvalidHubConfigError(`Las zonas del sensor '${String(sensor.type)}' deben ser una lista de textos`);
    }
  }

  for (let i = 0; i < c.relays.length; i++) {
    const relay = c.relays[i];
    if (!isPlainObject(relay)) {
      throw new InvalidHubConfigError(`El relé en la posición ${i + 1} no tiene un formato válido`);
    }
    if (
      typeof relay.type !== "string" ||
      typeof relay.enabled !== "boolean" ||
      !isPlainObject(relay.config)
    ) {
      throw new InvalidHubConfigError(`El relé en la posición ${i + 1} contiene un formato o configuración incompleta`);
    }
    const address = relay.config.address;
    const alias = relay.config.alias;
    if (typeof address !== "number" || !Number.isInteger(address) || address < 1 || address > 247) {
      throw new InvalidHubConfigError(`El relé '${String(alias || i + 1)}' tiene una dirección Modbus inválida (debe estar entre 1 y 247)`);
    }
    if (typeof alias !== "string" || alias.trim() === "") {
      throw new InvalidHubConfigError(`El relé en la posición ${i + 1} debe tener un alias o nombre no vacío`);
    }
  }
  return {
    ...c,
    min_temperature,
    max_temperature,
    min_hum,
    max_hum,
  } as HubConfig;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
