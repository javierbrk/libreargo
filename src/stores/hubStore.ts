import { create } from "zustand";
import type { Hub, ConnectionMode } from "../types";
import { mockHubs } from "../mocks";
import { getHubDataBackend } from "../services/hubApi/backend";

interface HubState {
  readonly hubs: readonly Hub[];
  readonly connectionMode: ConnectionMode;
  readonly selectedHubHash: string | null;
}

interface HubActions {
  readonly setConnectionMode: (mode: ConnectionMode) => void;
  readonly selectHub: (hash: string) => void;
  readonly addHub: (hub: Hub) => void;
  readonly removeHub: (hash: string) => void;
  readonly updateHubStatus: (hash: string, status: Hub["status"]) => void;
}

export const useHubStore = create<HubState & HubActions>((set) => ({
  // Hubs sembrados solo en modo mock (dev/tests). En release http la lista
  // arranca vacía: no mostramos hubs falsos ni colisionan por hash con el alta real.
  hubs: getHubDataBackend() === "mock" ? mockHubs : [],
  connectionMode: "directo",
  selectedHubHash: null,

  setConnectionMode: (mode) =>
    set({ connectionMode: mode }),

  selectHub: (hash) =>
    set({ selectedHubHash: hash }),

  addHub: (hub) =>
    set((state) => ({
      hubs: state.hubs.some((h) => h.hash === hub.hash)
        ? state.hubs
        : [...state.hubs, hub],
    })),

  removeHub: (hash) =>
    set((state) => ({
      hubs: state.hubs.filter((h) => h.hash !== hash),
      selectedHubHash:
        state.selectedHubHash === hash ? null : state.selectedHubHash,
    })),

  updateHubStatus: (hash, status) =>
    set((state) => ({
      hubs: state.hubs.map((h) =>
        h.hash === hash ? { ...h, status } : h
      ),
    })),
}));
