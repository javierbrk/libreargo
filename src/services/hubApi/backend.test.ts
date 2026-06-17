import { getHubApiClient, resetHubApiClientForTests, setHubApiClientForTests } from "./backend";
import { createHttpHubApiClient } from "./HttpHubApiClient";
import { createInfluxHubApiClient } from "./InfluxHubApiClient";
import { createMockHubApiClient } from "./MockHubApiClient";
import type { HubApiClient } from "./HubApiClient";

jest.mock("./HttpHubApiClient", () => ({
  createHttpHubApiClient: jest.fn(),
}));

jest.mock("./InfluxHubApiClient", () => ({
  createInfluxHubApiClient: jest.fn(),
}));

jest.mock("./MockHubApiClient", () => ({
  createMockHubApiClient: jest.fn(),
}));

function makeClient(name: string): HubApiClient {
  return {
    getConfig: jest.fn().mockResolvedValue({ name }),
    getActual: jest.fn(),
    getRelays: jest.fn(),
    toggleRelay: jest.fn(),
    getAlarms: jest.fn(),
    pingHub: jest.fn(),
  } as unknown as HubApiClient;
}

describe("hubApi backend selector", () => {
  const originalEnv = process.env.EXPO_PUBLIC_HUB_DATA_BACKEND;

  beforeEach(() => {
    jest.clearAllMocks();
    resetHubApiClientForTests();
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_HUB_DATA_BACKEND = originalEnv;
  });

  it("routes http/directo to the direct hub client and http/online to Influx", () => {
    const httpClient = makeClient("http");
    const influxClient = makeClient("influx");
    process.env.EXPO_PUBLIC_HUB_DATA_BACKEND = "http";
    (createHttpHubApiClient as jest.Mock).mockReturnValue(httpClient);
    (createInfluxHubApiClient as jest.Mock).mockReturnValue(influxClient);

    expect(getHubApiClient("directo")).toBe(httpClient);
    expect(getHubApiClient("online")).toBe(influxClient);
  });

  it("uses mock client for both modes when backend is mock", () => {
    const mockClient = makeClient("mock");
    process.env.EXPO_PUBLIC_HUB_DATA_BACKEND = "mock";
    (createMockHubApiClient as jest.Mock).mockReturnValue(mockClient);

    expect(getHubApiClient("directo")).toBe(mockClient);
    expect(getHubApiClient("online")).toBe(mockClient);
  });

  it("keeps explicit test override independent of mode", () => {
    const override = makeClient("override");
    process.env.EXPO_PUBLIC_HUB_DATA_BACKEND = "http";
    setHubApiClientForTests(override);

    expect(getHubApiClient("directo")).toBe(override);
    expect(getHubApiClient("online")).toBe(override);
  });
});
