import { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  Alert,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  COLORS,
  TOGGLE_THROTTLE_MS,
  ACTUATOR_VERIFY_DELAY_MS,
  ACTUATOR_VERIFY_TIMEOUT_MS,
} from "../constants";
import { useHubDataStore } from "../stores/hubDataStore";
import { toggleRelay } from "../services/hubDataService";
import { useHubStore } from "../stores/hubStore";
import {
  useZoneStore,
  zoneAssignmentKey,
  mergeDeviceZones,
} from "../stores/zoneStore";
import { resolveHubTarget } from "../services/connectivity";
import { Card, IconBadge, ZonaPill, BigButton } from "../components/ui";
import { ZoneAssignSheet } from "../components/ZoneAssignSheet";
import { IcoPower, IcoZona } from "../components/icons";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "ActuatorDetail">;

interface ChannelControlProps {
  readonly channel: number;
  readonly commandState: boolean;
  readonly inputState: boolean;
  readonly disabled: boolean;
  readonly verifying: boolean;
  readonly onToggle: () => void;
}

function ChannelControl({
  channel,
  commandState,
  inputState,
  disabled,
  verifying,
  onToggle,
}: ChannelControlProps) {
  const hasDiscrepancy = !verifying && commandState !== inputState;
  const on = commandState;
  const bg = on ? COLORS.actuatorSoft : "#EEEAE0";
  const fg = on ? COLORS.actuator : COLORS.actuatorOff;

  return (
    <Card style={styles.channelCard}>
      <View style={styles.channelHero}>
        <IconBadge bg={bg} size={120}>
          <IcoPower size={84} color={fg} />
        </IconBadge>
        <Text style={styles.channelTitle}>Canal {channel + 1}</Text>
        <View style={[styles.statePill, { backgroundColor: fg }]}>
          <Text style={styles.statePillText}>
            {on ? "ENCENDIDO" : "APAGADO"}
          </Text>
        </View>
      </View>

      {verifying && (
        <View style={styles.infoBanner}>
          <Text style={styles.infoText}>
            Verificando estado real del actuador…
          </Text>
        </View>
      )}

      {hasDiscrepancy && (
        <View style={styles.warnBanner}>
          <Text style={styles.warnText}>
            El estado real no coincide con el comando. Revisá el cableado.
          </Text>
        </View>
      )}

      <BigButton
        label={on ? "Apagar" : "Encender"}
        color={on ? COLORS.error : COLORS.primary}
        onPress={onToggle}
        disabled={disabled}
        accessibilityLabel={
          on ? `Apagar canal ${channel + 1}` : `Encender canal ${channel + 1}`
        }
      />
      {disabled && !verifying && (
        <Text style={styles.disabledHint}>
          Esperá unos segundos antes de volver a tocar.
        </Text>
      )}
    </Card>
  );
}

