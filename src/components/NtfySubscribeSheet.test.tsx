import React from "react";
import { Linking } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { NtfySubscribeSheet } from "./NtfySubscribeSheet";
import { NTFY_INSTALL_LINKS } from "../services/notifyApi/ntfyInstallLinks";

describe("NtfySubscribeSheet", () => {
  it("muestra el topic recibido", () => {
    render(
      <NtfySubscribeSheet
        visible
        topic="moni-f024f90c58f8"
        onRetry={jest.fn()}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByText("moni-f024f90c58f8")).toBeTruthy();
  });

  it("abre Google Play al tocar esa opción", () => {
    const spy = jest.spyOn(Linking, "openURL").mockResolvedValueOnce(undefined as never);

    render(
      <NtfySubscribeSheet
        visible
        topic="moni-f024f90c58f8"
        onRetry={jest.fn()}
        onClose={jest.fn()}
      />
    );

    fireEvent.press(screen.getByText("Google Play"));

    expect(spy).toHaveBeenCalledWith(NTFY_INSTALL_LINKS.playStore);
  });

  it("abre F-Droid al tocar esa opción", () => {
    const spy = jest.spyOn(Linking, "openURL").mockResolvedValueOnce(undefined as never);

    render(
      <NtfySubscribeSheet
        visible
        topic="moni-f024f90c58f8"
        onRetry={jest.fn()}
        onClose={jest.fn()}
      />
    );

    fireEvent.press(screen.getByText("F-Droid"));

    expect(spy).toHaveBeenCalledWith(NTFY_INSTALL_LINKS.fdroid);
  });

  it("llama a onRetry al tocar 'Ya la instalé, reintentar'", () => {
    const onRetry = jest.fn();

    render(
      <NtfySubscribeSheet
        visible
        topic="moni-f024f90c58f8"
        onRetry={onRetry}
        onClose={jest.fn()}
      />
    );

    fireEvent.press(screen.getByText("Ya la instalé, reintentar"));

    expect(onRetry).toHaveBeenCalled();
  });

  it("llama a onClose al tocar el botón de cerrar", () => {
    const onClose = jest.fn();

    render(
      <NtfySubscribeSheet
        visible
        topic="moni-f024f90c58f8"
        onRetry={jest.fn()}
        onClose={onClose}
      />
    );

    fireEvent.press(screen.getByLabelText("Cerrar"));

    expect(onClose).toHaveBeenCalled();
  });
});
