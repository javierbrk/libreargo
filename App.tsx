import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { MainStack, navigationRef } from "./src/navigation";
import {
  requestNotificationPermissions,
  scheduleLocalNotification,
} from "./src/services/localNotifications";
import { useHubStore } from "./src/stores/hubStore";
import { useHubDataStore } from "./src/stores/hubDataStore";
import {
  initUnifiedPush,
  onEndpointChange,
  subscribeToMessages,
  markEndpointSynced,
} from "./src/services/unifiedPushService";
import { parseAlarmFromPushText } from "./src/services/hubApi/alarmsParser";
import { getHubNotifyTopic } from "./src/services/notifyApi/topic";
import { resolveHubTarget } from "./src/services/connectivity";
import { registerPushEndpointWithHub, autoSyncPushEndpointWithHub } from "./src/services/hubDataService";

export default function App() {
  useEffect(() => {
    // 1. Solicitar permisos de notificación al SO
    void requestNotificationPermissions();

    // 2. Inicializar UnifiedPush con los hubs configurados en el celular
    const hubs = useHubStore.getState().hubs;
    if (hubs.length > 0) {
      void initUnifiedPush(hubs);
    }

    // Suscribirse a los cambios en el store de hubs para registrar nuevos hubs
    const unsubHubs = useHubStore.subscribe((state) => {
      if (state.hubs.length > 0) {
        void initUnifiedPush(state.hubs);
      }
    });

    // 3. Escuchar cuándo ntfy genera/actualiza el endpoint de un hub para suscribirlo al ESP32 automáticamente
    const unsubEndpoint = onEndpointChange((instance, record) => {
      const currentHubs = useHubStore.getState().hubs;
      const matchingHub = currentHubs.find(
        (h) =>
          getHubNotifyTopic(h) === instance ||
          h.hash.toLowerCase() === instance.replace("moni-", "").toLowerCase()
      );

      if (matchingHub && record.currentUrl) {
        const mode = useHubStore.getState().connectionMode;
        void autoSyncPushEndpointWithHub(matchingHub, mode);
      }
    });

    // 4. Suscribirse a mensajes Push recibidos con la app en primer plano
    const unsubPush = subscribeToMessages((instance, rawMessage) => {
      const alarm = parseAlarmFromPushText(rawMessage, instance);
      
      // Guardar la alarma en el store
      useHubDataStore.getState().addAlarm(alarm);

      // Disparar notificación local del SO
      void scheduleLocalNotification(
        `⚠️ Alarma — ${instance}`,
        alarm.message ?? "Alarma detectada"
      );
    });

    return () => {
      unsubHubs();
      unsubEndpoint();
      unsubPush();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef}>
        <MainStack />
      </NavigationContainer>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
