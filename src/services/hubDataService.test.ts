import { getActual, getConfig, getRelays, toggleRelay } from "./hubDataService";
import { getHubApiClient } from "./hubApi/backend";

jest.mock("./hubApi/backend", () => ({
  getHubApiClient: jest.fn(),
}));

describe("hubDataService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("delegates getConfig to the hub api client", async () => {
    const expectedConfig = { hash: "abc12345" };
    const getConfigMock = jest.fn().mockResolvedValue({ hash: "abc12345" });
    (getHubApiClient as jest.Mock).mockReturnValue({
      getConfig: getConfigMock,
    });

    await expect(getConfig("192.168.1.50")).resolves.toEqual(expectedConfig);

    expect(getHubApiClient).toHaveBeenCalledWith("directo");
    expect(getConfigMock).toHaveBeenCalledWith("192.168.1.50");
  });

  it("delegates getActual to the hub api client", async () => {
    const expectedActual = { wifi_status: "connected" };
    const getActualMock = jest.fn().mockResolvedValue(expectedActual);
    (getHubApiClient as jest.Mock).mockReturnValue({
      getActual: getActualMock,
    });

    await expect(getActual("192.168.1.50")).resolves.toEqual(expectedActual);

    expect(getHubApiClient).toHaveBeenCalledWith("directo");
    expect(getActualMock).toHaveBeenCalledWith("192.168.1.50");
  });

  it("delegates getRelays to the hub api client", async () => {
    const expectedRelays = [{ address: 1 }];
    const getRelaysMock = jest.fn().mockResolvedValue(expectedRelays);
    (getHubApiClient as jest.Mock).mockReturnValue({
      getRelays: getRelaysMock,
    });

    await expect(getRelays("192.168.1.50")).resolves.toEqual(expectedRelays);

    expect(getHubApiClient).toHaveBeenCalledWith("directo");
    expect(getRelaysMock).toHaveBeenCalledWith("192.168.1.50");
  });

  it("delegates toggleRelay to the hub api client", async () => {
    const toggleRelayMock = jest.fn().mockResolvedValue("OK");
    (getHubApiClient as jest.Mock).mockReturnValue({
      toggleRelay: toggleRelayMock,
    });

    await expect(toggleRelay("192.168.1.50", 1, 2)).resolves.toBe("OK");

    expect(getHubApiClient).toHaveBeenCalledWith("directo");
    expect(toggleRelayMock).toHaveBeenCalledWith("192.168.1.50", 1, 2);
  });

  it("routes calls with online mode to the online client", async () => {
    const expectedActual = { wifi_status: "connected" };
    const getActualMock = jest.fn().mockResolvedValue(expectedActual);
    (getHubApiClient as jest.Mock).mockReturnValue({
      getActual: getActualMock,
    });

    await expect(getActual("ABC123", "online")).resolves.toEqual(expectedActual);

    expect(getHubApiClient).toHaveBeenCalledWith("online");
    expect(getActualMock).toHaveBeenCalledWith("ABC123");
  });
});
