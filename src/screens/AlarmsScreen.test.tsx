import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { AlarmsScreen } from "./AlarmsScreen";
import { useHubDataStore } from "../stores/hubDataStore";
import { useHubStore } from "../stores/hubStore";
import { openNtfySubscriptionForHub } from "../services/notifyApi/ntfyDeepLink";
import type { RootStackParamList } from "../navigation/types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

jest.mock("../services/notifyApi/ntfyDeepLink", () => ({
  openNtfySubscriptionForHub: jest.fn(),
}));

type Props = NativeStackScreenProps<RootStackParamList, "Alarms">;

const hubConfig = {
  incubator_name: "Hub Demo",
  hash: "AABBCCDDEEFF",
  min_temperature: 37.3,
  max_temperature: 37.7,
  min_hum: 55,
  max_hum: 65,
  sensors: [],
  relays: [],
} as const;

function seedState(currentValue = 37.8) {
  useHubDataStore.setState({
    config: null,
    actual: null,
    relays: [],
    devices: [],
    loading: false,
    error: null,

    alarms: [
      {
        id: "alarm-001",
        timestamp: "2026-03-30T10:15:00Z",
        dataType: "temperature",
        alertValue: 38.5,
        currentValue,
        zones: ["Zona A"],
        status: "active",
      },
    ],
  });
}

function makeProps(): Props {
  return {
    navigation: { navigate: jest.fn(), goBack: jest.fn() } as unknown as Props["navigation"],
    route: {
      key: "Alarms",
      name: "Alarms",
      params: { hubHash: "AABBCCDDEEFF" },
    } as Props["route"],
  };
}

describe("AlarmsScreen (icon-first redesign)", () => {
  beforeEach(() => {
    seedState();
  });

  it("renders an acknowledge button on active alarms", () => {
    render(<AlarmsScreen {...makeProps()} />);

    expect(screen.getByText("Lo vi / Entendido")).toBeTruthy();
  });

  it("acknowledges an alarm and removes it from the active tab", () => {
    render(<AlarmsScreen {...makeProps()} />);

    fireEvent.press(screen.getByText("Lo vi / Entendido"));

    expect(screen.queryByText("Lo vi / Entendido")).toBeNull();
    expect(screen.getByText("No hay alarmas activas")).toBeTruthy();
  });

  it("renders the configured range as inline text when config is available", () => {
    useHubDataStore.setState({
      config: hubConfig,
    } as Partial<ReturnType<typeof useHubDataStore.getState>>);

    render(<AlarmsScreen {...makeProps()} />);

    expect(screen.getByText("Rango: 37.3–37.7°C")).toBeTruthy();
  });

  it("uses the red semaphore color for an active alarm", () => {
    useHubDataStore.setState({
      config: hubConfig,
    } as Partial<ReturnType<typeof useHubDataStore.getState>>);

    render(<AlarmsScreen {...makeProps()} />);

    expect(screen.getByText("37.8")).toHaveStyle({ color: "#C62828" });
  });

  it("shows the active count in the summary banner", () => {
    render(<AlarmsScreen {...makeProps()} />);

    expect(screen.getByText("1 activa")).toBeTruthy();
  });

  it("shows the data type label and the alert trigger value", () => {
    render(<AlarmsScreen {...makeProps()} />);

    expect(screen.getByText("Temperatura")).toBeTruthy();
    expect(screen.getByText("Disparada en 38.5°C")).toBeTruthy();
  });

  it("no muestra el cartel verde de 'todo funciona bien' cuando no hay alarmas activas", () => {
    useHubDataStore.setState({
      alarms: [],
    } as Partial<ReturnType<typeof useHubDataStore.getState>>);

    render(<AlarmsScreen {...makeProps()} />);

    expect(screen.queryByText("Sin alarmas")).toBeNull();
    expect(screen.queryByText("Todo funciona bien")).toBeNull();
  });
});

describe("AlarmsScreen (activar notificaciones ntfy)", () => {
  beforeEach(() => {
    seedState();
    jest.clearAllMocks();
    useHubStore.setState({
      hubs: [
        {
          hash: "AABBCCDDEEFF",
          name: "moni-AABBCCDD",
          ip: "192.168.4.1",
          status: "conectado",
          addedAt: "2026-03-15T08:00:00Z",
        },
      ],
    });
  });

  it("no muestra el CTA si el hub no está en el store", () => {
    useHubStore.setState({ hubs: [] });

    render(<AlarmsScreen {...makeProps()} />);

    expect(screen.queryByText("Activar")).toBeNull();
  });

  it("intenta el deep link y no abre el sheet si tuvo éxito", async () => {
    (openNtfySubscriptionForHub as jest.Mock).mockResolvedValueOnce(true);

    render(<AlarmsScreen {...makeProps()} />);
    fireEvent.press(screen.getByLabelText("Activar notificaciones"));

    await waitFor(() => {
      expect(openNtfySubscriptionForHub).toHaveBeenCalled();
    });
    expect(screen.queryByText("Instalá ntfy")).toBeNull();
  });

  it("abre el sheet de instalación si el deep link falla", async () => {
    (openNtfySubscriptionForHub as jest.Mock).mockResolvedValueOnce(false);

    render(<AlarmsScreen {...makeProps()} />);
    fireEvent.press(screen.getByLabelText("Activar notificaciones"));

    await waitFor(() => {
      expect(screen.getByText("Instalá ntfy")).toBeTruthy();
    });
  });

  it("reintenta desde el sheet y lo cierra si esta vez funciona", async () => {
    (openNtfySubscriptionForHub as jest.Mock)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    render(<AlarmsScreen {...makeProps()} />);
    fireEvent.press(screen.getByLabelText("Activar notificaciones"));
    await waitFor(() => {
      expect(screen.getByText("Instalá ntfy")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Ya la instalé, reintentar"));

    await waitFor(() => {
      expect(screen.queryByText("Instalá ntfy")).toBeNull();
    });
    expect(openNtfySubscriptionForHub).toHaveBeenCalledTimes(2);
  });
});
