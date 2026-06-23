# LibreAgro App

App móvil (React Native + Expo SDK 54) para monitorear sensores y operar
actuadores (relés) de los hubs LibreAgro (ESP32). Se comunica directamente con
el hub vía HTTP/REST y, donde aplica, con backends externos.

- **Modo Directo**: Wi-Fi directo al hub (AP), IP fija `192.168.4.1`.
- **Modo Online**: a través de internet (hub en modo STA), contra el backend.

> El modo de conexión se elige con el switch del header. La IP del hub **no se
> descubre**: en Directo es fija (`192.168.4.1`); en Online el acceso va contra
> el backend identificado por el `hash` del hub.

---

## Requisitos

- Node 20+
- JDK 17 (para compilar Android)
- Android SDK (para builds locales) — el CI ya lo trae preinstalado
- No hace falta commitear `android/` ni `ios/`: se generan con `expo prebuild`.

## Instalar

```bash
npm ci
```

## Desarrollo

```bash
npm start            # expo start (Metro)
npm run android      # abre en Android
```

> En desarrollo la app usa **datos mock** por defecto (no necesita un hub real).
> Los servicios reales se activan solo en builds de release (ver más abajo).

## Notificaciones ntfy en Android (MVP)

Para notificaciones nativas/background, el MVP usa la app oficial de **ntfy**
instalada en el teléfono como distribuidor. El usuario debe instalar **LibreAgro**
y **ntfy**, y suscribir ntfy al topic del hub:

```
moni-<MAC_sin_dos_puntos>
```

Por ejemplo, para probar desde una terminal:

```bash
curl -d "[C] CO2 too high: 1200 max:900" https://ntfy.sh/moni-001122aabbcc
```

La app ntfy mantiene su conexión en background y muestra la notificación de
Android cuando llega un POST del ESP32, curl u otro publicador. LibreAgro no
registra por ahora un `BroadcastReceiver` nativo propio; en foreground, cuando
la pantalla del hub está montada y el modo es **Online**, LibreAgro consulta ntfy
periódicamente y agrega las alarmas de medición soportadas a la pantalla de
Alarmas.

En **Directo** no se consulta ntfy: el teléfono queda conectado al AP del hub y
no tiene salida a internet.

## Tests y tipos

```bash
npm test             # jest
npx tsc --noEmit     # chequeo de tipos
```

---

## Variables de entorno

Todas usan el prefijo `EXPO_PUBLIC_` (se inyectan en build time). Los valores
por defecto en el **código** son `mock`, por eso en desarrollo la app funciona
sin backend.

| Variable | Valores | Default | Qué controla |
|---|---|---|---|
| `EXPO_PUBLIC_HUB_DATA_BACKEND` | `mock` \| `http` | `mock` | `/config`, `/actual`, `/api/relays`, toggle, alarmas de `/actual.errors`, ping |
| `EXPO_PUBLIC_NOTIFY_BACKEND` | `mock` \| `http` | `mock` | Push de alarmas vía ntfy.sh |
| `EXPO_PUBLIC_NOTIFY_BASE_URL` | URL | `https://ntfy.sh` | Broker de ntfy |
| `EXPO_PUBLIC_RECOMMENDATIONS_BACKEND` | `mock` \| `http` | `mock` | Recomendaciones (`/messages`) |
| `EXPO_PUBLIC_RECOMMENDATIONS_BASE_URL` | URL | — | Base URL del backend de recomendaciones (cuando exista) |

### Carga por entorno (Expo)

- `expo start` (desarrollo) → **no** carga `.env.production` → la app usa **mocks**.
- Builds de **release** (`--variant release` / `assembleRelease`) → Expo carga
  [`.env.production`](.env.production), que ya trae los valores **sin mocks**.

Por eso un APK compilado en **debug** sale con mocks y **no se asocia al chip**.
Para probar con el hub real hay que usar un **APK release** (o descargar el del CI).

---

## Armar el APK (release, sin mocks)

El APK release queda **firmado con la debug keystore** del template de Expo, así
que es **instalable por sideload** (no apto para Play Store, sí para probar).

### Opción A — Descargarlo del CI (recomendado)

No requiere compilar localmente:

1. GitHub → pestaña **Actions** → última corrida de **CI** en `main`.
2. Sección **Artifacts** → descargar **`libreagro-directo-apk`**.
3. Descomprimir → `libreagro-directo.apk` → instalar en el teléfono.

En **releases por tag** (`v*`) el APK también queda adjunto en la página de
*Releases*.

### Opción B — Compilar localmente

```bash
npm ci
npx expo prebuild --platform android --no-install
cd android
./gradlew assembleRelease
```

APK resultante:

```
android/app/build/outputs/apk/release/app-release.apk
```

Atajo equivalente (compila e instala en un dispositivo conectado):

```bash
npx expo run:android --variant release
```

> **Importante:** usá siempre **release**. Un `expo run:android` sin
> `--variant release` compila en debug → **mocks** → no conecta con el chip.

---

## Integración continua (GitHub Actions)

Workflow: [`.github/workflows/ci.yml`](.github/workflows/ci.yml)

| Job | Cuándo | Qué hace |
|---|---|---|
| `test` | push y PR | `npm ci`, `tsc --noEmit`, `npm test` |
| `build-android` | push a `main`, tags `v*`, manual | `expo prebuild` + `gradlew assembleRelease` (env de release sin mocks) → sube APK como artifact; en tags adjunta el APK al Release |

### Publicar una release con APK

```bash
git tag v1.0.0
git push origin v1.0.0
```

El CI compila el APK y lo adjunta automáticamente al GitHub Release del tag.

---

## Estructura

```
src/
  components/        UI (incluye ZoneAssignSheet, AlarmCard, ...)
  screens/           pantallas (HubList, HubHome, SensorDetail, ActuatorDetail, Alarms, Crops, Recommendations)
  services/
    hubApi/          cliente del hub (mock | http) + adapters + parser de alarmas
    notifyApi/        cliente ntfy.sh (mock | http)
    recommendationsApi/ cliente de recomendaciones (mock | http)
    connectivity.ts  resuelve el target del hub según modo (Directo/Online)
    hubDataService.ts fachada que usan los stores
  stores/            estado (zustand): hubs, datos del hub, cultivos, zonas
  features/sensors/  catálogo y rangos de medición
  types/             modelos de dominio
```

Los clientes `mock | http` se seleccionan por variable de entorno, sin tocar las
pantallas. Cuando lleguen las URLs de los backends pendientes, solo cambia la
configuración (no el código de UI).
