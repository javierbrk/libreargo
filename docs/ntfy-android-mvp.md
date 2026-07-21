# Notificaciones ntfy en Android (MVP)

Decision de MVP: LibreAgro no recibe notificaciones background por codigo nativo
propio. La app oficial de ntfy se usa como app distribuidora y es la encargada
de mantener la conexion en background y mostrar la notificacion nativa de
Android.

## Flujo esperado

```
ESP32 o curl
  -> POST HTTP a ntfy.sh o servidor ntfy propio
  -> app ntfy Android suscripta al topic
  -> notificacion nativa de Android
```

LibreAgro complementa ese flujo solo en foreground: cuando la pantalla del hub
esta montada, el modo es **Online** y `EXPO_PUBLIC_NOTIFY_BACKEND=http`, consulta
ntfy periodicamente y agrega a Alarmas los mensajes de medicion soportados. En
**Directo** no consulta ntfy porque el telefono queda conectado al AP del hub y
no tiene salida a internet.

## Instalacion para usuario final

1. Instalar el APK release de LibreAgro.
2. En la pantalla **Alertas** del hub, tocar **Activar** (banner "Notificaciones
   con la app cerrada"). Esto intenta abrir un deep link
   `ntfy://<host>/<topic>` (ver `src/services/notifyApi/ntfyDeepLink.ts`), que
   la app ntfy interpreta como "suscribime a este topic si no lo estoy ya"
   (docs.ntfy.sh/subscribe/phone/).
3. Si ntfy no esta instalado, el deep link no tiene quien lo resuelva y
   LibreAgro muestra una guia (`NtfySubscribeSheet`) con botones a Google
   Play, F-Droid o GitHub Releases, y un boton "Ya la instale, reintentar"
   que repite el paso 2.

### Suscripcion manual (fallback)

Si el boton no abre ntfy por algun motivo, o para debug, se puede suscribir
a mano:

```text
moni-<MAC_sin_dos_puntos>
```

Ejemplo con una MAC ficticia:

```text
moni-001122aabbcc
```

Pablo confirmo que `config.incubator_name` funciona con el formato `moni-...`.
Ese es el topic que debe usar la app ntfy.

## Prueba manual con curl

Con ntfy Android suscripta al topic, enviar un mensaje de medicion:

```bash
curl -d "[C] CO2 too high: 1200 max:900" https://ntfy.sh/moni-001122aabbcc
```

Tambien se puede probar presion:

```bash
curl -d "[P] Presion too low: 990 min:1000" https://ntfy.sh/moni-001122aabbcc
```

Resultado esperado:

- Android muestra una notificacion de la app ntfy.
- Si LibreAgro esta abierto en el Home del hub, en modo Online y con backend de
  ntfy en `http`, la alarma aparece tambien en la pantalla de Alarmas.
- Si LibreAgro esta en Directo o cerrado, la notificacion nativa igual depende
  de ntfy Android, no de LibreAgro.

## Payloads de alarma soportados por LibreAgro

LibreAgro solo incorpora a Alarmas mensajes de medicion que pueda clasificar:

- `[T]` o textos con `temp` -> `temperature`
- `[H]` o textos con `humid` -> `humidity`
- `[C]` o textos con `co2` -> `co2`
- `[P]` o textos con `pressure` / `presi` -> `pressure`

Las alertas tecnicas siguen fuera del modelo de alarma de medicion y se ignoran
en Alarmas. Ejemplos: `[heap] Low heap...`, wifi, logs internos o mensajes sin
tipo de medicion.

## Ejemplo desde ESP32

El ESP32 debe publicar al mismo topic que usa ntfy Android. El body puede ser el
texto plano que ya entiende LibreAgro:

```text
[C] CO2 too high: 1200 max:900
```

El endpoint para ntfy.sh seria:

```text
POST https://ntfy.sh/moni-001122aabbcc
```

Si se usa un servidor ntfy propio, reemplazar la base URL por la del servidor,
manteniendo el mismo topic.

## Fuera de alcance en este MVP

- Registrar un `BroadcastReceiver` nativo en LibreAgro.
- Implementar un config plugin de Expo para recibir intents de ntfy.
- Implementar UnifiedPush formal con registro WebPush/VAPID.
- Mostrar notificaciones nativas desde LibreAgro cuando la app esta cerrada.
- Agregar snooze o estados nuevos de alarmas.

Estas opciones se pueden reabrir despues del MVP, pero implican trabajo nativo,
prebuild y validacion especifica de Android.

## Troubleshooting

- Si el boton "Activar" no abre ntfy ni muestra la guia de instalacion (caso
  raro, ej. en un emulador sin resolver intents `ntfy://`), usar la
  suscripcion manual de arriba como plan B.
- Si no llega la notificacion nativa, revisar que la app ntfy tenga permiso de
  notificaciones en Android y que el topic coincida exactamente.
- Si llega tarde, revisar ajustes de bateria/foreground service de ntfy. La app
  ntfy es la responsable del background.
- Si no aparece en Alarmas dentro de LibreAgro, confirmar que LibreAgro este en
  modo Online, en la pantalla del hub, con `EXPO_PUBLIC_NOTIFY_BACKEND=http` y
  que el mensaje sea una alarma de medicion soportada.
- Si el telefono esta en Directo conectado al AP del hub, no esperar polling de
  ntfy desde LibreAgro: no hay salida a internet en ese modo.
