import { create } from "zustand";

/**
 * Asignación local de zonas a dispositivos (sensores y actuadores).
 *
 * Confirmado por LibreAgro: el hub NO almacena zonas. Toda la asignación
 * vive en el celular del usuario. Estructura: `deviceId -> zonas[]`.
 *
 * El `deviceId` se forma como:
 *   - sensor:   `sensor:<hubHash>:<sensorType>`     (ej. `sensor:AABBCCDDEEFF:scd30`)
 *   - actuador: `actuator:<hubHash>:<modbusAddr>`   (ej. `actuator:AABBCCDDEEFF:1`)
 *
 * La lista global de zonas conocidas (`knownZones`) se mantiene aparte para
 * que la UI ofrezca autocompletar / multi-select sin duplicar strings.
 */

interface ZoneState {
  readonly knownZones: readonly string[];
  readonly assignments: Readonly<Record<string, readonly string[]>>;
}

interface ZoneActions {
  readonly addZone: (zone: string) => void;
  readonly removeZone: (zone: string) => void;
  readonly setDeviceZones: (deviceId: string, zones: readonly string[]) => void;
  readonly getDeviceZones: (deviceId: string) => readonly string[];
}

function dedupe(values: readonly string[]): readonly string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter((v) => v !== "")));
}

export const useZoneStore = create<ZoneState & ZoneActions>((set, get) => ({
  knownZones: [],
  assignments: {},

  addZone: (zone) =>
    set((state) => ({
      knownZones: dedupe([...state.knownZones, zone]),
    })),

  removeZone: (zone) =>
    set((state) => {
      const trimmed = zone.trim();
      const nextAssignments: Record<string, readonly string[]> = {};
      for (const [deviceId, zones] of Object.entries(state.assignments)) {
        nextAssignments[deviceId] = zones.filter((z) => z !== trimmed);
      }
      return {
        knownZones: state.knownZones.filter((z) => z !== trimmed),
        assignments: nextAssignments,
      };
    }),

  setDeviceZones: (deviceId, zones) =>
    set((state) => {
      const normalized = dedupe(zones);
      return {
        knownZones: dedupe([...state.knownZones, ...normalized]),
        assignments: {
          ...state.assignments,
          [deviceId]: normalized,
        },
      };
    }),

  getDeviceZones: (deviceId) => get().assignments[deviceId] ?? [],
}));

export function buildSensorDeviceId(hubHash: string, sensorType: string): string {
  return `sensor:${hubHash}:${sensorType}`;
}

export function buildActuatorDeviceId(
  hubHash: string,
  modbusAddress: number
): string {
  return `actuator:${hubHash}:${modbusAddress}`;
}
