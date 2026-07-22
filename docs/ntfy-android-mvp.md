# Notificaciones Push y UnifiedPush en Android

LibreAgro utiliza **UnifiedPush** con la aplicación oficial de **ntfy** (`io.heckel.ntfy`) como distribuidor para la recepción de notificaciones Push nativas en tiempo real (tanto en primer plano como con la app cerrada o en segundo plano).

## Arquitectura Invertida de Registro

La arquitectura de notificaciones se invirtió para ser **dinámica y segura por dispositivo**: el teléfono le notifica activamente al ESP32 cuál es su **Endpoint único de notificaciones**.

```text
1. App LibreAgro (Celular) -> Pide endpoint a ntfy app (UnifiedPush)
   -> ntfy devuelve endpoint único privado (ej: https://ntfy.sh/upqWunC0oivigx?up=1)

2. App LibreAgro (Modo Directo) -> Envía automáticamente al ESP32:
   POST http://192.168.4.1/api/notify/subscribe
   Body: {"endpoint": "https://ntfy.sh/upqWunC0oivigx?up=1", "instance": "moni-004B12EE1FF4"}

3. ESP32 (Alarma detectada) -> Recorre lista de suscriptores y hace POST directo a cada endpoint URL:
   POST https://ntfy.sh/upqWunC0oivigx?up=1
   Payload: "[T] temperature too high: 39.8 min:18 max:38"

4. ntfy app -> Recibe intent org.unifiedpush.android.connector.PUSH_EVENT
   -> ExpoUPService + NtfyPushPayloadRenderer (Kotlin nativo en LibreAgro)
   -> Notificación nativa en Android (App abierta o cerrada)
```

---

## Contratos API del ESP32

### 1. Consultar Suscriptores Registrados (`GET /api/notify/subscribers`)
* **Método**: `GET`
* **Ruta**: `/api/notify/subscribers`
* **Respuesta del ESP32**:
```json
{
  "topic": "moni-004B12EE1FF4",
  "subscribers": [
    {
      "endpoint": "https://ntfy.sh/upqWunC0oivigx?up=1",
      "added_at": 1784737733
    }
  ]
}
```

### 2. Registrar o Actualizar Suscriptor (`POST /api/notify/subscribe`)
* **Método**: `POST`
* **Ruta**: `/api/notify/subscribe`
* **Headers**: `Content-Type: application/json`
* **Body que envía LibreAgro**:
```json
{
  "endpoint": "https://ntfy.sh/upqWunC0oivigx?up=1",
  "instance": "moni-004B12EE1FF4"
}
```
* **Respuesta del ESP32**:
```json
{
  "status": "ok",
  "total_subscribers": 1
}
```

---

## Flujo de Vinculación en la App

1. **Inicio de la App**: La app solicita los permisos de notificación al SO e inicializa UnifiedPush para los hubs configurados.
2. **Conexión Directa**: Al conectarse al AP del ESP32 (`192.168.4.1` o IP de red local), LibreAgro consulta `GET /api/notify/subscribers`.
3. **Suscripción Automática**: Si la URL del endpoint del celular no está en la lista del ESP32 (o si cambió), envía automáticamente `POST /api/notify/subscribe` para asociarlo.
4. **Pestaña Diagnóstico**: En la pantalla de Alarmas -> Pestaña **Diagnóstico**, se puede:
   - Ver el estado del distribuidor ntfy (`🟢 ntfy activo`).
   - Ver la lista de suscriptores almacenados en el ESP32.
   - Enviar notificaciones de prueba nativas o registrar manualmente el celular con reporte detallado.

---

## Módulo Nativo Kotlin (`NtfyPushPayloadRenderer`)

- **Ubicación**: `modules/ntfy-push-renderer/android/src/main/java/com/libreagro/NtfyPushPayloadRenderer.kt`
- **Función**: Recibe las notificaciones de `ExpoUPService` en Android cuando la app está cerrada o en segundo plano, decodifica el mensaje ntfy (JSON o texto plano) y construye la notificación nativa en la barra de estado de Android sin requerir ejecución del JS bridge.

---

## Prueba Manual con curl

Se puede simular el registro y la emisión de alertas directamente desde una terminal:

### 1. Registrar suscriptor en el ESP32:
```bash
curl -X POST http://192.168.4.1/api/notify/subscribe \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": "https://ntfy.sh/upqWunC0oivigx?up=1",
    "instance": "moni-004B12EE1FF4"
  }'
```

### 2. Consultar suscriptores guardados en el ESP32:
```bash
curl http://192.168.4.1/api/notify/subscribers
```

### 3. Simular envío de alerta directamente al endpoint del celular:
```bash
curl -d "[T] temperature too high: 39.8 min:18 max:38 (Test manual)" https://ntfy.sh/upqWunC0oivigx?up=1
```
