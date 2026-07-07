import type { SensorData } from "../types";

export const mockActual: SensorData = {
  a_temperature: "25.50",
  a_humidity: "60.00",
  a_co2: "450.00",
  a_pressure: "1013.25",
  sensors: [],
  wifi_status: "connected",
  errors: {
    temperature: [],
    humidity: [],
    sensors: [],
    wifi: [],
    rotation: [],
  },
};

// Ejemplo provisto por firmware: cada entrada de `errors.<categoria>`
// llega como "<texto>,<timestamp_opaco>".
export const mockActualWithErrors: SensorData = {
  a_temperature: "19.97",
  a_humidity: "35.67",
  a_co2: "450.00",
  a_pressure: "965.28",
  sensors: [],
  wifi_status: "disconnected",
  errors: {
    temperature: [
      "[T] temperature too low: 19.98,88257000000000",
      "[T] temperature too low: 19.97,88260000000000",
    ],
    humidity: [
      "[H] Humidity too low: 35.65 min:55 max:60 humidifier false - BLOCKED: temp 19.98°C < 35°C target,88257000000000",
      "[H] Humidity too low: 35.65 min:55 max:60 humidifier false - BLOCKED: temp 19.97°C < 35°C target,88260000000000",
    ],
    sensors: [],
    wifi: [
      "[W] Maximum retries reached. Please check WiFi configuration.,87811000000000",
      "[W] Maximum retries reached. Please check WiFi configuration.,88109000000000",
    ],
    rotation: [],
  },
};
