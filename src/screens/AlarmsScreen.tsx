import { useCallback, useMemo, useState } from "react";
import { View, FlatList, Text, TouchableOpacity, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { COLORS } from "../constants";
import { useHubDataStore } from "../stores/hubDataStore";
import { useHubStore } from "../stores/hubStore";
import { AlarmCard } from "../components/AlarmCard";
import { NtfySubscribeSheet } from "../components";
import { IcoAlerta, IcoCampana, IcoCheck } from "../components/icons";
import { openNtfySubscriptionForHub } from "../services/notifyApi/ntfyDeepLink";
import { getHubNotifyTopic } from "../services/notifyApi/topic";
import type { RootStackParamList } from "../navigation/types";

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
  const [tab, setTab] = useState<AlarmTab>("active");
  const [installSheetVisible, setInstallSheetVisible] = useState(false);

  const handleActivateNotifications = useCallback(async () => {
    if (!hub) return;
    const opened = await openNtfySubscriptionForHub(hub);
    if (!opened) {
      setInstallSheetVisible(true);
    }
  }, [hub]);

  const handleRetryFromSheet = useCallback(async () => {
    if (!hub) return;
    const opened = await openNtfySubscriptionForHub(hub);
    if (opened) {
      setInstallSheetVisible(false);
    }
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
  const bannerColor = bannerActive ? COLORS.error : COLORS.success;
  const BannerIcon = bannerActive ? IcoAlerta : IcoCheck;

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
                <View
                    accessibilityRole="summary"
                    accessibilityLabel={
                      bannerActive
                          ? `${activeCount} alarmas activas necesitan tu atención`
                          : "Sin alarmas, todo funciona bien"
                    }
                    style={[styles.banner, { backgroundColor: bannerColor }]}
                >
                  <View style={styles.bannerIcon}>
                    <BannerIcon size={56} color="#fff" />
                  </View>
                  <View style={styles.bannerText}>
                    <Text style={styles.bannerTitle} numberOfLines={1} adjustsFontSizeToFit>
                      {bannerActive
                          ? activeCount === 1
                              ? "1 activa"
                              : `${activeCount} activas`
                          : "Sin alarmas"}
                    </Text>
                    <Text style={styles.bannerSubtitle}>
                      {bannerActive
                          ? "Necesitan tu atención"
                          : "Todo funciona bien"}
                    </Text>
                  </View>
                </View>
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
                {hub && (
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
                          Se abre la app ntfy para suscribirte
                        </Text>
                      </View>
                      <View style={styles.notifyCtaButton}>
                        <Text style={styles.notifyCtaButtonText}>Activar</Text>
                      </View>
                    </TouchableOpacity>
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
            topic={hub ? getHubNotifyTopic(hub) : ""}
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
  empty: {
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
});
