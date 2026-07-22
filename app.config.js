// app.config.js — Configuración Expo con plugin para expo-unified-push,
// renderer Kotlin personalizado y exportación del servicio nativo para Android.

const { withAndroidManifest } = require("@expo/config-plugins");

/**
 * Plugin personalizado que asegura que ExpoUPService tenga `android:exported="true"`
 * y `tools:replace="android:exported"`.
 *
 * Sin `android:exported="true"`, el SO Android bloquea los Intents enviados por
 * aplicaciones externas como ntfy (distribuidor UnifiedPush).
 * `tools:replace="android:exported"` resuelve el conflicto con el manifest interno de expo-unified-push.
 */
function withExportedUnifiedPushService(config) {
  return withAndroidManifest(config, (config) => {
    // Asegurar namespace tools en la etiqueta manifest root
    config.modResults.manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";

    const mainApplication = config.modResults.manifest.application[0];
    const services = mainApplication.service || [];

    const upService = services.find(
      (s) => s.$ && s.$["android:name"] === "dev.djara.expounifiedpush.ExpoUPService"
    );

    if (upService && upService.$) {
      upService.$["android:exported"] = "true";
      upService.$["tools:replace"] = "android:exported";
    } else {
      mainApplication.service = mainApplication.service || [];
      mainApplication.service.push({
        $: {
          "android:name": "dev.djara.expounifiedpush.ExpoUPService",
          "android:exported": "true",
          "tools:replace": "android:exported",
        },
        "intent-filter": [
          {
            action: [
              {
                $: {
                  "android:name": "org.unifiedpush.android.connector.PUSH_EVENT",
                },
              },
            ],
          },
        ],
      });
    }

    return config;
  });
}

/** @type {import('expo/config').ExpoConfig} */
const config = {
  name: "libreagro-app",
  slug: "libreagro-app",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  ios: {
    supportsTablet: true,
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: "com.anonymous.libreagroapp",
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    [
      "expo-build-properties",
      {
        android: {
          usesCleartextTraffic: true,
        },
      },
    ],
    [
      "expo-unified-push",
      {
        payloadRendererClass: "com.libreagro.NtfyPushPayloadRenderer",
      },
    ],
    withExportedUnifiedPushService,
  ],
};

module.exports = config;
