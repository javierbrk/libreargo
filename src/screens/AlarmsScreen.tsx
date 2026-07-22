import { useCallback, useMemo, useState, useEffect } from "react";
import { View, FlatList, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { COLORS } from "../constants";
import { useHubDataStore } from "../stores/hubDataStore";
import { useHubStore } from "../stores/hubStore";
import { AlarmCard } from "../components/AlarmCard";
import { NtfySubscribeSheet } from "../components";
import { IcoAlerta, IcoCampana } from "../components/icons";
import { openNtfySubscriptionForHub } from "../services/notifyApi/ntfyDeepLink";
import { getHubNotifyTopic } from "../services/notifyApi/topic";
import type { RootStackParamList } from "../navigation/types";
import {
  checkUnifiedPushStatus,
  initUnifiedPush,
  sendTestPushNotification,
  type UnifiedPushStatus,
} from "../services/unifiedPushService";
import { scheduleLocalNotification } from "../services/localNotifications";
import { parseAlarmFromPushText } from "../services/hubApi/alarmsParser";

type Props = NativeStackScreenProps<RootStackParamList, "Alarms">;

type AlarmTab = "active" | "history";

const TAB_LABEL: Record<AlarmTab, string> = {
  active: "Activas",
  history: "Historial",
};

export function AlarmsScreen({ route }: Props) {
  const alarms = useHubDataStore((s) => s.alarms);
  const config = useHubDataStore((s) => s.config);
  const hub = useHubStore((s) =>
    s.hubs.find((h) => h.hash === route.params.hubHash)
  );
  const hubs = useHubStore((s) => s.hubs);

  const [tab, setTab] = useState<AlarmTab>("active");
  const [installSheetVisible, setInstallSheetVisible] = useState(false);
  const [upStatus, setUpStatus] = useState<UnifiedPushStatus>("not_android");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    setUpStatus(checkUnifiedPushStatus());
  }, []);

  const handleActivateNotifications = useCallback(async () => {
    if (!hub) return;
    void initUnifiedPush(hubs);
    setUpStatus(checkUnifiedPushStatus());
    const opened = await openNtfySubscriptionForHub(hub);
    if (!opened) {
      setInstallSheetVisible(true);
    }
  }, [hub, hubs]);

  const handleRetryFromSheet = useCallback(async () => {
    if (!hub) return;
    void initUnifiedPush(hubs);
    setUpStatus(checkUnifiedPushStatus());
    const opened = await openNtfySubscriptionForHub(hub);
    if (opened) {
      setInstallSheetVisible(false);
    }
  }, [hub, hubs]);

  const handleSendTestPush = useCallback(async () => {
    if (!hub) return;
    setTestSending(true);
    setTestResult(null);
    const topic = getHubNotifyTopic(hub);
    const ok = await sendTestPushNotification(
      topic,
      "[T] temperature too high: 39.8 min:18 max:38 (Test Push LibreAgro)"
    );
    setTestSending(false);
    if (ok) {
      setTestResult("✅ Push de prueba enviado a ntfy.sh. Revisa la barra de estado.");
    } else {
      setTestResult("❌ Error al enviar push de prueba a ntfy.sh.");
    }
  }, [hub]);

  const handleSendTestLocal = useCallback(async () => {
    const testAlarm = parseAlarmFromPushText(
      "[T] temperature too low: 16.5 min:18 max:38 (Prueba Local)",
      hub?.name ?? "Prueba"
    );
    useHubDataStore.getState().addAlarm(testAlarm);
    await scheduleLocalNotification(
      `⚠️ Alarma — ${hub?.name ?? "LibreAgro"}`,
      testAlarm.message ?? "Prueba de alarma"
    );
    setTestResult("✅ Alarma agregada y notificación local emitida.");
  }, [hub]);

  const sorted = useMemo(
    () =>
      [...alarms].sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ),
    [alarms]
  );

  const activeCount = useMemo(
    () => sorted.filter((a) => a.status === "active").length,
    [sorted]
  );

  const visible = useMemo(
    () =>
      tab === "active"
        ? sorted.filter((a) => a.status === "active")
        : sorted.filter((a) => a.status !== "active"),
    [sorted, tab]
  );

  const handleAcknowledge = useCallback((id: string) => {
    useHubDataStore.setState((state) => ({
      alarms: state.alarms.map((a) =>
        a.id === id ? { ...a, status: "acknowledged" as const } : a
      ),
    }));
  }, []);

  const bannerActive = activeCount > 0;
  const topic = hub ? getHubNotifyTopic(hub) : "";

  return (
    <View style={styles.container}>
      <FlatList
        data={visible}
        keyExtractor={(alarm) => alarm.id}
        renderItem={({ item }) => (
          <AlarmCard
            alarm={item}
            config={config}
            onAcknowledge={handleAcknowledge}
          />
        )}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            {bannerActive && (
              <View
                accessibilityRole="summary"
                accessibilityLabel={`${activeCount} alarmas activas necesitan tu atención`}
                style={[styles.banner, { backgroundColor: COLORS.error }]}
              >
                <View style={styles.bannerIcon}>
                  <IcoAlerta size={56} color="#fff" />
                </View>
                <View style={styles.bannerText}>
                  <Text style={styles.bannerTitle} numberOfLines={1} adjustsFontSizeToFit>
                    {activeCount === 1 ? "1 activa" : `${activeCount} activas`}
                  </Text>
                  <Text style={styles.bannerSubtitle}>Necesitan tu atención</Text>
                </View>
              </View>
            )}

            <View style={styles.tabs}>
              {(Object.keys(TAB_LABEL) as AlarmTab[]).map((key) => {
                const on = tab === key;
                const label =
                  key === "active"
                    ? `${TAB_LABEL[key]} (${activeCount})`
                    : TAB_LABEL[key];
                return (
                  <TouchableOpacity
                    key={key}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => setTab(key)}
                    activeOpacity={0.85}
                    style={[styles.tab, on && styles.tabActive]}
                  >
                    <Text
                      style={[styles.tabText, on && styles.tabTextActive]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Tarjeta de vinculación con ntfy / UnifiedPush */}
            {hub && (
              <View style={styles.pushCard}>
                <View style={styles.pushHeader}>
                  <IcoCampana size={22} color={COLORS.primary} />
                  <View style={styles.pushHeaderText}>
                    <Text style={styles.pushTitle}>Notificaciones Push (ntfy + UnifiedPush)</Text>
                    <Text style={styles.pushSubtitle}>
                      Topic: <Text style={styles.codeText}>{topic}</Text>
                    </Text>
                  </View>
                </View>

                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Estado del distribuidor:</Text>
                  <Text style={styles.statusValue}>
                    {upStatus === "ntfy_ready"
                      ? "🟢 ntfy activo"
                      : upStatus === "ntfy_missing"
                        ? "🔴 ntfy no instalado"
                        : upStatus === "no_distributor"
                          ? "🟡 Sin configurar"
                          : "⚪ No soportado"}
                  </Text>
                </View>

                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Activar notificaciones"
                  onPress={handleActivateNotifications}
                  style={styles.actionBtn}
                  activeOpacity={0.85}
                >
                  <Text style={styles.actionBtnText}>
                    {upStatus === "ntfy_ready" ? "Re-vincular ntfy" : "Activar"}
                  </Text>
                </TouchableOpacity>

                {/* Herramientas de verificación */}
                <View style={styles.testSection}>
                  <Text style={styles.testTitle}>🛠️ Diagnóstico y Verificación:</Text>
                  <View style={styles.testBtnRow}>
                    <TouchableOpacity
                      onPress={handleSendTestPush}
                      disabled={testSending}
                      style={[styles.testBtn, styles.testBtnPrimary]}
                    >
                      {testSending ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.testBtnText}>📤 Probar Push Real (ntfy.sh)</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={handleSendTestLocal}
                      style={[styles.testBtn, styles.testBtnSecondary]}
                    >
                      <Text style={styles.testBtnSecondaryText}>🔔 Probar Local</Text>
                    </TouchableOpacity>
                  </View>

                  {testResult && (
                    <Text style={styles.testResultText}>{testResult}</Text>
                  )}
                </View>
              </View>
            )}
          </View>
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {tab === "active"
                ? "No hay alarmas activas"
                : "Sin historial de alarmas"}
            </Text>
          </View>
        }
      />
      <NtfySubscribeSheet
        visible={installSheetVisible}
        topic={topic}
        onRetry={handleRetryFromSheet}
        onClose={() => setInstallSheetVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  list: {
    paddingBottom: 24,
  },
  headerWrap: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
    gap: 14,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    borderRadius: 22,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  bannerIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerText: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.4,
  },
  bannerSubtitle: {
    fontSize: 15,
    fontWeight: "500",
    color: "rgba(255,255,255,0.95)",
    marginTop: 6,
  },
  tabs: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
  },
  tab: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },
  tabText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: "#fff",
  },
  pushCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 16,
    gap: 12,
    elevation: 1,
  },
  pushHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  pushHeaderText: {
    flex: 1,
  },
  pushTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
  },
  pushSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  codeText: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontWeight: "600",
    color: COLORS.primary,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  statusLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  statusValue: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
  },
  actionBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  testSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
    marginTop: 4,
    gap: 8,
  },
  testTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
  testBtnRow: {
    flexDirection: "row",
    gap: 8,
  },
  testBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  testBtnPrimary: {
    backgroundColor: COLORS.primarySoft ?? "#E8F5E9",
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  testBtnText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  testBtnSecondary: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  testBtnSecondaryText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  testResultText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.text,
    marginTop: 4,
  },
  empty: {
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
});
