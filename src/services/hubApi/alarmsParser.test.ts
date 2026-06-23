import type { SensorData } from "../../types";
import { parseAlarmsFromSensorData } from "./alarmsParser";

const BASE_ACTUAL: SensorData = {
  a_temperature: "24.1",
  a_humidity: "58",
  a_co2: "650",
  a_pressure: "1013",
  wifi_status: "connected",
  errors: {
    temperature: [],
    humidity: [],
    sensors: [],
    wifi: [],
    rotation: [],
  },
};

function actualWithErrors(errors: SensorData["errors"]): SensorData {
  return {
    ...BASE_ACTUAL,
    errors,
  };
}

describe("parseAlarmsFromSensorData", () => {
  it("parses CO2 measurement alarms from the sensors bucket", () => {
    const actual = actualWithErrors({
      ...BASE_ACTUAL.errors,
      sensors: ["[C] CO2 too high: 1200 max:900,1700000000000000000"],
    });

    const alarms = parseAlarmsFromSensorData(actual);

    expect(alarms).toHaveLength(1);
    expect(alarms[0]).toMatchObject({
      id: "co2-1700000000000000000",
      dataType: "co2",
      currentValue: 1200,
      alertValue: 900,
      status: "active",
      message: "[C] CO2 too high: 1200 max:900",
    });
  });

  it("parses pressure measurement alarms from the sensors bucket", () => {
    const actual = actualWithErrors({
      ...BASE_ACTUAL.errors,
      sensors: ["[P] Presion too low: 990 min:1000,1700000060000000000"],
    });

    const alarms = parseAlarmsFromSensorData(actual);

    expect(alarms).toHaveLength(1);
    expect(alarms[0]).toMatchObject({
      id: "pressure-1700000060000000000",
      dataType: "pressure",
      currentValue: 990,
      alertValue: 1000,
      message: "[P] Presion too low: 990 min:1000",
    });
  });

  it("ignores technical sensor errors that are not measurement alarms", () => {
    const actual = actualWithErrors({
      ...BASE_ACTUAL.errors,
      sensors: ["[heap] Low heap: 12000,1700000120000000000"],
    });

    expect(parseAlarmsFromSensorData(actual)).toEqual([]);
  });

  it("keeps parsing temperature and humidity buckets", () => {
    const actual = actualWithErrors({
      ...BASE_ACTUAL.errors,
      temperature: [
        "[T] temperature too low: 19.98 min:20,1700000180000000000",
      ],
      humidity: ["[H] Humidity too high: 80 max:60,1700000240000000000"],
    });

    const alarms = parseAlarmsFromSensorData(actual);

    expect(alarms.map((alarm) => alarm.dataType)).toEqual([
      "humidity",
      "temperature",
    ]);
    expect(alarms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "temperature-1700000180000000000",
          dataType: "temperature",
          currentValue: 19.98,
          alertValue: 20,
        }),
        expect.objectContaining({
          id: "humidity-1700000240000000000",
          dataType: "humidity",
          currentValue: 80,
          alertValue: 60,
        }),
      ])
    );
  });
});
