import { Linking } from "react-native";
import type { Hub } from "../../types";
import {
  parseNtfyHost,
  buildNtfySubscribeUrl,
  buildNtfySubscribeUrlForHub,
  tryOpenUrl,
  openNtfySubscriptionForHub,
} from "./ntfyDeepLink";

jest.mock("./backend", () => ({
  getBaseUrl: jest.fn(() => "https://ntfy.sh"),
}));

import { getBaseUrl } from "./backend";

const mockHub: Hub = {
  hash: "F024F90C58F8",
  name: "moni-f024f90c58f8",
  ip: "192.168.4.1",
  status: "conectado",
  addedAt: "2026-04-16T12:00:00Z",
};

describe("parseNtfyHost", () => {
  it("separa host y secure de una URL https", () => {
    expect(parseNtfyHost("https://ntfy.sh")).toEqual({
      host: "ntfy.sh",
      secure: true,
    });
  });

  it("marca secure=false para http", () => {
    expect(parseNtfyHost("http://192.168.1.5:8080")).toEqual({
      host: "192.168.1.5:8080",
      secure: false,
    });
  });

  it("sin protocolo explícito, asume https", () => {
    expect(parseNtfyHost("ntfy.sh")).toEqual({ host: "ntfy.sh", secure: true });
  });
});

describe("buildNtfySubscribeUrl", () => {
  it("arma la URL básica sin display ni secure", () => {
    expect(buildNtfySubscribeUrl("https://ntfy.sh", "moni-aabbcc")).toBe(
      "ntfy://ntfy.sh/moni-aabbcc"
    );
  });

  it("agrega display cuando se pasa un nombre", () => {
    expect(
      buildNtfySubscribeUrl("https://ntfy.sh", "moni-aabbcc", "Invernadero Norte")
    ).toBe("ntfy://ntfy.sh/moni-aabbcc?display=Invernadero%20Norte");
  });

  it("agrega secure=false para un host http", () => {
    expect(buildNtfySubscribeUrl("http://ntfy.local", "moni-aabbcc")).toBe(
      "ntfy://ntfy.local/moni-aabbcc?secure=false"
    );
  });

  it("combina display y secure=false en orden fijo", () => {
    expect(
      buildNtfySubscribeUrl("http://ntfy.local", "moni-aabbcc", "Hub Norte")
    ).toBe("ntfy://ntfy.local/moni-aabbcc?display=Hub%20Norte&secure=false");
  });
});

describe("buildNtfySubscribeUrlForHub", () => {
  it("omite display cuando el nombre del hub ya es el topic", () => {
    expect(buildNtfySubscribeUrlForHub(mockHub)).toBe(
      "ntfy://ntfy.sh/moni-f024f90c58f8"
    );
  });

  it("incluye display cuando el nombre del hub es humano", () => {
    const namedHub: Hub = { ...mockHub, name: "Invernadero Norte" };
    expect(buildNtfySubscribeUrlForHub(namedHub)).toBe(
      "ntfy://ntfy.sh/moni-f024f90c58f8?display=Invernadero%20Norte"
    );
  });

  it("usa la base URL configurada (getBaseUrl)", () => {
    (getBaseUrl as jest.Mock).mockReturnValueOnce("http://ntfy.local");

    expect(buildNtfySubscribeUrlForHub(mockHub)).toBe(
      "ntfy://ntfy.local/moni-f024f90c58f8?secure=false"
    );
  });
});

describe("tryOpenUrl", () => {
  it("devuelve true cuando Linking.openURL resuelve", async () => {
    jest.spyOn(Linking, "openURL").mockResolvedValueOnce(undefined as never);

    await expect(tryOpenUrl("ntfy://ntfy.sh/moni-aabbcc")).resolves.toBe(true);
  });

  it("devuelve false (sin lanzar) cuando Linking.openURL rechaza", async () => {
    jest
      .spyOn(Linking, "openURL")
      .mockRejectedValueOnce(new Error("no activity found"));

    await expect(tryOpenUrl("ntfy://ntfy.sh/moni-aabbcc")).resolves.toBe(false);
  });
});

describe("openNtfySubscriptionForHub", () => {
  it("arma la URL del hub e intenta abrirla", async () => {
    const spy = jest.spyOn(Linking, "openURL").mockResolvedValueOnce(undefined as never);

    await expect(openNtfySubscriptionForHub(mockHub)).resolves.toBe(true);
    expect(spy).toHaveBeenCalledWith("ntfy://ntfy.sh/moni-f024f90c58f8");
  });
});
