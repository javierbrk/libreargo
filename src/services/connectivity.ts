import { DIRECT_MODE_IP } from "../constants";
import type { ConnectionMode, Hub } from "../types";

/**
 * Resuelve el "target" que se pasa a los servicios del hub según el modo de
 * conexión:
 *
 * - **Directo**: Usa `hub.ip` si está configurada (ej. `192.168.18.205`),
 *   o fallback a `DIRECT_MODE_IP` (`192.168.4.1`, AP del hub).
 *
 * - **Online**: Usa `hub.hash` para ruteo por backend.
 */
export function resolveHubTarget(mode: ConnectionMode, hub: Hub): string {
  if (mode === "directo") {
    return hub.ip && hub.ip.trim() !== "" ? hub.ip : DIRECT_MODE_IP;
  }
  return hub.hash;
}
