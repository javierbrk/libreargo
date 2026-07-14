import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "../constants";
import type { Device, RelayState, SensorRangeVisual } from "../types";
import { Card, IconBadge, ZonaPill } from "./ui";
import { getDeviceIcon } from "./icons/getDeviceIcon";
import { IcoChevron } from "./icons";
import { semaforo, type SemaforoState } from "../utils/semaforo";

interface DeviceListItemProps {
  readonly device: Device;
  readonly sensorVisual?: SensorRangeVisual | null;
  readonly relay?: RelayState | null;
  readonly onPress: (device: Device) => void;
}

const MARKER_SIZE = 12;
const MARKER_RADIUS = MARKER_SIZE / 2;

const STATE_LABEL: Record<SemaforoState, string> = {
  ok: "todo bien",
  warn: "cerca del límite",
  bad: "fuera de rango",
};

function formatNumber(value: number, unit: string): string {
  if (Number.isInteger(value)) return `${value}${unit}`;
  return `${value.toFixed(1)}${unit}`;
}

// Nombre corto para mostrar bajo el ícono. Los nombres de sensor del hub
// ("Soil5") ya son cortos; los labels genéricos largos se abrevian.
const NAME_ABBREVIATIONS: Readonly<Record<string, string>> = {
  Temperatura: "Temp",
  Humedad: "Hum",
  Presión: "Pres",
};

function abbreviateName(name: string): string {
  return NAME_ABBREVIATIONS[name] ?? name;
}

function isRelayOn(relay: RelayState | null | undefined): boolean {
  if (!relay) return false;
  return relay.active && relay.state.some(Boolean);
}

export function DeviceListItem({
  device,
  sensorVisual,
  relay,
  onPress,
}: DeviceListItemProps) {
  const Icon = getDeviceIcon(device);
  const isSensor = device.type === "sensor";

  if (isSensor && sensorVisual) {
    const { min, max, current, unit } = sensorVisual;
    const status = semaforo(current, min, max);
    const ratio = max > min ? (current - min) / (max - min) : 0;
    const progress = Math.min(100, Math.max(0, ratio * 100));

    return (
      <Card
        onPress={() => onPress(device)}
        accessibilityLabel={`${device.name}: ${sensorVisual.label} ${formatNumber(current, unit)}, ${STATE_LABEL[status.state]}`}
        style={styles.row}
      >
        <View style={styles.iconCol}>
          <IconBadge bg={status.bg} size={96}>
            <Icon size={64} color={status.fg} />
          </IconBadge>
          <Text style={styles.iconName} numberOfLines={1}>
            {abbreviateName(device.name)}
          </Text>
        </View>
        <View style={styles.body}>
          <View style={styles.valueRow}>
            <Text
              style={[styles.value, { color: status.fg }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatNumber(current, "")}
            </Text>
            <Text style={styles.unit}>{unit}</Text>
          </View>
          <View style={styles.rangeWrap}>
            <View style={styles.track}>
              <View testID="sensor-range-marker-rail" style={styles.markerRail}>
                <View
                  testID="sensor-range-marker"
                  style={[
                    styles.marker,
                    { left: `${progress}%`, backgroundColor: status.fg },
                  ]}
                />
              </View>
            </View>
            <View style={styles.bounds}>
              <Text style={styles.bound}>{formatNumber(min, unit)}</Text>
              <Text style={styles.bound}>{formatNumber(max, unit)}</Text>
            </View>
          </View>
        </View>
        <IcoChevron size={28} color={COLORS.textMuted} />
      </Card>
    );
  }

  if (isSensor) {
    // Sensor without a range visual: show the icon + name only, no stale data.
    return (
      <Card
        onPress={() => onPress(device)}
        accessibilityLabel={device.name}
        style={styles.row}
      >
        <IconBadge bg={COLORS.surfaceAlt} size={88}>
          <Icon size={56} color={COLORS.textMuted} />
        </IconBadge>
        <View style={styles.body}>
          <Text style={styles.deviceName}>{device.name}</Text>
          {device.zones.length > 0 && (
            <View style={styles.zonesRow}>
              {device.zones.slice(0, 2).map((zone) => (
                <ZonaPill key={zone} name={zone} tone="gray" />
              ))}
            </View>
          )}
        </View>
        <IcoChevron size={28} color={COLORS.textMuted} />
      </Card>
    );
  }

  // --- Actuator ---
  const on = isRelayOn(relay);
  return (
    <Card
      onPress={() => onPress(device)}
      accessibilityLabel={`${device.name}, ${on ? "encendido" : "apagado"}`}
      style={styles.row}
    >
      <IconBadge bg={on ? COLORS.actuatorSoft : "#EEEAE0"} size={96}>
        <Icon size={64} color={on ? COLORS.actuator : COLORS.actuatorOff} />
      </IconBadge>
      <View style={styles.body}>
        <View
          style={[
            styles.statePill,
            { backgroundColor: on ? COLORS.actuator : COLORS.actuatorOff },
          ]}
        >
          <Text style={styles.statePillText}>
            {on ? "ENCENDIDO" : "APAGADO"}
          </Text>
        </View>
        {device.zones.length > 0 && (
          <View style={styles.zonesRow}>
            {device.zones.slice(0, 2).map((zone) => (
              <ZonaPill key={zone} name={zone} />
            ))}
          </View>
        )}
      </View>
      <IcoChevron size={28} color={COLORS.textMuted} />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 16,
  },
  iconCol: {
    alignItems: "center",
    width: 96,
  },
  iconName: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textSecondary,
    maxWidth: 96,
    textAlign: "center",
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  value: {
    fontSize: 44,
    fontWeight: "800",
    lineHeight: 48,
    letterSpacing: -1,
  },
  unit: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  rangeWrap: {
    marginTop: 12,
  },
  track: {
    height: 10,
    borderRadius: 999,
    backgroundColor: COLORS.divider,
    position: "relative",
  },
  markerRail: {
    ...StyleSheet.absoluteFillObject,
    left: MARKER_RADIUS,
    right: MARKER_RADIUS,
  },
  marker: {
    position: "absolute",
    top: -1,
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    borderRadius: MARKER_RADIUS,
    transform: [{ translateX: -MARKER_RADIUS }],
    borderWidth: 2,
    borderColor: "#fff",
  },
  bounds: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  bound: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textMuted,
  },
  deviceName: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  statePill: {
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
  },
  statePillText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  zonesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
});
