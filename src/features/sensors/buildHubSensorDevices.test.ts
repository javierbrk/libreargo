import { buildHubSensorDevices } from "./buildHubSensorDevices";
import type { HubConfig } from "../../types";

const config: HubConfig = {
  incubator_name: "Hub Demo",
  hash: "AABBCCDDEEFF",
  min_temperature: 37.3,
  max_temperature: 37.7,
  min_hum: 55,
  max_hum: 65,
  sensors: [
    {
      type: "bme280",
      enabled: true,
      config: { measurementKey: "humidity" },
      zones: ["Zona A"],
    },
    {
      type: "onewire",
      enabled: true,
      config: {},
      zones: ["Zona B"],
    },
  ],
  relays: [],
};

describe("buildHubSensorDevices", () => {
  it("crea sensores visibles de un único tipo a partir del measurementKey explícito", () => {
    expect(buildHubSensorDevices(config)).toEqual([
      expect.objectContaining({
        id: "sensor-bme280-0",
        name: "Humedad",
        subtype: "bme280",
        sensorType: "humidity",
        zones: ["Zona A"],
      }),
      expect.objectContaining({
        id: "sensor-onewire-1",
        name: "Temperatura",
        subtype: "onewire",
        sensorType: "temperature",
        zones: ["Zona B"],
      }),
    ]);
  });

  it("usa el nombre configurado en el sensor (config.name) en vez del label genérico", () => {
    const namedConfig: HubConfig = {
      ...config,
      sensors: [
        {
          type: "capacitive",
          enabled: true,
          config: { name: "Soil5" },
          zones: ["Zona A"],
        },
        {
          type: "hd38",
          enabled: true,
          config: { name: "Soil6" },
          zones: ["Zona B"],
        },
      ],
    };

    expect(buildHubSensorDevices(namedConfig)).toEqual([
      expect.objectContaining({ id: "sensor-capacitive-0", name: "Soil5" }),
      expect.objectContaining({ id: "sensor-hd38-1", name: "Soil6" }),
    ]);
  });

  it("cae al label genérico cuando el sensor no tiene config.name", () => {
    const unnamedConfig: HubConfig = {
      ...config,
      sensors: [
        {
          type: "capacitive",
          enabled: true,
          config: {},
          zones: ["Zona A"],
        },
      ],
    };

    expect(buildHubSensorDevices(unnamedConfig)).toEqual([
      expect.objectContaining({ id: "sensor-capacitive-0", name: "Humedad" }),
    ]);
  });

  it("omite sensores sin medicion visible resuelta en vez de convertirlos a temperatura", () => {
    const unsupportedConfig: HubConfig = {
      ...config,
      sensors: [
        {
          type: "mystery",
          enabled: true,
          config: { measurementKey: "bogus" },
          zones: ["Zona X"],
        },
        {
          type: "bme280",
          enabled: true,
          config: {},
          zones: ["Zona Y"],
        },
      ],
    };

    expect(buildHubSensorDevices(unsupportedConfig)).toEqual([
      expect.objectContaining({
        id: "sensor-bme280-1",
        name: "Humedad",
        subtype: "bme280",
        sensorType: "humidity",
        zones: ["Zona Y"],
      }),
    ]);
  });

  it("mantiene estable el id visible cuando un sensor anterior queda deshabilitado", () => {
    const disabledEarlierSensorConfig: HubConfig = {
      ...config,
      sensors: [
        {
          type: "mystery",
          enabled: false,
          config: {},
          zones: ["Zona X"],
        },
        {
          type: "bme280",
          enabled: true,
          config: {},
          zones: ["Zona Y"],
        },
      ],
    };

    expect(buildHubSensorDevices(disabledEarlierSensorConfig)).toEqual([
      expect.objectContaining({
        id: "sensor-bme280-1",
        name: "Humedad",
        subtype: "bme280",
        sensorType: "humidity",
        zones: ["Zona Y"],
      }),
    ]);
  });
});
