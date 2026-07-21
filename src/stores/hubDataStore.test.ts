import { useHubDataStore } from "./hubDataStore";
import { useHubConfigStore } from "./hubConfigStore";
import { buildHubSensorDevices } from "../features/sensors/buildHubSensorDevices";
import {
  getActual,
  getAlarms,
  getConfig,
  getRelays,
  pollHubNotifications,
} from "../services/hubDataService";

jest.mock("../services/hubApi/backend", () => {
  throw new Error("hubDataStore should not import the backend selector directly");
});

jest.mock("../services/hubDataService", () => ({
  getConfig: jest.fn(),
  getActual: jest.fn(),
  getRelays: jest.fn(),
  getAlarms: jest.fn(),
  pollHubNotifications: jest.fn(),
}));

jest.mock("../features/sensors/buildHubSensorDevices", () => ({
  buildHubSensorDevices: jest.fn(),
}));

jest.mock("./hubConfigStore", () => ({
  useHubConfigStore: {
    getState: jest.fn(),
  },
}));

describe("hubDataStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useHubConfigStore.getState as jest.Mock).mockReturnValue({
      getConfig: jest.fn(),
    });
    useHubDataStore.setState(useHubDataStore.getInitialState(), true);
  });

  it("loads hub data through the service facade and derives devices from config plus relays", async () => {
    const config = {
      hash: "abc12345",
      incubator_name: "Incubadora Norte",
      min_temperature: 18,
      max_temperature: 38,
      min_hum: 45,
      max_hum: 70,
      sensors: [
        {
          type: "scd30",
          enabled: true,
          config: {},
          zones: ["zone-a"],
        },
      ],
      relays: [
        {
          type: "relay_2ch",
          enabled: true,
          config: {
            address: 2,
            alias: "Extractor",
          },
        },
      ],
    };
    const actual = {
      a_temperature: "24.1",
      a_humidity: "55.2",
      a_co2: "620",
      a_pressure: "1012",
      wifi_status: "connected",
      errors: {
        temperature: [],
        humidity: [],
        sensors: [],
        wifi: [],
        rotation: [],
      },
    };
    const relays = [
      {
        type: "relay_2ch",
        address: 2,
        alias: "Extractor",
        active: true,
        state: [true, false] as const,
        input_state: [false, false] as const,
        zones: ["zone-a"],
      },
    ];
    const alarms = [
      {
        id: "alarm-1",
        timestamp: "2026-04-20T12:00:00.000Z",
        dataType: "temperature",
        alertValue: 35,
        currentValue: 36,
        zones: ["zone-a"],
        status: "active",
      },
    ];

    (getConfig as jest.Mock).mockResolvedValue(config);
    (getActual as jest.Mock).mockResolvedValue(actual);
    (getRelays as jest.Mock).mockResolvedValue(relays);
    (getAlarms as jest.Mock).mockResolvedValue(alarms);
    (buildHubSensorDevices as jest.Mock).mockReturnValue([
      {
        id: "sensor-1",
        type: "sensor",
        name: "Sensor principal",
        subtype: "scd30",
        sensorType: "temperature",
        zones: ["zone-a"],
      },
    ]);

    await useHubDataStore.getState().loadHubData("192.168.1.50");

    expect(getConfig).toHaveBeenCalledWith("192.168.1.50", "directo");
    expect(getActual).toHaveBeenCalledWith("192.168.1.50", "directo");
    expect(getRelays).toHaveBeenCalledWith("192.168.1.50", "directo");
    expect(getAlarms).toHaveBeenCalledWith("192.168.1.50", "directo");
    expect(buildHubSensorDevices).toHaveBeenCalledWith(config);

    expect(useHubDataStore.getState()).toMatchObject({
      config,
      actual,
      relays,
      alarms,
      loading: false,
      error: null,
    });
    expect(useHubDataStore.getState().devices).toEqual([
      {
        id: "sensor-1",
        type: "sensor",
        name: "Sensor principal",
        subtype: "scd30",
        sensorType: "temperature",
        zones: ["zone-a"],
      },
      {
        id: "relay-2",
        type: "actuator",
        name: "Extractor",
        subtype: "relay_2ch",
        zones: ["zone-a"],
        relayAddress: 2,
      },
    ]);
  });

  it("sets an error and clears loading when the facade rejects", async () => {
    (getConfig as jest.Mock).mockResolvedValue({
      hash: "abc12345",
      incubator_name: "Incubadora Norte",
      min_temperature: 18,
      max_temperature: 38,
      min_hum: 45,
      max_hum: 70,
      sensors: [],
      relays: [],
    });
    (getActual as jest.Mock).mockRejectedValue(new Error("hub offline"));
    (getRelays as jest.Mock).mockResolvedValue([]);
    (getAlarms as jest.Mock).mockResolvedValue([]);
    (buildHubSensorDevices as jest.Mock).mockReturnValue([]);

    await useHubDataStore.getState().loadHubData("192.168.1.50");

    // El error incluye la causa entre paréntesis para poder diagnosticar
    // en campo (¿red?, ¿timeout?, ¿respuesta inválida?).
    expect(useHubDataStore.getState()).toMatchObject({
      loading: false,
      error: "No se pudieron cargar los datos del hub (hub offline)",
    });
  });

  it("loads online data with persisted config instead of calling /config", async () => {
    const config = {
      hash: "abc12345",
      incubator_name: "Incubadora Norte",
      min_temperature: 18,
      max_temperature: 38,
      min_hum: 45,
      max_hum: 70,
      sensors: [],
      relays: [],
    };
    const actual = {
      a_temperature: "24.1",
      a_humidity: "55.2",
      a_co2: "620",
      a_pressure: "1012",
      wifi_status: "connected",
      errors: {
        temperature: [],
        humidity: [],
        sensors: [],
        wifi: [],
        rotation: [],
      },
    };

    (useHubConfigStore.getState as jest.Mock).mockReturnValue({
      getConfig: jest.fn().mockReturnValue(config),
    });
    (getActual as jest.Mock).mockResolvedValue(actual);
    (getRelays as jest.Mock).mockResolvedValue([]);
    (buildHubSensorDevices as jest.Mock).mockReturnValue([]);

    await useHubDataStore.getState().loadHubData("abc12345", "online");

    expect(getConfig).not.toHaveBeenCalled();
    expect(getActual).toHaveBeenCalledWith("abc12345", "online");
    expect(getRelays).toHaveBeenCalledWith("abc12345", "online");
    expect(getAlarms).not.toHaveBeenCalled();
    expect(useHubDataStore.getState()).toMatchObject({
      config,
      actual,
      relays: [],
      alarms: [],
      loading: false,
      error: null,
    });
  });

  it("pollNotifications separa mensajes clasificables (alarma) de los que no, sin descartarlos", async () => {
    (pollHubNotifications as jest.Mock).mockResolvedValue([
      {
        id: "1",
        time: 1000,
        event: "message",
        topic: "moni-aabbcc",
        message: "[T] temperature too low: 19.98",
      },
      {
        id: "2",
        time: 1001,
        event: "message",
        topic: "moni-aabbcc",
        message: "hola, esto es una prueba",
      },
    ]);

    await useHubDataStore.getState().pollNotifications("moni-aabbcc");

    const state = useHubDataStore.getState();
    expect(state.alarms).toHaveLength(1);
    expect(state.alarms[0]).toMatchObject({ dataType: "temperature" });
    expect(state.notifications).toHaveLength(1);
    expect(state.notifications[0]).toMatchObject({
      id: "2",
      message: "hola, esto es una prueba",
    });
  });
});
