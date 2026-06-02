import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { AlarmsScreen } from "./AlarmsScreen";
import { useHubDataStore } from "../stores/hubDataStore";
import type { RootStackParamList } from "../navigation/types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

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
});
