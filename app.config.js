// app.config.js — reemplaza app.json para poder referenciar el plugin
// expo-unified-push con el renderer Kotlin personalizado.
/** @type {import('expo/config').ExpoConfig} */
module.exports = {
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
        // Renderer Kotlin personalizado que parsea el formato JSON de ntfy.sh.
        // Este archivo vive en modules/ntfy-push-renderer/ y sobrevive a
        // `expo prebuild --clean`.
        payloadRendererClass: "com.libreagro.NtfyPushPayloadRenderer",
      },
    ],
  ],
};
