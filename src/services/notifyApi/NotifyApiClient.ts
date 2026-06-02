/**
 * Cliente para el broker ntfy.sh (confirmado por LibreAgro como transporte
 * de notificaciones push del hub).
 *
 * Topic por hub: el `incubator_name` del hub, ej. `moni-f024f90c58f8`.
 * Endpoint usado: GET https://ntfy.sh/<topic>/json?poll=1&since=<sinceId>
 *   - `poll=1` → modo no streaming, devuelve NDJSON inmediato (1 línea por mensaje).
 *   - `since`  → ID o timestamp del último mensaje conocido para paginación incremental.
 *
 * Para streaming real (SSE) y push en background hace falta un cliente
 * EventSource o un servicio nativo — fuera del MVP.
 */

export interface NotifyMessage {
  readonly id: string;
  readonly time: number; // epoch seconds (formato ntfy)
  readonly event: string;
  readonly topic: string;
  readonly message: string;
  readonly title?: string;
  readonly tags?: readonly string[];
  readonly priority?: number;
}

export interface NotifyApiClient {
  pollMessages(
    topic: string,
    since?: string
  ): Promise<readonly NotifyMessage[]>;
}

export type NotifyBackend = "mock" | "http";
