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
  getEndpointInfo,
  getRegisteredEndpoint,
  initUnifiedPush,
  markEndpointSynced,
  sendTestPushNotification,
  sendTestTopicNotification,
  type UnifiedPushStatus,
} from "../services/unifiedPushService";
import { scheduleLocalNotification } from "../services/localNotifications";
import { parseAlarmFromPushText } from "../services/hubApi/alarmsParser";
import { getSubscribersFromHub, registerPushEndpointWithHub } from "../services/hubDataService";
import { resolveHubTarget } from "../services/connectivity";

type Props = NativeStackScreenProps<RootStackParamList, "Alarms">;

type AlarmTab = "active" | "history" | "diagnostic";

const TAB_LABEL: Record<AlarmTab, string> = {
  active: "Activas",
  history: "Historial",
  diagnostic: "Diagnóstico",
};

export function AlarmsScreen({ route }: Props) {
  const alarms = useHubDataStore((s) => s.alarms);
  const config = useHubDataStore((s) => s.config);
  const hub = useHubStore((s) =>
    s.hubs.find((h) => h.hash === route.params.hubHash)
  );
  const hubs = useHubStore((s) => s.hubs);
  const connectionMode = useHubStore((s) => s.connectionMode);

  const [tab, setTab] = useState<AlarmTab>("active");
  const [installSheetVisible, setInstallSheetVisible] = useState(false);
  const [upStatus, setUpStatus] = useState<UnifiedPushStatus>("not_android");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Estado de suscriptores devueltos por el ESP32 (GET /api/notify/subscribers)
  const [espSubscribers, setEspSubscribers] = useState<readonly string[] | null>(null);
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);

  useEffect(() => {
    setUpStatus(checkUnifiedPushStatus());
  }, []);

  const handleFetchEspSubscribers = useCallback(async () => {
    if (!hub) return;
    setLoadingSubscribers(true);
    try {
      const target = resolveHubTarget(connectionMode, hub);
      const subs = await getSubscribersFromHub(target, connectionMode);
      setEspSubscribers(subs);
    } catch {
      setEspSubscribers([]);
    } finally {
      setLoadingSubscribers(false);
    }
  }, [hub, connectionMode]);

  useEffect(() => {
    if (tab === "diagnostic" && hub) {
      void handleFetchEspSubscribers();
    }
  }, [tab, hub, handleFetchEspSubscribers]);

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
    const res = await sendTestPushNotification(
      topic,
      "[T] temperature too high: 39.8 min:18 max:38 (Test Push LibreAgro)"
    );
    setTestSending(false);
    if (res.ok) {
      const modeText = res.isUnifiedPushEndpoint ? "Endpoint UP (Celular)" : "Topic ntfy.sh";
      setTestResult(`✅ Push enviado vía ${modeText}.\n${res.targetUrl}`);
    } else {
      setTestResult("❌ Error al enviar push de prueba.");
    }
  }, [hub]);

  const handleSendTestTopic = useCallback(async () => {
    if (!hub) return;
    setTestSending(true);
    setTestResult(null);
    const topic = getHubNotifyTopic(hub);
    const ok = await sendTestTopicNotification(
      topic,
      "[T] temperature too high: 39.8 (Test Topic Hub)"
    );
    setTestSending(false);
    if (ok) {
      setTestResult(`✅ Enviado a https://ntfy.sh/${topic}.\nntfy app recibirá el mensaje.`);
    } else {
      setTestResult("❌ Error al publicar en topic del hub.");
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

  const handleRegisterWithEsp = useCallback(async () => {
    if (!hub) return;
    const myEp = getRegisteredEndpoint(topic);
    if (!myEp) {
      setTestResult("⚠️ Esperando que ntfy genere el endpoint del celular...");
      return;
    }
    setTestSending(true);
    setTestResult(null);
    try {
      const target = resolveHubTarget(connectionMode, hub);
      const res = await registerPushEndpointWithHub(target, myEp, topic, connectionMode);
      
      const verboseReport = [
        res.ok
          ? `✅ HTTP ${res.status ?? 200} OK — Suscripto en ESP32`
          : `❌ HTTP ${res.status ?? "ERROR"} — Falló la suscripción`,
        `📍 URL: ${res.url}`,
        `📦 Body: ${res.requestBody}`,
        `💬 Respuesta ESP32: ${res.responseText ?? "(sin respuesta)"}`,
      ].join("\n");

      setTestResult(verboseReport);

      if (res.ok) {
        markEndpointSynced(topic);
        void handleFetchEspSubscribers();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      setTestResult(`❌ Error de comunicación:\n${msg}`);
    } finally {
      setTestSending(false);
    }
  }, [hub, topic, connectionMode, handleFetchEspSubscribers]);

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

  const visibleAlarms = useMemo(
    () =>
      tab === "active"
        ? sorted.filter((a) => a.status === "active")
        : tab === "history"
          ? sorted.filter((a) => a.status !== "active")
          : [],
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
  const myEndpoint = getRegisteredEndpoint(topic);
  const endpointInfo = getEndpointInfo(topic);
  const isMyPhoneSubscribed = Boolean(
    myEndpoint && espSubscribers?.includes(myEndpoint)
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={tab === "diagnostic" ? [] : visibleAlarms}
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

            {/* Pestañas: Activas, Historial, Diagnóstico */}
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

            {/* CTA de activación siempre visible cuando el hub existe */}
            {hub && tab !== "diagnostic" && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Activar notificaciones"
                onPress={handleActivateNotifications}
                style={styles.notifyCta}
                activeOpacity={0.85}
              >
                <View style={styles.notifyCtaIcon}>
                  <IcoCampana size={22} color={COLORS.primary} />
                </View>
                <View style={styles.notifyCtaText}>
                  <Text style={styles.notifyCtaTitle}>
                    Notificaciones con la app cerrada
                  </Text>
                  <Text style={styles.notifyCtaSubtitle}>
                    Vincular con la app ntfy
                  </Text>
                </View>
                <View style={styles.notifyCtaButton}>
                  <Text style={styles.notifyCtaButtonText}>Activar</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* PANEL DE DIAGNÓSTICO */}
            {tab === "diagnostic" && hub && (
              <View style={styles.diagnosticWrap}>
                {/* 1. Tarjeta Estado Distribuidor ntfy */}
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

                  {Boolean(myEndpoint) && (
                    <View style={styles.statusRow}>
                      <Text style={styles.statusLabel}>Endpoint UP:</Text>
                      <Text style={[styles.statusValue, styles.codeText]} numberOfLines={1}>
                        {myEndpoint}
                      </Text>
                    </View>
                  )}

                  {Boolean(endpointInfo?.hasChanged) && (
                    <View style={styles.changeAlert}>
                      <Text style={styles.changeAlertTitle}>⚠️ El Endpoint cambió</Text>
                      <Text style={styles.changeAlertText}>
                        Se generó un nuevo endpoint de notificaciones. Conéctate en modo Directo al hub para actualizar su registro.
                      </Text>
                    </View>
                  )}

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
                </View>

                {/* 2. Tarjeta Suscriptores Registrados en el ESP32 (GET /api/notify/subscribers) */}
                <View style={styles.pushCard}>
                  <View style={styles.pushHeader}>
                    <Text style={styles.pushTitle}>📡 Suscriptores Registrados en el ESP32</Text>
                  </View>

                  <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>Modo de conexión:</Text>
                    <Text style={styles.statusValue}>
                      {connectionMode === "directo" ? "Directo (192.168.4.1)" : "Online (Backend)"}
                    </Text>
                  </View>

                  {Boolean(myEndpoint) && (
                    <View style={styles.statusRow}>
                      <Text style={styles.statusLabel}>Estado de tu celular:</Text>
                      <Text style={styles.statusValue}>
                        {isMyPhoneSubscribed
                          ? "🟢 Registrado en ESP32"
                          : "🟡 Pendiente de registro"}
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    onPress={handleFetchEspSubscribers}
                    disabled={loadingSubscribers}
                    style={[styles.testBtn, styles.testBtnSecondary, { marginVertical: 4 }]}
                  >
                    {loadingSubscribers ? (
                      <ActivityIndicator size="small" color={COLORS.textSecondary} />
                    ) : (
                      <Text style={styles.testBtnSecondaryText}>🔄 Consultar suscriptores (GET /api/notify/subscribers)</Text>
                    )}
                  </TouchableOpacity>

                  {Boolean(myEndpoint) && (
                    <TouchableOpacity
                      onPress={handleRegisterWithEsp}
                      disabled={testSending}
                      style={[styles.actionBtn, { marginVertical: 4, backgroundColor: COLORS.primary }]}
                      activeOpacity={0.85}
                    >
                      {testSending ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.actionBtnText}>
                          ⚡ Registrar celular en ESP32 (POST /api/notify/subscribe)
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}

                  {espSubscribers !== null && (
                    <View style={styles.subscribersList}>
                      <Text style={styles.subscribersListTitle}>
                        Total suscriptores en ESP32: {espSubscribers.length}
                      </Text>

                      {espSubscribers.length === 0 ? (
                        <Text style={styles.subscribersEmptyText}>
                          Sin suscriptores guardados en el ESP32.
                        </Text>
                      ) : (
                        espSubscribers.map((sub, idx) => {
                          const isMine = sub === myEndpoint;
                          return (
                            <View key={`${sub}-${idx}`} style={styles.subscriberRow}>
                              <Text style={styles.subscriberText} numberOfLines={1}>
                                {sub}
                              </Text>
                              {isMine && (
                                <View style={styles.mineBadge}>
                                  <Text style={styles.mineBadgeText}>Este celular</Text>
                                </View>
                              )}
                            </View>
                          );
                        })
                      )}
                    </View>
                  )}
                </View>

                {/* 3. Tarjeta de Pruebas de Notificaciones */}
                <View style={styles.pushCard}>
                  <Text style={styles.testTitle}>🛠️ Herramientas de Prueba y Verificación:</Text>
                  <View style={styles.testBtnRow}>
                    <TouchableOpacity
                      onPress={handleSendTestPush}
                      disabled={testSending}
                      style={[styles.testBtn, styles.testBtnPrimary]}
                    >
                      {testSending ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.testBtnText}>📤 Probar UP (Celular)</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={handleSendTestTopic}
                      disabled={testSending}
                      style={[styles.testBtn, styles.testBtnSecondary]}
                    >
                      <Text style={styles.testBtnSecondaryText}>📢 Probar Topic Hub</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={handleSendTestLocal}
                      style={[styles.testBtn, styles.testBtnSecondary]}
                    >
                      <Text style={styles.testBtnSecondaryText}>🔔 Local</Text>
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
          tab === "diagnostic" ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {tab === "active"
                  ? "No hay alarmas activas"
                  : "Sin historial de alarmas"}
              </Text>
            </View>
          )
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
    paddingHorizontal: 16,
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
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: "#fff",
  },
  notifyCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    padding: 14,
    backgroundColor: COLORS.primarySoft,
  },
  notifyCtaIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  notifyCtaText: {
    flex: 1,
    minWidth: 0,
  },
  notifyCtaTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
  notifyCtaSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  notifyCtaButton: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
  },
  notifyCtaButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  diagnosticWrap: {
    gap: 12,
  },
  pushCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 16,
    gap: 10,
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
  changeAlert: {
    backgroundColor: "#FFF3E0",
    borderColor: "#FFE0B2",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  changeAlertTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#E65100",
  },
  changeAlertText: {
    fontSize: 12,
    color: "#EF6C00",
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
  subscribersList: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  subscribersListTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
  },
  subscribersEmptyText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: "italic",
  },
  subscriberRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    padding: 8,
    borderRadius: 8,
    gap: 8,
  },
  subscriberText: {
    flex: 1,
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: COLORS.text,
  },
  mineBadge: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  mineBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2E7D32",
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
