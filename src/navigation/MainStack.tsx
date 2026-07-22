import { useState, useCallback } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { COLORS } from "../constants";
import { useHubStore } from "../stores/hubStore";
import {
  HubListScreen,
  HubHomeScreen,
  AlarmsScreen,
  SensorDetailScreen,
  ActuatorDetailScreen,
  CropsScreen,
  RecommendationsScreen,
} from "../screens";
import { HamburgerButton, MenuDrawer } from "../components";
import { IcoCampana } from "../components/icons";
import { TouchableOpacity, View } from "react-native";
import { useHubDataStore } from "../stores/hubDataStore";
import { navigate } from "./navigationRef";
import type { RootStackParamList } from "./types";
import type { Hub } from "../types";

const Stack = createNativeStackNavigator<RootStackParamList>();

type MenuKey =
  | "Inicio"
  | "Sensores"
  | "Actuadores"
  | "Alarmas"
  | "Cultivos"
  | "Recomendaciones";

export function MainStack() {
  const [menuVisible, setMenuVisible] = useState(false);

  const activeHub = useHubStore((state): Hub | null => {
    const hub = state.hubs.find((item) => item.hash === state.selectedHubHash);
    return hub && hub.status === "conectado" ? hub : null;
  });

  const openMenu = useCallback(() => setMenuVisible(true), []);
  const closeMenu = useCallback(() => setMenuVisible(false), []);

  const hamburgerButton = useCallback(
    () => <HamburgerButton onPress={openMenu} />,
    [openMenu]
  );

  const alarmCount = useHubDataStore((s) =>
    s.alarms.filter((a) => a.status === "active").length
  );

  const renderAlarmsButton = useCallback(
    (onPress: () => void) => (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={
          alarmCount > 0
            ? `Alarmas, ${alarmCount} activas`
            : "Alarmas, sin alarmas activas"
        }
        onPress={onPress}
        activeOpacity={0.7}
        style={{
          width: 44,
          height: 44,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <IcoCampana size={26} color="#fff" />
        {alarmCount > 0 && (
          <View
            accessibilityElementsHidden
            style={{
              position: "absolute",
              top: 8,
              right: 6,
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: COLORS.error,
              borderWidth: 2,
              borderColor: COLORS.primary,
            }}
          />
        )}
      </TouchableOpacity>
    ),
    [alarmCount]
  );

  const handleMenuSelect = useCallback(
    (key: MenuKey) => {
      switch (key) {
        case "Inicio":
          navigate("HubList");
          break;
        case "Cultivos":
          navigate("Crops");
          break;
        case "Recomendaciones":
          navigate("Recommendations");
          break;
        case "Sensores":
          if (activeHub) {
            navigate("HubHome", {
              hubHash: activeHub.hash,
              filter: "sensores",
            });
          }
          break;
        case "Actuadores":
          if (activeHub) {
            navigate("HubHome", {
              hubHash: activeHub.hash,
              filter: "actuadores",
            });
          }
          break;
        case "Alarmas":
          if (activeHub) {
            navigate("Alarms", { hubHash: activeHub.hash });
          }
          break;
      }
    },
    [activeHub]
  );

  return (
    <>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.primary },
          headerTintColor: COLORS.surface,
          headerTitleStyle: { fontWeight: "bold" },
          headerLeft: hamburgerButton,
          headerRight: () =>
            renderAlarmsButton(() => {
              const selected = activeHub ?? useHubStore.getState().hubs[0];
              if (selected) {
                navigate("Alarms", { hubHash: selected.hash });
              }
            }),
        }}
      >
        <Stack.Screen
          name="HubList"
          component={HubListScreen}
          options={{ title: "LibreAgro", headerLeft: undefined }}
        />
        <Stack.Screen
          name="HubHome"
          component={HubHomeScreen}
          options={({ route }) => ({
            title: "Hub",
            headerRight: () =>
              renderAlarmsButton(() =>
                navigate("Alarms", { hubHash: route.params.hubHash })
              ),
          })}
        />
        <Stack.Screen
          name="Alarms"
          component={AlarmsScreen}
          options={{ title: "Alarmas" }}
        />
        <Stack.Screen
          name="SensorDetail"
          component={SensorDetailScreen}
          options={{ title: "Detalle Sensor" }}
        />
        <Stack.Screen
          name="ActuatorDetail"
          component={ActuatorDetailScreen}
          options={{ title: "Detalle Actuador" }}
        />
        <Stack.Screen
          name="Crops"
          component={CropsScreen}
          options={{ title: "Cultivos" }}
        />
        <Stack.Screen
          name="Recommendations"
          component={RecommendationsScreen}
          options={{ title: "Recomendaciones" }}
        />
      </Stack.Navigator>
      <MenuDrawer
        visible={menuVisible}
        onClose={closeMenu}
        onSelect={handleMenuSelect}
        activeHub={activeHub}
      />
    </>
  );
}
