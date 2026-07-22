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
  subscribeToMessages,
} from "./src/services/unifiedPushService";
import { parseAlarmFromPushText } from "./src/services/hubApi/alarmsParser";

export default function App() {
  useEffect(() => {
    // 1. Solicitar permisos de notificación al SO
    void requestNotificationPermissions();

    // 2. Inicializar UnifiedPush con los hubs configurados
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

    // 3. Suscribirse a mensajes Push recibidos con la app en primer plano
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
