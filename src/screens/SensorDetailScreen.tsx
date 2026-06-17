import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { COLORS } from "../constants";
import {
  ACTUAL_KEY_MAP,
  LABEL_MAP,
  READING_KEY_MAP,
  UNIT_MAP,
} from "../features/sensors/sensorMeasurementCatalog";
import { getMeasurementRange } from "../features/sensors/getMeasurementRange";
import { useHubDataStore } from "../stores/hubDataStore";
import { useHubStore } from "../stores/hubStore";
import { getSensorHistory } from "../services/hubDataService";
import {
  useZoneStore,
  zoneAssignmentKey,
  mergeDeviceZones,
} from "../stores/zoneStore";
import { mockReadings } from "../mocks";
import type { RootStackParamList } from "../navigation/types";
import { Card, IconBadge, ZonaPill } from "../components/ui";
import { ZoneAssignSheet } from "../components/ZoneAssignSheet";
import { TimeSeriesChart, type TimeSeriesPoint } from "../components/TimeSeriesChart";
import { IcoZona } from "../components/icons";
import { getDeviceIcon } from "../components/icons/getDeviceIcon";
import { semaforo, type SemaforoState } from "../utils/semaforo";
import type { MeasurementKey } from "../features/sensors/sensorMeasurementCatalog";

type Props = NativeStackScreenProps<RootStackParamList, "SensorDetail">;

const STATE_HEADLINE: Record<SemaforoState, string> = {
  ok: "Todo bien",
  warn: "Atención",
  bad: "Fuera de rango",
};

const HISTORY_RANGES = [
  { label: "1h", range: "1h", bucket: "1m" },
  { label: "24h", range: "24h", bucket: "5m" },
  { label: "7d", range: "7d", bucket: "1h" },
] as const;

type HistoryRange = (typeof HISTORY_RANGES)[number];