export function ActuatorDetailScreen({ route, navigation }: Props) {
  const { relayAddress } = route.params;
  const relay = useHubDataStore((s) =>
    s.relays.find((r) => r.address === relayAddress)
  );
  const hub = useHubStore((s) =>
    s.hubs.find((h) => h.hash === route.params.hubHash)
  );
  const connectionMode = useHubStore((s) => s.connectionMode);
  const zoneAssignments = useZoneStore((s) => s.assignments);
  const knownZones = useZoneStore((s) => s.knownZones);
  const setDeviceZones = useZoneStore((s) => s.setDeviceZones);
  const [zoneSheetVisible, setZoneSheetVisible] = useState(false);
  const assignmentKey = zoneAssignmentKey(
    route.params.hubHash,
    `relay-${relayAddress}`
  );
  const handleSaveZones = useCallback(
    (next: readonly string[]) => {
      setDeviceZones(assignmentKey, next);
    },
    [setDeviceZones, assignmentKey]
  );
  const [throttled, setThrottled] = useState(false);
  const [verifying, setVerifying] = useState<[boolean, boolean]>([false, false]);
  const throttleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verifyTimers = useRef<Array<ReturnType<typeof setTimeout> | null>>([
    null,
    null,
    null,
    null,
  ]);

  useEffect(() => {
    return () => {
      if (throttleTimer.current) clearTimeout(throttleTimer.current);
      verifyTimers.current.forEach((t) => {
        if (t) clearTimeout(t);
      });
    };
  }, []);

  const setVerifyingChannel = useCallback((ch: number, value: boolean) => {
    setVerifying((prev) => {
      const next: [boolean, boolean] = [prev[0], prev[1]];
      next[ch] = value;
      return next;
    });
  }, []);

  const handleToggle = useCallback(
    async (ch: number) => {
      if (!hub || !relay) return;

      setThrottled(true);
      setVerifyingChannel(ch, true);

      try {
        const target = resolveHubTarget(connectionMode, hub);
        const result = await toggleRelay(target, relayAddress, ch, connectionMode);
        if (result !== "OK") {
          throw new Error("Hub rechazó el comando");
        }

        // Canal 1: comando aplicado de forma optimista
        useHubDataStore.setState((state) => ({
          relays: state.relays.map((r) => {
            if (r.address !== relayAddress) return r;
            const newState: [boolean, boolean] = [r.state[0], r.state[1]];
            newState[ch] = !newState[ch];
            return { ...r, state: newState };
          }),
        }));

        // Canal 2: verificación diferida del estado real reportado por el hub
        const verifyIdx = ch * 2;
        verifyTimers.current[verifyIdx] = setTimeout(() => {
          useHubDataStore.setState((state) => ({
            relays: state.relays.map((r) => {
              if (r.address !== relayAddress) return r;
              const newInput: [boolean, boolean] = [
                r.input_state[0],
                r.input_state[1],
              ];
              newInput[ch] = r.state[ch];
              return { ...r, input_state: newInput };
            }),
          }));
          setVerifyingChannel(ch, false);
        }, ACTUATOR_VERIFY_DELAY_MS);

        // Timeout de seguridad: si tras la ventana sigue sin verificar, alerta
        verifyTimers.current[verifyIdx + 1] = setTimeout(() => {
          const current = useHubDataStore
            .getState()
            .relays.find((r) => r.address === relayAddress);
          if (current && current.state[ch] !== current.input_state[ch]) {
            setVerifyingChannel(ch, false);
            Alert.alert(
              "Estado no confirmado",
              "El hub no devolvió el estado real del canal a tiempo."
            );
          }
        }, ACTUATOR_VERIFY_TIMEOUT_MS);
      } catch {
        setVerifyingChannel(ch, false);
        Alert.alert(
          "Error",
          "No se pudo ejecutar el comando. Verificá la conexión."
        );
      } finally {
        throttleTimer.current = setTimeout(() => {
          setThrottled(false);
        }, TOGGLE_THROTTLE_MS);
      }
    },
    [hub, relay, relayAddress, connectionMode, setVerifyingChannel]
  );

  if (!relay) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Actuador no encontrado</Text>
        <Text style={styles.link} onPress={() => navigation.goBack()}>
          Volver
        </Text>
      </View>
    );
  }

  const zones = mergeDeviceZones(
    zoneAssignments[assignmentKey] ?? [],
    relay.zones ?? []
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Card style={styles.infoCard}>
        <Text style={styles.alias}>{relay.alias}</Text>
        <Text style={styles.subtitle}>
          Dirección {relay.address} · {relay.active ? "Activo" : "Inactivo"}
        </Text>
        {zones.length > 0 && (
          <View style={styles.zonesRow}>
            {zones.map((z) => (
              <ZonaPill key={z} name={z} />
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

      {!relay.active && (
        <View style={styles.warnBanner}>
          <Text style={styles.warnText}>
            Este relé está inactivo o sin comunicación.
          </Text>
        </View>
      )}

      <ChannelControl
        channel={0}
        commandState={relay.state[0]}
        inputState={relay.input_state[0]}
        disabled={throttled || verifying[0] || !relay.active}
        verifying={verifying[0]}
        onToggle={() => handleToggle(0)}
      />
      <ChannelControl
        channel={1}
        commandState={relay.state[1]}
        inputState={relay.input_state[1]}
        disabled={throttled || verifying[1] || !relay.active}
        verifying={verifying[1]}
        onToggle={() => handleToggle(1)}
      />

      {zoneSheetVisible && (
        <ZoneAssignSheet
          visible
          deviceName={relay.alias}
          knownZones={knownZones}
          assignedZones={zones}
          onSave={handleSaveZones}
          onClose={() => setZoneSheetVisible(false)}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
    gap: 14,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: COLORS.background,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.error,
  },
  link: {
    marginTop: 16,
    fontSize: 15,
    color: COLORS.primary,
    fontWeight: "700",
  },
  infoCard: {
    gap: 4,
  },
  alias: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
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
  warnBanner: {
    backgroundColor: COLORS.warningSoft,
    borderRadius: 14,
    padding: 14,
  },
  warnText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.warning,
  },
  infoBanner: {
    backgroundColor: COLORS.actuatorSoft,
    borderRadius: 14,
    padding: 14,
  },
  infoText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.actuator,
  },
  channelCard: {
    gap: 16,
  },
  channelHero: {
    alignItems: "center",
    gap: 12,
  },
  channelTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
  },
  statePill: {
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 999,
  },
  statePillText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  disabledHint: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: "center",
  },
});
