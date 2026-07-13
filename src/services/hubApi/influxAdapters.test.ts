import {
  mapInfluxActual,
  mapInfluxHistory,
  mapInfluxRelays,
} from "./influxAdapters";
import type { InfluxSeries } from "../influxApi/influxApi";

describe("influxAdapters", () => {
  describe("mapInfluxActual", () => {
    it("formatea números a 2 decimales y nulls como '--'", () => {
      const series: InfluxSeries[] = [
        {
          name: "medicionesCO2",
          columns: ["time", "temp", "hum", "co2", "press"],
          values: [[1779894652, 25.5, 60, null, null]],
        },
      ];
      const actual = mapInfluxActual(series);
      expect(actual.a_temperature).toBe("25.50");
      expect(actual.a_humidity).toBe("60.00");
      expect(actual.a_co2).toBe("--");
      expect(actual.a_pressure).toBe("--");
      expect(actual.wifi_status).toBe("connected");
      expect(actual.errors.temperature).toEqual([]);
    });

    it("sin series → disconnected y todo '--'", () => {
      const actual = mapInfluxActual([]);
      expect(actual.a_temperature).toBe("--");
      expect(actual.wifi_status).toBe("disconnected");
    });

    it("usa moisture/soil_hum como humedad cuando no hay hum", () => {
      const series: InfluxSeries[] = [
        {
          name: "medicionesCO2",
          columns: ["time", "temp", "hum", "co2", "press", "moisture"],
          values: [[1779894652, null, null, null, null, 42]],
        },
      ];
      expect(mapInfluxActual(series).a_humidity).toBe("42.00");
    });

    it("con GROUP BY sensor llena sensors[] con la lectura individual de cada uno", () => {
      // Réplica de la respuesta real del hub moni-F024F90C5FA0 (2026-07-13).
      const series: InfluxSeries[] = [
        {
          name: "medicionesCO2",
          tags: { sensor: "m-adc-35" },
          columns: ["time", "temp", "hum", "co2", "press", "moisture", "soil_hum"],
          values: [[0, null, null, null, null, -49.7, null]],
        },
        {
          name: "medicionesCO2",
          tags: { sensor: "m-adc-32" },
          columns: ["time", "temp", "hum", "co2", "press", "moisture", "soil_hum"],
          values: [[0, null, null, null, null, 531.8, null]],
        },
        {
          name: "medicionesCO2",
          tags: { sensor: "soil7-mod-2" },
          columns: ["time", "temp", "hum", "co2", "press", "moisture", "soil_hum"],
          values: [[0, 19.4, null, null, null, 0, null]],
        },
        {
          name: "medicionesCO2",
          tags: { sensor: "thc-i2c-0x61" },
          columns: ["time", "temp", "hum", "co2", "press", "moisture", "soil_hum"],
          values: [[0, 24.1, 58, 410, null, null, null]],
        },
      ];

      const actual = mapInfluxActual(series);

      expect(actual.wifi_status).toBe("connected");
      expect(actual.sensors).toHaveLength(4);

      const byId = Object.fromEntries(actual.sensors.map((s) => [s.id, s]));
      // Cada sonda de suelo con su propio valor (key_var MOISTURE=3).
      expect(byId["m-adc-35"].readings).toEqual([
        { value: "-49.7", key_var: 3 },
      ]);
      expect(byId["m-adc-32"].readings).toEqual([
        { value: "531.8", key_var: 3 },
      ]);
      // soil7 reporta temperatura y humedad de suelo.
      expect(byId["soil7-mod-2"].readings).toEqual([
        { value: "19.4", key_var: 0 },
        { value: "0", key_var: 3 },
      ]);
      // El prefijo del id recupera el type del firmware para singletons.
      expect(byId["thc-i2c-0x61"].type).toBe("SCD30");
      expect(byId["m-adc-35"].type).toBe("");
    });
  });

  describe("mapInfluxRelays", () => {
    it("mapea series GROUP BY sensor cumpliendo el contrato de la app", () => {
      const series: InfluxSeries[] = [
        {
          name: "medicionesCO2",
          tags: { sensor: "scd30_0" },
          columns: ["time", "relay1", "relay2", "in1", "in2"],
          values: [[1779894652, null, null, null, null]],
        },
        {
          name: "medicionesCO2",
          tags: { sensor: "relay_1" },
          columns: ["time", "relay1", "relay2", "in1", "in2"],
          values: [[1779894652, 1, 0, 0, 1]],
        },
        {
          name: "medicionesCO2",
          tags: { sensor: "Nuevo_Relé_GPIO" },
          columns: ["time", "relay1", "relay2", "in1", "in2"],
          values: [[1779894652, 0, null, null, null]],
        },
      ];

      const relays = mapInfluxRelays(series);
      expect(relays).toHaveLength(2); // scd30_0 se descarta (relay1 null)

      const modbus = relays[0];
      expect(modbus.type).toBe("relay_2ch");
      expect(modbus.address).toBe(1);
      expect(modbus.alias).toBe("relay 1");
      expect(modbus.active).toBe(true);
      expect(modbus.state).toEqual([true, false]);
      expect(modbus.input_state).toEqual([false, true]);

      const gpio = relays[1];
      expect(gpio.type).toBe("gpio");
      expect(gpio.state).toEqual([false, false]);
      expect(gpio.input_state).toEqual([false, false]);
    });
  });

  describe("mapInfluxHistory", () => {
    it("descarta buckets sin dato (fill none → null)", () => {
      const series: InfluxSeries[] = [
        {
          name: "medicionesCO2",
          columns: ["time", "mean"],
          values: [
            [1779894000, 20.1],
            [1779894300, null],
            [1779894600, 21.4],
          ],
        },
      ];
      const points = mapInfluxHistory(series);
      expect(points).toEqual([
        { t: 1779894000, v: 20.1 },
        { t: 1779894600, v: 21.4 },
      ]);
    });
  });
});
