import { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  FlatList,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { COLORS } from "../constants";
import { useHubStore } from "../stores/hubStore";
import { useHubDataStore } from "../stores/hubDataStore";
import {
  DeviceListItem,
  DeviceFilter,
  ZoneFilterSheet,
  HubStatusBanner,
} from "../components";
import type { FilterType } from "../components";
import type { Device, RelayState, SensorRangeVisual } from "../types";
import type { RootStackParamList } from "../navigation/types";
import { getSensorRangeVisual } from "../utils/getSensorRangeVisual";
import { semaforo, type SemaforoState } from "../utils/semaforo";
import { IcoZona } from "../components/icons";
import { resolveHubTarget } from "../services/connectivity";
import { getNotifyBackend } from "../services/notifyApi/backend";
import {
  useZoneStore,
  zoneAssignmentKey,
  mergeDeviceZones,
} from "../stores/zoneStore";

type Props = NativeStackScreenProps<RootStackParamList, "HubHome">;

function resolveFilter(
  initialFilter: RootStackParamList["HubHome"]["filter"]
): FilterType {
  return initialFilter === "sensores"
    ? "sensores"
    : initialFilter === "actuadores"
      ? "actuadores"
      : "todos";
}

interface SectionHeaderProps {
  readonly label: string;
}

function SectionHeader({ label }: SectionHeaderProps) {
  return <Text style={styles.sectionHeader}>{label}</Text>;
}

export function HubHomeScreen({ navigation, route }: Props) {
  const { hubHash, filter: initialFilter } = route.params;
  const hub = useHubStore((s) => s.hubs.find((h) => h.hash === hubHash));
  const connectionMode = useHubStore((s) => s.connectionMode);
  const {
    alarms,
    devices,
    config,
    actual,
    relays,
    loading,
    error,
    loadHubData,
    pollNotifications,
    clearData,
  } = useHubDataStore();
  const [filter, setFilter] = useState<FilterType>(() =>
    resolveFilter(initialFilter)
  );
  const [selectedZones, setSelectedZones] = useState<readonly string[]>([]);
  const [zoneSheetVisible, setZoneSheetVisible] = useState(false);
  const zoneAssignments = useZoneStore((s) => s.assignments);

  useEffect(() => {
    setFilter(resolveFilter(initialFilter));
  }, [initialFilter]);

  useEffect(() => {
    if (!hub) {
      return;
    }

    navigation.setOptions({ title: hub.name });
    let cancelled = false;

    void (async () => {
      await loadHubData(resolveHubTarget(connectionMode, hub), connectionMode);
      // El push por ntfy solo se consulta cuando el backend está activo (http).
      // En modo mock (default) la app funciona con las alarmas de /actual.
      if (
        !cancelled &&
        connectionMode === "directo" &&
        getNotifyBackend() === "http"
      ) {
        await pollNotifications(hub.name);
      }
    })();

    return () => {
      cancelled = true;
      clearData();
    };
  }, [
    hub,
    connectionMode,
    navigation,
    loadHubData,
    pollNotifications,
    clearData,
  ]);

  // Zonas efectivas por dispositivo = asignación local (celular) ∪ las que
  // provea el hub/mock. El hub real no expone zonas; se asignan en la app.
  const effectiveZonesByDevice = useMemo(() => {
    const map = new Map<string, readonly string[]>();
    devices.forEach((device) => {
      const local = zoneAssignments[zoneAssignmentKey(hubHash, device.id)] ?? [];
      map.set(device.id, mergeDeviceZones(local, device.zones));
    });
    return map;
  }, [devices, zoneAssignments, hubHash]);

  const availableZones = useMemo(() => {
    const zones = new Set<string>();
    effectiveZonesByDevice.forEach((deviceZones) =>
      deviceZones.forEach((zone) => zones.add(zone))
    );
    return Array.from(zones).sort();
  }, [effectiveZonesByDevice]);

  const filteredDevices = useMemo(() => {
    const byType =
      filter === "sensores"
        ? devices.filter((device) => device.type === "sensor")
        : filter === "actuadores"
          ? devices.filter((device) => device.type === "actuator")
          : devices;

    if (selectedZones.length === 0) {
      return byType;
    }

    const zoneSet = new Set(selectedZones);
    return byType.filter((device) =>
      (effectiveZonesByDevice.get(device.id) ?? []).some((zone) =>
        zoneSet.has(zone)
      )
    );
  }, [devices, filter, selectedZones, effectiveZonesByDevice]);

  const sensorVisuals = useMemo(() => {
    const map = new Map<string, SensorRangeVisual | null>();
    devices.forEach((device) => {
      if (device.type === "sensor") {
        map.set(device.id, getSensorRangeVisual(device, config, actual));
      }
    });
    return map;
  }, [devices, config, actual]);

  const relayByAddress = useMemo(() => {
    const map = new Map<number, RelayState>();
    relays.forEach((relay) => map.set(relay.address, relay));
    return map;
  }, [relays]);

  const activeAlarmCount = useMemo(
    () => alarms.filter((a) => a.status === "active").length,
    [alarms]
  );

  const overallState = useMemo(() => {
    let badCount = 0;
    let warnCount = 0;
    sensorVisuals.forEach((visual) => {
      if (!visual) return;
      const state = semaforo(visual.current, visual.min, visual.max).state;
      if (state === "bad") badCount += 1;
      else if (state === "warn") warnCount += 1;
    });
    const totalBadCount = badCount + activeAlarmCount;
    const state: SemaforoState =
      totalBadCount > 0 ? "bad" : warnCount > 0 ? "warn" : "ok";
    return { state, badCount: totalBadCount, warnCount };
  }, [sensorVisuals, activeAlarmCount]);

  const handleDevicePress = useCallback(
    (device: Device) => {
      if (device.type === "sensor") {
        navigation.navigate("SensorDetail", {
          hubHash,
          sensorId: device.id,
        });
      } else if (device.relayAddress != null) {
        navigation.navigate("ActuatorDetail", {
          hubHash,
          relayAddress: device.relayAddress,
        });
      }
    },
    [navigation, hubHash]
  );

  const handleAlarmSummaryPress = useCallback(() => {
    navigation.navigate("Alarms", { hubHash });
  }, [navigation, hubHash]);

  const sections = useMemo(() => {
    type Item =
      | { kind: "section"; key: string; label: string }
      | { kind: "device"; key: string; device: Device };

    const sensors = filteredDevices.filter((d) => d.type === "sensor");
    const actuators = filteredDevices.filter((d) => d.type === "actuator");
    const items: Item[] = [];
    if (sensors.length > 0 && filter !== "actuadores") {
      items.push({
        kind: "section",
        key: "sec-sensors",
        label: "Mediciones",
      });
      sensors.forEach((d) =>
        items.push({ kind: "device", key: d.id, device: d })
      );
    }
    if (actuators.length > 0 && filter !== "sensores") {
      items.push({
        kind: "section",
        key: "sec-actuators",
        label: "Actuadores",
      });
      actuators.forEach((d) =>
        items.push({ kind: "device", key: d.id, device: d })
      );
    }
    return items;
  }, [filteredDevices, filter]);

  const zonesButtonDisabled = availableZones.length === 0;
  const zonesButtonLabel =
    selectedZones.length > 0 ? `Zonas (${selectedZones.length})` : "Zonas";

  if (!hub) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Hub no encontrado</Text>
        <Text
          style={styles.linkText}
          onPress={() => navigation.navigate("HubList")}
        >
          Volver al listado
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Cargando datos del hub...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={sections}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => {
          if (item.kind === "section") {
            return <SectionHeader label={item.label} />;
          }
          const device = item.device;
          const visual = sensorVisuals.get(device.id) ?? null;
          const relay =
            device.type === "actuator" && device.relayAddress != null
              ? (relayByAddress.get(device.relayAddress) ?? null)
              : null;
          return (
            <View style={styles.deviceWrap}>
              <DeviceListItem
                device={device}
                sensorVisual={visual}
                relay={relay}
                onPress={handleDevicePress}
              />
            </View>
          );
        }}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <HubStatusBanner
              state={overallState.state}
              badCount={overallState.badCount}
              warnCount={overallState.warnCount}
              onPress={
                activeAlarmCount > 0 ? handleAlarmSummaryPress : undefined
              }
            />
            <View testID="hub-home-filters-row" style={styles.filtersRow}>
              <DeviceFilter active={filter} onChange={setFilter} />
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Filtrar por zonas"
                accessibilityState={{
                  selected: selectedZones.length > 0,
                  disabled: zonesButtonDisabled,
                }}
                style={[
                  styles.zonesBtn,
                  selectedZones.length > 0 && styles.zonesBtnActive,
                  zonesButtonDisabled && styles.zonesBtnDisabled,
                ]}
                onPress={() => setZoneSheetVisible(true)}
                disabled={zonesButtonDisabled}
                activeOpacity={0.85}
              >
                <IcoZona
                  size={18}
                  color={
                    selectedZones.length > 0 ? "#fff" : COLORS.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.zonesBtnText,
                    selectedZones.length > 0 && styles.zonesBtnTextActive,
                    zonesButtonDisabled && styles.zonesBtnTextDisabled,
                  ]}
                >
                  {zonesButtonLabel}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              No hay dispositivos {filter !== "todos" ? `de tipo "${filter}"` : ""}
              {selectedZones.length > 0 ? " en las zonas seleccionadas" : ""}
            </Text>
          </View>
        }
        contentContainerStyle={styles.list}
      />

      <ZoneFilterSheet
        visible={zoneSheetVisible}
        availableZones={availableZones}
        selectedZones={selectedZones}
        onChange={setSelectedZones}
        onClose={() => setZoneSheetVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.error,
    textAlign: "center",
  },
  linkText: {
    marginTop: 16,
    fontSize: 15,
    color: COLORS.primary,
    fontWeight: "600",
  },
  list: {
    paddingBottom: 32,
  },
  headerWrap: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
    gap: 12,
  },
  deviceWrap: {
    paddingHorizontal: 16,
    marginTop: 12,
  },
  filtersRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  zonesBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  zonesBtnActive: {
    backgroundColor: COLORS.primary,
  },
  zonesBtnDisabled: {
    opacity: 0.4,
  },
  zonesBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
  zonesBtnTextActive: {
    color: "#fff",
  },
  zonesBtnTextDisabled: {
    color: COLORS.textDisabled,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textMuted,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    paddingHorizontal: 16,
    marginTop: 18,
    marginBottom: 4,
  },
  empty: {
    alignItems: "center",
    padding: 32,
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
});
