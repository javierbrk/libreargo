import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "../constants";
import type { Alarm, AlarmDataType, HubConfig } from "../types";
import { getMeasurementRange } from "../features/sensors/getMeasurementRange";
import { Card, IconBadge, ZonaPill, BigButton } from "./ui";
import {
  IcoTermometro,
  IcoGota,
  IcoCO2,
  IcoPresion,
  IcoReloj,
  IcoCheck,
  type IconProps,
} from "./icons";
import type { ComponentType } from "react";

const UNIT_MAP: Record<AlarmDataType, string> = {
  temperature: "°C",
  humidity: "%",
  co2: "ppm",
  pressure: "hPa",
};

const TYPE_LABEL: Record<AlarmDataType, string> = {
  temperature: "Temperatura",
  humidity: "Humedad",
  co2: "CO₂",
  pressure: "Presión",
};

const ICON_MAP: Record<AlarmDataType, ComponentType<IconProps>> = {
  temperature: IcoTermometro,
  humidity: IcoGota,
  co2: IcoCO2,
  pressure: IcoPresion,
};

interface AlarmCardProps {
  readonly alarm: Alarm;
  readonly config: HubConfig | null;
  readonly onAcknowledge: (id: string) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDate = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (sameDate(d, today)) return `Hoy ${time}`;
  if (sameDate(d, yesterday)) return `Ayer ${time}`;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${time}`;
}

export function AlarmCard({ alarm, config, onAcknowledge }: AlarmCardProps) {
  const unit = UNIT_MAP[alarm.dataType] ?? "";
  const typeLabel = TYPE_LABEL[alarm.dataType] ?? "";
  const Icon = ICON_MAP[alarm.dataType] ?? IcoTermometro;
  const isActive = alarm.status === "active";
  const range = getMeasurementRange(alarm.dataType, config);

  return (
    <Card
      style={[
        styles.card,
        isActive ? styles.cardActive : styles.cardInactive,
      ]}
    >
      <View style={styles.body}>
        <IconBadge
          bg={isActive ? COLORS.errorSoft : "#EEEAE0"}
          size={88}
        >
          <Icon
            size={60}
            color={isActive ? COLORS.error : COLORS.textMuted}
          />
        </IconBadge>
        <View style={styles.info}>
          <View style={styles.metaRow}>
            <IcoReloj size={16} color={COLORS.textMuted} />
            <Text style={styles.metaText}>{formatDate(alarm.timestamp)}</Text>
          </View>
          {typeLabel.length > 0 && (
            <Text style={styles.typeLabel}>{typeLabel}</Text>
          )}
          <View style={styles.valueRow}>
            <Text
              style={[
                styles.value,
                { color: isActive ? COLORS.error : COLORS.text },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {alarm.currentValue}
            </Text>
            <Text
              style={[
                styles.unit,
                { color: isActive ? COLORS.error : COLORS.textSecondary },
              ]}
            >
              {unit}
            </Text>
          </View>
          <Text style={styles.alertText}>
            Disparada en {alarm.alertValue}
            {unit}
          </Text>
          {range && (
            <Text style={styles.rangeText}>
              Rango: {range.min}–{range.max}
              {unit}
            </Text>
          )}
          {alarm.zones.length > 0 && (
            <View style={styles.zonesRow}>
              {alarm.zones.slice(0, 2).map((zone) => (
                <ZonaPill
                  key={zone}
                  name={zone}
                  tone={isActive ? "green" : "gray"}
                />
              ))}
            </View>
          )}
        </View>
      </View>
      {isActive && (
        <View style={styles.actionWrap}>
          <BigButton
            label="Lo vi / Entendido"
            icon={<IcoCheck size={28} color="#fff" />}
            onPress={() => onAcknowledge(alarm.id)}
            accessibilityLabel="Reconocer alarma"
          />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 0,
    overflow: "hidden",
  },
  cardActive: {
    borderWidth: 2,
    borderColor: COLORS.error,
  },
  cardInactive: {
    opacity: 0.85,
  },
  body: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 16,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  metaText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textMuted,
  },
  typeLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 4,
  },
  alertText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textMuted,
    marginTop: 4,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  value: {
    fontSize: 40,
    fontWeight: "800",
    lineHeight: 44,
    letterSpacing: -0.5,
  },
  unit: {
    fontSize: 20,
    fontWeight: "700",
  },
  rangeText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textMuted,
    marginTop: 6,
  },
  zonesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  actionWrap: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    gap: 10,
  },
});