interface HistoryRow {
  readonly timestamp: string;
  readonly value: number | null;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getSensorLabelFromId(sensorId: string): string {
  if (!sensorId.startsWith("sensor-")) {
    return sensorId.toUpperCase();
  }

  const lastDash = sensorId.lastIndexOf("-");
  if (lastDash <= "sensor-".length) {
    return sensorId.slice("sensor-".length).toUpperCase();
  }

  return sensorId.slice("sensor-".length, lastDash).toUpperCase();
}

function getInfluxField(
  measurementKey: MeasurementKey,
  subtype: string
): string {
  if (measurementKey === "temperature") return "temp";
  if (measurementKey === "co2") return "co2";
  if (measurementKey === "pressure") return "press";
  if (subtype === "capacitive" || subtype === "hd38") return "moisture";
  return "hum";
}

export function SensorDetailScreen({ route, navigation }: Props) {
  const { sensorId, hubHash } = route.params;
  const connectionMode = useHubStore((s) => s.connectionMode);
  const actual = useHubDataStore((s) => s.actual);
  const config = useHubDataStore((s) => s.config);
  const sensorDevice = useHubDataStore((s) =>
    s.devices.find((device) => device.id === sensorId && device.type === "sensor")
  );

  const zoneAssignments = useZoneStore((s) => s.assignments);
  const knownZones = useZoneStore((s) => s.knownZones);
  const setDeviceZones = useZoneStore((s) => s.setDeviceZones);
  const [zoneSheetVisible, setZoneSheetVisible] = useState(false);
  const [selectedRange, setSelectedRange] = useState<HistoryRange>(
    HISTORY_RANGES[1]
  );
  const [historyPoints, setHistoryPoints] = useState<readonly TimeSeriesPoint[]>(
    []
  );
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const measurementKey = sensorDevice?.sensorType ?? null;
  const measurementLabel = measurementKey ? LABEL_MAP[measurementKey] : null;
  const measurementRange = measurementKey
    ? getMeasurementRange(measurementKey, config)
    : null;
  const assignmentKey = zoneAssignmentKey(hubHash, sensorId);
  const zones = mergeDeviceZones(
    zoneAssignments[assignmentKey] ?? [],
    sensorDevice?.zones ?? []
  );

  const handleSaveZones = useCallback(
    (next: readonly string[]) => {
      setDeviceZones(assignmentKey, next);
    },
    [setDeviceZones, assignmentKey]
  );

  const errors = useMemo(() => {
    if (!actual) return [];
    const allErrors: string[] = [];
    if (actual.errors.temperature.length > 0) {
      allErrors.push(...actual.errors.temperature);
    }
    if (actual.errors.humidity.length > 0) {
      allErrors.push(...actual.errors.humidity);
    }
    if (actual.errors.sensors.length > 0) {
      allErrors.push(...actual.errors.sensors);
    }
    return allErrors;
  }, [actual]);

  useEffect(() => {
    if (connectionMode !== "online" || !measurementKey || !sensorDevice) {
      setHistoryPoints([]);
      setHistoryLoading(false);
      setHistoryError(null);
      return;
    }

    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError(null);

    void (async () => {
      try {
        const field = getInfluxField(measurementKey, sensorDevice.subtype);
        const points = await getSensorHistory(
          hubHash,
          field,
          selectedRange.range,
          selectedRange.bucket
        );
        if (!cancelled) {
          setHistoryPoints(points);
        }
      } catch {
        if (!cancelled) {
          setHistoryError("No se pudo cargar el histórico online");
          setHistoryPoints([]);
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [connectionMode, measurementKey, sensorDevice, hubHash, selectedRange]);

  const historyRows = useMemo<readonly HistoryRow[]>(() => {
    if (connectionMode === "online") {
      return historyPoints
        .slice()
        .reverse()
        .map((point) => ({
          timestamp: new Date(point.t * 1000).toISOString(),
          value: point.v,
        }));
    }
    if (!measurementKey) {
      return [];
    }
    const readingKey = READING_KEY_MAP[measurementKey];
    return mockReadings.slice(0, 15).map((item) => ({
      timestamp: item.timestamp,
      value:
        typeof item[readingKey] === "number"
          ? (item[readingKey] as number)
          : null,
    }));
  }, [connectionMode, historyPoints, measurementKey]);

  if (!actual) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Sin datos del sensor</Text>
        <Text style={styles.link} onPress={() => navigation.goBack()}>
          Volver
        </Text>
      </View>
    );
  }

  if (!sensorDevice || !measurementKey || !measurementLabel) {
    const unsupportedTitle = sensorDevice?.name ?? getSensorLabelFromId(sensorId);
    const unsupportedSubtype = sensorDevice?.subtype ?? "Sensor";

    return (
      <View style={styles.container}>
        <Card style={styles.padCard}>
          <Text style={styles.deviceName}>{unsupportedTitle}</Text>
          <Text style={styles.deviceSubtype}>{unsupportedSubtype}</Text>
        </Card>
        <Card style={[styles.padCard, styles.unsupportedCard]}>
          <Text style={styles.unsupportedTitle}>Sensor no soportado</Text>
          <Text style={styles.unsupportedBody}>
            Este dispositivo todavía no tiene una vista de detalle disponible.
          </Text>
          <Text style={styles.link} onPress={() => navigation.goBack()}>
            Volver
          </Text>
        </Card>
      </View>
    );
  }

  const Icon = getDeviceIcon(sensorDevice);
  const actualValue = Number.parseFloat(actual[ACTUAL_KEY_MAP[measurementKey]]);
  const hasValue = Number.isFinite(actualValue);
  const unit = UNIT_MAP[measurementKey] ?? "";
  const status = measurementRange
    ? semaforo(actualValue, measurementRange.min, measurementRange.max)
    : semaforo(null, 0, 1);
  const ratio =
    measurementRange && measurementRange.max > measurementRange.min
      ? (actualValue - measurementRange.min) /
        (measurementRange.max - measurementRange.min)
      : 0;
  const progress = Math.min(100, Math.max(0, ratio * 100));

  return (
    <View style={styles.container}>
      <FlatList
        data={historyRows}
        keyExtractor={(_, index) => String(index)}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <View
              style={[styles.heroCard, { backgroundColor: status.bg }]}
              accessibilityLabel={`${measurementLabel} ${hasValue ? actualValue.toFixed(1) : "sin dato"} ${unit}`}
            >
              <IconBadge bg="rgba(255,255,255,0.6)" size={120}>
                <Icon size={84} color={status.fg} />
              </IconBadge>
              <Text style={[styles.heroState, { color: status.fg }]}>
                {STATE_HEADLINE[status.state]}
              </Text>
              <View style={styles.heroValueRow}>
                <Text
                  style={[styles.heroValue, { color: status.fg }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {hasValue ? actualValue.toFixed(1) : "—"}
                </Text>
                <Text style={[styles.heroUnit, { color: status.fg }]}>
                  {unit}
                </Text>
              </View>
              <Text style={styles.heroLabel}>{measurementLabel}</Text>
            </View>

            {measurementRange && hasValue && (
              <Card style={styles.rangeCard}>
                <Text style={styles.rangeTitle}>Rango configurado</Text>
                <View style={styles.rangeBar}>
                  <View testID="sensor-range-marker-rail" style={styles.rangeRail}>
                    <View
                      testID="sensor-range-marker"
                      style={[
                        styles.rangeMarker,
                        {
                          left: `${progress}%`,
                          backgroundColor: status.fg,
                        },
                      ]}
                    />
                  </View>
                </View>
                <View style={styles.rangeBounds}>
                  <Text style={styles.rangeBound}>
                    {measurementRange.min.toFixed(1)}
                    {unit}
                  </Text>
                  <Text style={styles.rangeBound}>
                    {measurementRange.max.toFixed(1)}
                    {unit}
                  </Text>
                </View>
              </Card>
            )}

            <Card style={styles.padCard}>
              <Text style={styles.deviceName}>{sensorDevice.name}</Text>
              <Text style={styles.deviceSubtype}>{sensorDevice.subtype}</Text>
              {zones.length > 0 && (
                <View style={styles.zonesRow}>
                  {zones.map((zone) => (
                    <ZonaPill key={zone} name={zone} />
                  ))}
                </View>
              )}
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Editar zonas"
                style={styles.editZonesBtn}
                onPress={() => setZoneSheetVisible(true)}
                activeOpacity={0.85}
              >
                <IcoZona size={18} color={COLORS.primary} />
                <Text style={styles.editZonesText}>
                  {zones.length > 0 ? "Editar zonas" : "Asignar zonas"}
                </Text>
              </TouchableOpacity>
            </Card>

            {errors.length > 0 && (
              <Card style={[styles.padCard, styles.errorCard]}>
                <Text style={styles.errorTitle}>Errores activos</Text>
                {errors.map((error, index) => (
                  <Text key={`${error}-${index}`} style={styles.errorBody}>
                    {error}
                  </Text>
                ))}
              </Card>
            )}

            {connectionMode === "online" && (
              <Card style={styles.chartCard}>
                <View style={styles.chartHeader}>
                  <Text style={styles.rangeTitle}>Histórico online</Text>
                  <View style={styles.rangeTabs}>
                    {HISTORY_RANGES.map((item) => {
                      const active = item.label === selectedRange.label;
                      return (
                        <TouchableOpacity
                          key={item.label}
                          accessibilityRole="button"
                          accessibilityLabel={`Rango ${item.label}`}
                          accessibilityState={{ selected: active }}
                          style={[
                            styles.rangeTab,
                            active && styles.rangeTabActive,
                          ]}
                          onPress={() => setSelectedRange(item)}
                          activeOpacity={0.85}
                        >
                          <Text
                            style={[
                              styles.rangeTabText,
                              active && styles.rangeTabTextActive,
                            ]}
                          >
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
                {historyLoading ? (
                  <View style={styles.chartLoading}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  </View>
                ) : (
                  <TimeSeriesChart points={historyPoints} unit={unit} />
                )}
                {historyError && (
                  <Text style={styles.historyError}>{historyError}</Text>
                )}
              </Card>
            )}

            <Text style={styles.sectionTitle}>Histórico reciente</Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const value = item.value;
          const itemStatus =
            measurementRange && typeof value === "number"
              ? semaforo(value, measurementRange.min, measurementRange.max)
              : null;
          const isOutOfRange = itemStatus?.state === "bad";
          return (
            <View
              testID={
                isOutOfRange
                  ? `history-row-out-of-range-${index}`
                  : `history-row-${index}`
              }
              style={[
                styles.historyRow,
                itemStatus && { backgroundColor: itemStatus.bg },
              ]}
            >
              <Text style={styles.historyTime}>{formatTime(item.timestamp)}</Text>
              <Text
                style={[
                  styles.historyValue,
                  itemStatus && { color: itemStatus.fg },
                ]}
              >
                {typeof value === "number"
                  ? `${value.toFixed(1)}${unit}`
                  : "—"}
              </Text>
            </View>
          );
        }}
        contentContainerStyle={styles.listContent}
      />

      {zoneSheetVisible && (
        <ZoneAssignSheet
          visible
          deviceName={sensorDevice.name}
          knownZones={knownZones}
          assignedZones={zones}
          onSave={handleSaveZones}
          onClose={() => setZoneSheetVisible(false)}
        />
      )}
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
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.error,
  },
  link: {
    marginTop: 16,
    fontSize: 15,
    color: COLORS.primary,
    fontWeight: "600",
  },
  listContent: {
    paddingBottom: 32,
  },
  headerWrap: {
    padding: 16,
    gap: 16,
  },
  heroCard: {
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    gap: 14,
  },
  heroState: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  heroValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  heroValue: {
    fontSize: 84,
    fontWeight: "800",
    lineHeight: 88,
    letterSpacing: -2,
  },
  heroUnit: {
    fontSize: 32,
    fontWeight: "700",
  },
  heroLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  rangeCard: {
    gap: 12,
  },
  rangeTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textMuted,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  rangeBar: {
    height: 14,
    borderRadius: 999,
    backgroundColor: COLORS.divider,
    position: "relative",
  },
  rangeRail: {
    ...StyleSheet.absoluteFillObject,
    left: 9,
    right: 9,
  },
  rangeMarker: {
    position: "absolute",
    top: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    transform: [{ translateX: -9 }],
    borderWidth: 3,
    borderColor: "#fff",
  },
  rangeBounds: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  rangeBound: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
  chartCard: {
    gap: 12,
  },
  chartHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rangeTabs: {
    flexDirection: "row",
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 999,
    padding: 3,
  },
  rangeTab: {
    minWidth: 46,
    minHeight: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  rangeTabActive: {
    backgroundColor: COLORS.primary,
  },
  rangeTabText: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.textSecondary,
  },
  rangeTabTextActive: {
    color: "#fff",
  },
  chartLoading: {
    height: 172,
    alignItems: "center",
    justifyContent: "center",
  },
  historyError: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.error,
  },
  padCard: {
    gap: 4,
  },
  deviceName: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.text,
  },
  deviceSubtype: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  zonesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  editZonesBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: COLORS.primarySoft,
  },
  editZonesText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primaryDark,
  },
  unsupportedCard: {
    gap: 8,
  },
  unsupportedTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  unsupportedBody: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textSecondary,
  },
  errorCard: {
    backgroundColor: COLORS.errorSoft,
    gap: 4,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.error,
  },
  errorBody: {
    fontSize: 14,
    color: COLORS.error,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textMuted,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginTop: 8,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: COLORS.surface,
  },
  historyTime: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  historyValue: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
});
