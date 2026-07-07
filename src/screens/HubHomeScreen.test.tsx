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
import { getNotifyBackend } from "../services/notifyApi/backend";
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

jest.mock("../services/notifyApi/backend", () => ({
  getNotifyBackend: jest.fn(() => "mock"),
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
    (getNotifyBackend as jest.Mock).mockReturnValue("mock");

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
      pollNotifications: jest.fn(),
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

  it("consulta ntfy en modo online cuando el backend de notificaciones esta activo", async () => {
    const loadHubData = jest.fn().mockResolvedValue(undefined);
    const pollNotifications = jest.fn().mockResolvedValue(undefined);
    (getNotifyBackend as jest.Mock).mockReturnValue("http");
    useHubStore.setState({
      hubs: [
        {
          hash: "F024F90C58F8",
          name: "Hub Demo",
          ip: "192.168.0.10",
          status: "conectado",
          addedAt: "2026-04-16T12:00:00Z",
        },
      ],
      connectionMode: "online",
      selectedHubHash: null,
    });
    useHubDataStore.setState({
      loadHubData,
      pollNotifications,
    } as Partial<ReturnType<typeof useHubDataStore.getState>>);

    render(
      <HubHomeScreen
        {...makeProps({
          hubHash: "F024F90C58F8",
        })}
      />
    );

    await waitFor(() => {
      expect(loadHubData).toHaveBeenCalledWith("F024F90C58F8", "online");
      expect(pollNotifications).toHaveBeenCalledWith("moni-f024f90c58f8");
    });
  });

  it("no consulta ntfy en directo aunque el backend de notificaciones este activo", async () => {
    const loadHubData = jest.fn().mockResolvedValue(undefined);
    const pollNotifications = jest.fn().mockResolvedValue(undefined);
    (getNotifyBackend as jest.Mock).mockReturnValue("http");
    useHubDataStore.setState({
      loadHubData,
      pollNotifications,
    } as Partial<ReturnType<typeof useHubDataStore.getState>>);

    render(<HubHomeScreen {...makeProps()} />);

    await waitFor(() => {
      expect(loadHubData).toHaveBeenCalledWith("192.168.4.1", "directo");
    });
    expect(pollNotifications).not.toHaveBeenCalled();
  });

  it("mantiene polling periodico de ntfy mientras el home esta montado", async () => {
    jest.useFakeTimers();
    const loadHubData = jest.fn().mockResolvedValue(undefined);
    const pollNotifications = jest.fn().mockResolvedValue(undefined);
    (getNotifyBackend as jest.Mock).mockReturnValue("http");
    useHubStore.setState({
      hubs: [
        {
          hash: "F024F90C58F8",
          name: "Hub Demo",
          ip: "192.168.0.10",
          status: "conectado",
          addedAt: "2026-04-16T12:00:00Z",
        },
      ],
      connectionMode: "online",
      selectedHubHash: null,
    });
    useHubDataStore.setState({
      loadHubData,
      pollNotifications,
    } as Partial<ReturnType<typeof useHubDataStore.getState>>);

    const rendered = render(
      <HubHomeScreen
        {...makeProps({
          hubHash: "F024F90C58F8",
        })}
      />
    );

    try {
      await waitFor(() => {
        expect(pollNotifications).toHaveBeenCalledTimes(1);
      });

      pollNotifications.mockClear();
      act(() => {
        jest.advanceTimersByTime(30_000);
      });

      await waitFor(() => {
        expect(pollNotifications).toHaveBeenCalledTimes(1);
        expect(pollNotifications).toHaveBeenCalledWith("moni-f024f90c58f8");
      });

      rendered.unmount();
      pollNotifications.mockClear();
      act(() => {
        jest.advanceTimersByTime(30_000);
      });
      expect(pollNotifications).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
