import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { HubConfig } from "../types";

interface HubConfigState {
  readonly configs: Readonly<Record<string, HubConfig>>;
}

interface HubConfigActions {
  readonly setConfig: (hash: string, config: HubConfig) => void;
  readonly getConfig: (hash: string) => HubConfig | undefined;
  readonly removeConfig: (hash: string) => void;
}

export const useHubConfigStore = create<HubConfigState & HubConfigActions>()(
  persist(
    (set, get) => ({
      configs: {},

      setConfig: (hash, config) =>
        set((state) => ({
          configs: {
            ...state.configs,
            [hash]: config,
          },
        })),

      getConfig: (hash) => get().configs[hash],

      removeConfig: (hash) =>
        set((state) => {
          const { [hash]: _removed, ...configs } = state.configs;
          return { configs };
        }),
    }),
    {
      name: "libreagro-hub-configs",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ configs: state.configs }),
    }
  )
);
