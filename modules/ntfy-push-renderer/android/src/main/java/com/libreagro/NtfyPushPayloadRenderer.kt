package com.libreagro

import android.content.Context
import dev.djara.expounifiedpush.NotificationContent
import dev.djara.expounifiedpush.PushPayloadRenderer
import org.json.JSONObject

/**
 * Renderer personalizado para payloads de ntfy.sh en Android (UnifiedPush).
 *
 * Soporta tanto payloads JSON de ntfy como mensajes de texto plano.
 * Se ejecuta en un Service nativo de background SIN el bridge JS/RN,
 * construyendo notificaciones del sistema incluso con la app cerrada.
 */
class NtfyPushPayloadRenderer : PushPayloadRenderer {
    override fun render(
        context: Context,
        instance: String,
        decrypted: String
    ): NotificationContent? {
        val trimmed = decrypted.trim()
        if (trimmed.isEmpty()) {
            return null
        }

        var title = "⚠️ LibreAgro — $instance"
        var body = trimmed
        var time = System.currentTimeMillis()

        // Intentar parsear como JSON (formato ntfy o custom)
        if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
            try {
                val json = JSONObject(trimmed)

                // Ignorar eventos de control de ntfy
                val event = json.optString("event", "")
                if (event == "open" || event == "keepalive") {
                    return null
                }

                val msg = json.optString("message", "").ifEmpty { json.optString("body", "") }
                if (msg.isNotEmpty()) {
                    body = msg
                }

                val customTitle = json.optString("title", "")
                if (customTitle.isNotEmpty()) {
                    title = customTitle
                }

                val jsonTime = json.optLong("time", 0L)
                if (jsonTime > 0) {
                    time = jsonTime
                }
            } catch (_: Exception) {
                // Si el JSON falla, conservar el texto plano
            }
        }

        if (body.isEmpty()) {
            return null
        }

        val notifId = (instance + time.toString()).hashCode()

        return NotificationContent(
            id = notifId,
            title = title,
            body = body
        )
    }
}
