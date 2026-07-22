import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { HubHomeScreen } from "./HubHomeScreen";
import { useHubStore } from "../stores/hubStore";
import { useHubDataStore } from "../stores/hubDataStore";

import type { Device, HubConfig, SensorData } from "../types";
import type { RootStackParamList } from "../navigation/types";

const mockDeviceListItem = jest.fn();

jest.mock("../components", () => {
  const actual = jest.requireActual("../components");

  return {
    ...actual,
    AlarmSummaryCard: () => null,
    DeviceFilter: () => null,
    ZoneFilterSheet: () => null,
    DeviceListItem: (props: unknown) => {
      mockDeviceListItem(props);
      return null;
    },
  };
});

jest.mock("../services/unifiedPushService", () => ({
  subscribeToMessages: jest.fn(() => jest.fn()),
  checkUnifiedPushStatus: jest.fn(() => "ntfy_ready"),
  initUnifiedPush: jest.fn(),
}));

type Props = NativeStackScreenProps<RootStackParamList, "HubHome">;

function makeProps(
  params: RootStackParamList["HubHome"] = { hubHash: "hub-1" }
): Props {
  return {
    navigation: {
      navigate: jest.fn(),
      setOptions: jest.fn(),
    } as unknown as Props["navigation"],
    route: {
      key: "HubHome",
      name: "HubHome",
      params,
    } as Props["route"],
  };
}

describe("HubHomeScreen", () => {
  const scd30Sensor: Device = {
    id: "sensor-scd30-0",
    type: "sensor",
    name: "SCD30",
    subtype: "scd30",
    sensorType: "temperature",
    zones: ["Zona A"],
  };

  const onewireSensor: Device = {
    id: "sensor-onewire-0",
    type: "sensor",
    name: "1-Wire",
    subtype: "onewire",
    sensorType: "temperature",
    zones: ["Zona A"],
  };

  const actuator: Device = {
    id: "relay-1",
    type: "actuator",
    name: "Ventilacion",
    subtype: "relay_2ch",
    relayAddress: 1,
    zones: ["Zona A"],
  };

  const config: HubConfig = {
    incubator_name: "Hub Demo",
    hash: "hub-1",
    min_temperature: 37.3,
    max_temperature: 37.7,
    min_hum: 55,
    max_hum: 65,
    sensors: [],
    relays: [],
  };

  const actual: SensorData = {
    a_temperature: "25.5",
    a_humidity: "60.0",
    a_co2: "500",
    a_pressure: "1013",
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

  beforeEach(() => {
    jest.clearAllMocks();
    useHubStore.setState({
      hubs: [
        {
          hash: "hub-1",
          name: "Hub Demo",
          ip: "192.168.0.10",
          status: "conectado",
          addedAt: "2026-04-16T12:00:00Z",
        },
      ],
      connectionMode: "directo",
      selectedHubHash: null,
    });

    useHubDataStore.setState({
      config,
      actual,
      relays: [],
      alarms: [],
      devices: [scd30Sensor, actuator],
      loading: false,
      error: null,
      loadHubData: jest.fn(),
      clearData: jest.fn(),
    });
  });

  it("deriva y pasa el visual del sensor al item de dispositivos", async () => {
    render(<HubHomeScreen {...makeProps()} />);

    await waitFor(() => {
      const renderedItems = mockDeviceListItem.mock.calls.map(
        ([props]) =>
          props as {
            device: Device;
            sensorVisual?: {
              label: string;
              unit: string;
              min: number;
              max: number;
              current: number;
            } | null;
          }
      );

      expect(
        renderedItems.find(({ device }) => device.id === scd30Sensor.id)
      ).toMatchObject({
        device: scd30Sensor,
        sensorVisual: {
          label: "Temperatura",
          unit: "°C",
          min: 37.3,
          max: 37.7,
          current: 25.5,
        },
      });

      expect(
        renderedItems.find(({ device }) => device.id === actuator.id)
      ).toMatchObject({
        device: actuator,
        sensorVisual: null,
      });
    });
  });

  it("pasa el visual a cada sensor visible aunque compartan metrica", async () => {
    useHubDataStore.setState({
      config,
      actual,
      relays: [],
      alarms: [],
      devices: [scd30Sensor, onewireSensor, actuator],
      loading: false,
      error: null,
      loadHubData: jest.fn(),
      clearData: jest.fn(),
    });

    render(<HubHomeScreen {...makeProps()} />);

    await waitFor(() => {
      const renderedItems = mockDeviceListItem.mock.calls.map(
        ([props]) =>
          props as {
            device: Device;
            sensorVisual?: {
              label: string;
              unit: string;
              min: number;
              max: number;
              current: number;
            } | null;
          }
      );

      expect(
        renderedItems.find(({ device }) => device.id === scd30Sensor.id)
      ).toMatchObject({
        device: scd30Sensor,
        sensorVisual: {
          label: "Temperatura",
          unit: "°C",
          min: 37.3,
          max: 37.7,
          current: 25.5,
        },
      });

      expect(
        renderedItems.find(({ device }) => device.id === onewireSensor.id)
      ).toMatchObject({
        device: onewireSensor,
        sensorVisual: {
          label: "Temperatura",
          unit: "°C",
          min: 37.3,
          max: 37.7,
          current: 25.5,
        },
      });
    });
  });

  it("permite que los filtros bajen de linea para que Zonas no quede fuera de pantalla", () => {
    render(<HubHomeScreen {...makeProps()} />);

    expect(screen.getByTestId("hub-home-filters-row")).toHaveStyle({
      flexWrap: "wrap",
    });
  });

  it("sin alarmas reales, tocar el resumen NO navega: muestra los datos con problemas en la lista", () => {
    // Los "problemas" del banner son sensores fuera de rango (25.5 vs
    // 37.3-37.7 del mock): tocar debe llevar a esos datos, no a una
    // pantalla de alarmas vacía.
    const props = makeProps();

    render(<HubHomeScreen {...props} />);
    fireEvent.press(screen.getByText("Revisar ahora"));

    expect(props.navigation.navigate).not.toHaveBeenCalledWith(
      "Alarms",
      expect.anything()
    );
  });

  it("navega a alarmas al tocar el resumen cuando hay alertas activas", () => {
    useHubDataStore.setState({
      alarms: [
        {
          id: "alarm-001",
          timestamp: "2026-03-30T10:15:00Z",
          dataType: "temperature",
          alertValue: 38.5,
          currentValue: 37.8,
          zones: ["Zona A"],
          status: "active",
        },
      ],
    } as Partial<ReturnType<typeof useHubDataStore.getState>>);
    const props = makeProps();

    render(<HubHomeScreen {...props} />);
    fireEvent.press(screen.getByText("Revisar ahora"));

    expect(props.navigation.navigate).toHaveBeenCalledWith("Alarms", {
      hubHash: "hub-1",
    });
  });

  it("muestra estado de revision cuando hay alertas activas aunque las mediciones esten en rango", () => {
    useHubDataStore.setState({
      actual: {
        ...actual,
        a_temperature: "37.5",
      },
      alarms: [
        {
          id: "alarm-001",
          timestamp: "2026-03-30T10:15:00Z",
          dataType: "temperature",
          alertValue: 38.5,
          currentValue: 37.8,
          zones: ["Zona A"],
          status: "active",
        },
      ],
    } as Partial<ReturnType<typeof useHubDataStore.getState>>);

    render(<HubHomeScreen {...makeProps()} />);

    expect(screen.getByText("Revisar ahora")).toBeTruthy();
    expect(screen.getByText("1 problema detectado")).toBeTruthy();
  });

});
