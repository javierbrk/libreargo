/**
 * Wrapper fino sobre expo-notifications para disparar notificaciones locales
 * del sistema operativo (banners, sonidos, icono en barra de estado).
 *
 * - Pide permisos la primera vez que se invoca requestPermissions().
 * - scheduleLocalNotification() es best-effort: si falla o los permisos no
 *   están concedidos, no lanza; solo descarta silenciosamente.
 * - Mock-safe: en entornos de test expo-notifications queda mockeado vía
 *   jest.setup.js y estas funciones no tienen efecto colateral.
 */

import * as Notifications from "expo-notifications";

// Comportamiento de las notificaciones mientras la app está en primer plano.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowList: true,
  }),
});

let permissionsGranted: boolean | null = null;

/**
 * Solicita el permiso de notificaciones al SO.
 * Guarda el resultado en memoria para no preguntar más de una vez por sesión.
 * Llamar al inicio de la app.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (permissionsGranted !== null) {
    return permissionsGranted;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    permissionsGranted = finalStatus === "granted";
  } catch {
    // En emulador/entorno sin permisos nativos disponibles, ignorar.
    permissionsGranted = false;
  }

  return permissionsGranted;
}

/**
 * Dispara una notificación local instantánea del SO.
 * No lanza si los permisos no están disponibles o si el dispositivo no los soporta.
 */
export async function scheduleLocalNotification(
  title: string,
  body: string
): Promise<void> {
  try {
    const granted = permissionsGranted ?? (await requestNotificationPermissions());
    if (!granted) {
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
      },
      trigger: null, // null = inmediata
    });
  } catch {
    // Best-effort: ignorar errores de notificaciones para no afectar la UI.
  }
}

/** Sólo para tests: resetear el estado de permisos cacheado. */
export function resetNotificationPermissionsForTests(): void {
  permissionsGranted = null;
}
