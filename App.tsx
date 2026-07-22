import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { MainStack, navigationRef } from "./src/navigation";
import { requestNotificationPermissions } from "./src/services/localNotifications";

export default function App() {
  useEffect(() => {
    void requestNotificationPermissions();
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
