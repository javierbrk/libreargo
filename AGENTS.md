# Guía para agentes (Claude Code / Codex / etc.)

Contexto compartido para trabajar en **LibreAgro App** con asistentes de IA.
Aplica tanto a Claude Code como a otras herramientas que lean `AGENTS.md`.
(El archivo `CLAUDE.md` importa este mismo contenido.)

## Qué es

App React Native + **Expo SDK 54** (RN 0.81, React 19, New Architecture) que
monitorea sensores y opera relés de hubs LibreAgro (ESP32). Ver
[`README.md`](README.md) para detalle funcional y de build.

## Comandos

```bash
npm ci                 # instalar (usa package-lock.json)
npm start              # desarrollo (Metro) — usa MOCKS por defecto
npm test               # jest
npx tsc --noEmit       # chequeo de tipos
```

APK release (sin mocks) — ver README, sección "Armar el APK":

```bash
npx expo prebuild --platform android --no-install
cd android && ./gradlew assembleRelease
```

## Reglas de oro

1. **Mocks en dev, HTTP solo en release.** El default del código es `mock`. Los
   servicios reales se activan vía `EXPO_PUBLIC_*` en builds de release
   (cargadas desde [`.env.production`](.env.production)). **No** pongas valores
   `http` en `.env`/`.env.development` ni hardcodees URLs en el código: romperías
   el desarrollo mock-first.
2. **Respetá la capa de servicios `mock | http`.** Las pantallas/stores nunca
   conocen el transporte: van por `hubDataService` y los clientes en
   `services/*Api/`. Para conectar un backend nuevo, agregá la implementación
   HTTP detrás de la interfaz existente; no llames `fetch` desde la UI.
3. **Verificá antes de pushear:** `npx tsc --noEmit` y `npm test` en verde.
4. **Sin secretos en el repo.** Hoy no hay auth (hub ni ntfy), por eso
   `.env.production` se versiona. Si en el futuro hay tokens, van por
   variables/secrets del CI, nunca commiteados.
5. **Estilo:** TypeScript estricto, datos inmutables (spread, sin mutación),
   archivos chicos y enfocados, manejo explícito de errores. Sin `console.log`
   en código de producción.
6. **Tests:** este proyecto **no exige** TDD; escribí/actualizá tests solo si la
   tarea lo pide o si tu cambio rompe la suite. Si tocás algo cubierto, dejá la
   suite verde.
7. **NO implementar el "Posponer" / snooze de alarmas.** Está **fuera del MVP**
   (ver sección "Fuera de alcance"). No agregar botón, handler, estado `snoozed`
   ni `snoozedUntil` aunque parezca natural o lo sugiera un test viejo.

## Arquitectura (resumen)

- `services/hubApi/` — cliente del hub (`MockHubApiClient` | `HttpHubApiClient`),
  `adapters.ts` (validación de respuestas), `alarmsParser.ts` (alarmas derivadas
  de `/actual.errors` y de mensajes ntfy), `backend.ts` (selector por env).
- `services/notifyApi/` — push ntfy.sh (`/topic/json?poll=1`), mock | http.
- `services/recommendationsApi/` — `/messages` (GET/POST), mock | http.
- `services/connectivity.ts` — `resolveHubTarget(mode, hub)`: Directo → IP fija
  `192.168.4.1`; Online → `hash` (ruteo por backend, sin descubrir IP).
- `services/hubDataService.ts` — fachada única que usan los stores.
- `stores/` (zustand) — `hubStore`, `hubDataStore`, `cropStore`, `zoneStore`.

## Cosas específicas que conviene saber

- **`android/` e `ios/` son generados** (`expo prebuild`) y están en
  `.gitignore`. No los edites a mano ni los commitees.
- **APK release** queda firmado con la **debug keystore** del template Expo →
  instalable por sideload, no apto para Play Store.
- **Alarmas**: se derivan de `/actual.errors` (formato `"texto,timestamp"`,
  timestamp = epoch nanos → ISO). El push ntfy solo se consulta si
  `EXPO_PUBLIC_NOTIFY_BACKEND=http`.
- **Zonas**: se asignan **localmente en el celular** (el hub no las expone). Ver
  `zoneStore` + `ZoneAssignSheet`.
- **Posponer alarmas**: fuera del MVP — ver sección "Fuera de alcance". Alarmas
  solo soporta **Acknowledge**.
- **Tests RN**: preset `jest-expo`; `jest.setup.js` mockea
  `react-native-safe-area-context` (los tests no montan `SafeAreaProvider`).

## 🚫 Fuera de alcance — NO implementar (salvo pedido explícito)

Funcionalidad que **quedó deliberadamente afuera del MVP**. No la implementes
por iniciativa propia aunque parezca una mejora obvia, esté insinuada por código
viejo, o un test la sugiera. Si el equipo decide reincorporarla, primero se
actualiza esta sección.

- **Posponer / snooze de alarmas.** La pantalla de Alarmas soporta **solo
  Acknowledge**. No agregar:
  - botón "Posponer" / "Posponer 1h" en `AlarmCard`,
  - prop `onSnooze` ni handler de snooze en `AlarmsScreen`,
  - el estado `"snoozed"` en `AlarmStatus` ni el campo `snoozedUntil` en `Alarm`.

  > Esta feature se eliminó a propósito. En sesiones anteriores se reintrodujo
  > por error varias veces — **no la vuelvas a agregar**.

## Contratos externos pendientes

- **Backend de recomendaciones**: sin URL aún → `RECOMMENDATIONS_BACKEND=mock`.
  Cuando exista: setear `http` + `EXPO_PUBLIC_RECOMMENDATIONS_BASE_URL`.
- **Zonas desde el hub**: por ahora 100% locales.

## Commits

Conventional Commits: `feat:`, `fix:`, `chore:`, `test:`, `docs:`, `refactor:`.
Mensajes claros; commit en español está bien (el equipo es hispanohablante).
