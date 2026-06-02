import type { Recommendation } from "../../types";
import { HubApiInvalidResponseError } from "../hubApi/errors";

/**
 * Mapea la respuesta del backend de mensajes/recomendaciones.
 *
 * Contrato tentativo confirmado por cliente:
 *   GET /messages?limit=N → últimos N mensajes con timestamp/secuencia.
 *
 * El mapper es tolerante para no romper si el formato final cambia
 * algún nombre de campo:
 *   - id   ← `id` | `seq` (convertido a string)
 *   - date ← `date` | `timestamp`
 *   - title   opcional
 *   - content ← `content` | `body` | `message`
 */
export function mapRecommendationListResponse(
  payload: unknown
): readonly Recommendation[] {
  if (!Array.isArray(payload)) {
    throw new HubApiInvalidResponseError();
  }

  return payload.map((item) => {
    if (!isPlainObject(item)) {
      throw new HubApiInvalidResponseError();
    }

    const data = item as Record<string, unknown>;

    const id = extractId(data);
    const date = extractDate(data);
    const content = extractContent(data);

    if (id === undefined || date === undefined || content === undefined) {
      throw new HubApiInvalidResponseError();
    }

    return {
      id,
      title: typeof data.title === "string" ? data.title : "",
      content,
      date,
    };
  });
}

function extractId(data: Record<string, unknown>): string | undefined {
  if (typeof data.id === "string") {
    return data.id;
  }
  if (typeof data.id === "number") {
    return String(data.id);
  }
  if (typeof data.seq === "number") {
    return String(data.seq);
  }
  if (typeof data.seq === "string") {
    return data.seq;
  }
  return undefined;
}

function extractDate(data: Record<string, unknown>): string | undefined {
  if (typeof data.date === "string") {
    return data.date;
  }
  if (typeof data.timestamp === "string") {
    return data.timestamp;
  }
  if (typeof data.timestamp === "number") {
    return String(data.timestamp);
  }
  return undefined;
}

function extractContent(data: Record<string, unknown>): string | undefined {
  if (typeof data.content === "string") {
    return data.content;
  }
  if (typeof data.body === "string") {
    return data.body;
  }
  if (typeof data.message === "string") {
    return data.message;
  }
  return undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
