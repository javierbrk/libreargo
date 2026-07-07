import { resolveSensorReading } from "./resolveSensorReading";
import type { Device, HubConfig, SensorData } from "../../types";

const config: HubConfig = {
  incubator_name: "Hub Demo",
  hash: "AABBCCDDEEFF",
  min_temperature: 37.3,
  max_temperature: 37.7,
  min_hum: 55,
  max_hum: 65,
  sensors: [
    { type: "scd30", enabled: true, config: {} }, // index 0
    { type: "capacitive", enabled: true, config: { pin: 35, name: "Soil5" } }, // index 1
    { type: "capacitive", enabled: true, config: { pin: 32, name: "Soil2" } }, // index 2
    { type: "hd38", enabled: true, config: { pin: 34, name: "Soil4" } }, // index 3
    { type: "modbus_soil_7in1", enabled: true, config: { addresses: [2] } }, // index 4
    { type: "onewire", enabled: true, config: { pin: 4 } }, // index 5
  ],
  relays: [],
};

// Réplica de /actual.sensors[] de un hub real (ver sesión de soporte): cada
// sensor físico reporta su propia lectura, distinta entre sí.
const actual: SensorData = {
  a_temperature: "13.6",
  a_humidity: "0.0",
  a_co2: "--",
  a_pressure: "--",
  sensors: [
    {
      id: "thc-i2c-0x61",
      type: "SCD30",
      readings: [
        { value: "24.1", key_var: 0 },
        { value: "58.0", key_var: 1 },
        { value: "410", key_var: 2 },
      ],
    },
    { id: "m-adc-35", type: "Capacitive", readings: [{ value: "-51.7", key_var: 3 }] },
    { id: "m-adc-32", type: "Capacitive", readings: [{ value: "509.8", key_var: 3 }] },
    { id: "m-adc-34", type: "hd38_34", readings: [{ value: "-67.3", key_var: 3 }] },
    {
      id: "soil7-mod-2",
      type: "modbus_soil7in1_2",
      readings: [
        { value: "13.6", key_var: 0 },
        { value: "0.0", key_var: 3 },
      ],
    },
    { id: "t-1w-ab12", type: "OneWire", readings: [{ value: "22.4", key_var: 0 }] },
  ],
  wifi_status: "connected",
  errors: { temperature: [], humidity: [], sensors: [], wifi: [], rotation: [] },
};

function device(id: string, sensorType: Device["sensorType"]): Device {
  return { id, type: "sensor", name: id, subtype: "x", zones: [], sensorType };
}

describe("resolveSensorReading", () => {
  it("correlaciona sensores capacitivos distintos por pin, sin mezclar valores", () => {
    expect(resolveSensorReading(device("sensor-capacitive-1", "humidity"), config, actual)).toBe(
      -51.7
    );
    expect(resolveSensorReading(device("sensor-capacitive-2", "humidity"), config, actual)).toBe(
      509.8
    );
  });

  it("correlaciona hd38 por pin (humedad de suelo, key_var MOISTURE)", () => {
    expect(resolveSensorReading(device("sensor-hd38-3", "humidity"), config, actual)).toBe(-67.3);
  });

  it("correlaciona modbus_soil_7in1 por dirección Modbus", () => {
    expect(
      resolveSensorReading(device("sensor-modbus_soil_7in1-4", "humidity"), config, actual)
    ).toBe(0.0);
    expect(
      resolveSensorReading(device("sensor-modbus_soil_7in1-4", "temperature"), config, actual)
    ).toBe(13.6);
  });

  it("correlaciona por type estable cuando no hay pin/dirección (scd30, singleton)", () => {
    expect(resolveSensorReading(device("sensor-scd30-0", "temperature"), config, actual)).toBe(
      24.1
    );
    expect(resolveSensorReading(device("sensor-scd30-0", "co2"), config, actual)).toBe(410);
  });

  it("correlaciona por type estable cuando no hay pin/dirección (onewire, singleton)", () => {
    expect(resolveSensorReading(device("sensor-onewire-5", "temperature"), config, actual)).toBe(
      22.4
    );
  });

  it("devuelve null si el índice no tiene sensor en config", () => {
    expect(
      resolveSensorReading(device("sensor-capacitive-99", "humidity"), config, actual)
    ).toBeNull();
  });

  it("devuelve null si el device no tiene sensorType resuelto", () => {
    expect(
      resolveSensorReading(device("sensor-capacitive-1", undefined), config, actual)
    ).toBeNull();
  });

  it("devuelve null si no encuentra la entrada esperada en /actual (sensor caído)", () => {
    const actualWithoutCap2: SensorData = {
      ...actual,
      sensors: actual.sensors.filter((s) => s.id !== "m-adc-32"),
    };
    expect(
      resolveSensorReading(device("sensor-capacitive-2", "humidity"), config, actualWithoutCap2)
    ).toBeNull();
  });
});
