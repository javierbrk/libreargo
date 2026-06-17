import type { InfluxSeries } from "../influxApi/influxApi";
import { mapInfluxRecommendations } from "./influxAdapters";

describe("mapInfluxRecommendations", () => {
  it("maps recomendaciones rows from InfluxDB to app recommendations", () => {
    const series: InfluxSeries[] = [
      {
        name: "recomendaciones",
        columns: ["time", "device", "prioridad", "texto", "tipo"],
        values: [
          [
            1_766_000_000,
            "moni-F024F90C6D24",
            "alta",
            "Revisar humedad del sustrato",
            "riego",
          ],
        ],
      },
    ];

    expect(mapInfluxRecommendations(series)).toEqual([
      {
        id: "influx-rec-1766000000",
        title: "riego · prioridad alta",
        content: "Revisar humedad del sustrato",
        date: "2025-12-17T19:33:20.000Z",
      },
    ]);
  });
});
