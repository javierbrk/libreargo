import type { Alarm, AlarmDataType, SensorData } from "../../types";
import type { NotifyMessage } from "../notifyApi/NotifyApiClient";

/**
 * Parsea las alarmas emitidas por el hub en /actual.errors.
 *
 * Cada entrada llega con formato `"<texto del hub>,<timestamp opaco>"`,
 * por ejemplo:
 *   "[T] temperature too low: 19.98,88257000000000"
 *   "[H] Humidity too low: 35.65 min:55 max:60 ...,88260000000000"
 *
 * El parser:
 * - separa por la última coma (texto + timestamp);
 * - asigna `dataType` según la categoría del array o el texto en `sensors`;
 * - extrae `currentValue` del primer número que sigue al primer ":" del texto;
 * - extrae `alertValue` de `min:` o `max:` cuando aparece;
 * - usa el timestamp del hub como id estable (`<dataType>-<timestamp>`).
 *
 * Las categorías `wifi` y `rotation`, junto con entradas técnicas no
 * clasificables de `sensors`, no se exponen como alarmas porque el modelo
 * `AlarmDataType` cubre sólo mediciones.
 */
export function parseAlarmsFromSensorData(
  actual: SensorData
): readonly Alarm[] {
  const buckets: ReadonlyArray<{
    category: keyof SensorData["errors"];
    dataType: AlarmDataType;
  }> = [
    { category: "temperature", dataType: "temperature" },
    { category: "humidity", dataType: "humidity" },
  ];

  const alarms: Alarm[] = [];

  for (const { category, dataType } of buckets) {
    const entries = actual.errors[category];
    if (!Array.isArray(entries)) {
      continue;
    }
    for (const raw of entries) {
      if (typeof raw !== "string" || raw.trim() === "") {
        continue;
      }
      const parsed = parseEntry(raw, dataType);
      if (parsed) {
        alarms.push(parsed);
      }
    }
  }

  for (const raw of actual.errors.sensors) {
    if (typeof raw !== "string" || raw.trim() === "") {
      continue;
    }
    const parsed = parseSensorEntry(raw);
    if (parsed) {
      alarms.push(parsed);
    }
  }

  // Ordenar por timestamp descendente (más recientes primero).
  return alarms.slice().sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function parseSensorEntry(raw: string): Alarm | undefined {
  const message = extractMessage(raw);
  const dataType = classifyDataType(message);
  if (!dataType) {
    return undefined;
  }
  return parseEntry(raw, dataType);
}

function parseEntry(raw: string, dataType: AlarmDataType): Alarm | undefined {
  const lastComma = raw.lastIndexOf(",");
  const message = extractMessage(raw);
  const rawTimestamp =
    lastComma >= 0 ? raw.slice(lastComma + 1).trim() : "";

  if (message === "") {
    return undefined;
  }

  return {
    id: `${dataType}-${rawTimestamp || message}`,
    timestamp: normalizeHubTimestamp(rawTimestamp),
    dataType,
    alertValue: extractAlertValue(message),
    currentValue: extractCurrentValue(message),
    zones: [],
    status: "active",
    message,
  };
}

function extractMessage(raw: string): string {
  const lastComma = raw.lastIndexOf(",");
  return lastComma >= 0 ? raw.slice(0, lastComma).trim() : raw.trim();
}

/**
 * Convierte el timestamp del hub (epoch nanos según confirmación de LibreAgro)
 * a ISO 8601. Si el valor no representa una fecha plausible (firmware sin
 * sincronía NTP), devolvemos el valor crudo para que la UI muestre algo
 * y no pierda información.
 */
function normalizeHubTimestamp(rawTimestamp: string): string {
  if (rawTimestamp === "") {
    return "";
  }
  const nanos = Number(rawTimestamp);
  if (!Number.isFinite(nanos) || nanos <= 0) {
    return rawTimestamp;
  }
  const millis = Math.floor(nanos / 1_000_000);
  const date = new Date(millis);
  if (Number.isNaN(date.getTime())) {
    return rawTimestamp;
  }
  // Si la fecha resultante es anterior a 2020 asumimos que el hub no tiene NTP
  // y el valor es uptime desde boot, no epoch real. Conservamos el crudo.
  if (date.getUTCFullYear() < 2020) {
    return rawTimestamp;
  }
  return date.toISOString();
}

/**
 * Convierte un mensaje push de ntfy (suscripción a `notify/<Hub_ID>`) en una
 * Alarm. El body reutiliza el mismo formato de log que /actual.errors
 * (ej. "[T] temperature too low: 19.97"), pero el timestamp viene en el campo
 * `time` del mensaje ntfy (epoch en segundos), no embebido en el texto.
 *
 * Devuelve undefined si el mensaje no corresponde a una medición que el modelo
 * de alarmas soporte (ej. avisos de WiFi).
 */
export function parseAlarmFromPushText(text: string, instance?: string): Alarm {
  const trimmed = text.trim();
  const dataType = classifyDataType(trimmed) ?? "temperature";
  return {
    id: `push-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    dataType,
    alertValue: extractAlertValue(trimmed),
    currentValue: extractCurrentValue(trimmed),
    zones: [],
    status: "active",
    message: instance ? `[${instance}] ${trimmed}` : trimmed,
  };
}

export function parseAlarmFromNotifyMessage(
  msg: NotifyMessage
): Alarm | undefined {
  const text = msg.message.trim();
  if (text === "") {
    return undefined;
  }

  const dataType = classifyDataType(text);
  if (!dataType) {
    return undefined;
  }

  const timestamp =
    msg.time > 0 ? new Date(msg.time * 1000).toISOString() : "";

  return {
    id: `ntfy-${msg.id}`,
    timestamp,
    dataType,
    alertValue: extractAlertValue(text),
    currentValue: extractCurrentValue(text),
    zones: [],
    status: "active",
    message: text,
  };
}

/**
 * Clasifica el tipo de medición a partir del prefijo del log del hub
 * (`[T]`, `[H]`, `[C]`, `[P]`) con fallback a palabras clave.
 */
function classifyDataType(text: string): AlarmDataType | undefined {
  const tag = text.match(/^\s*\[([A-Za-z])\]/)?.[1]?.toUpperCase();
  switch (tag) {
    case "T":
      return "temperature";
    case "H":
      return "humidity";
    case "C":
      return "co2";
    case "P":
      return "pressure";
    default:
      break;
  }

  const lower = text.toLowerCase();
  if (lower.includes("temp")) return "temperature";
  if (lower.includes("humid")) return "humidity";
  if (lower.includes("co2")) return "co2";
  if (lower.includes("pressure") || lower.includes("presi")) return "pressure";
  return undefined;
}

function extractCurrentValue(message: string): number {
  // Toma el primer número que aparece después del primer ":".
  const colonIndex = message.indexOf(":");
  const tail = colonIndex >= 0 ? message.slice(colonIndex + 1) : message;
  const match = tail.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function extractAlertValue(message: string): number {
  // Si el mensaje del hub trae un umbral explícito (min:X o max:Y) usamos el más cercano.
  const minMatch = message.match(/min:\s*(-?\d+(?:\.\d+)?)/i);
  const maxMatch = message.match(/max:\s*(-?\d+(?:\.\d+)?)/i);

  if (minMatch && /too low|below|under/i.test(message)) {
    return Number(minMatch[1]);
  }
  if (maxMatch && /too high|above|over/i.test(message)) {
    return Number(maxMatch[1]);
  }
  if (minMatch) {
    return Number(minMatch[1]);
  }
  if (maxMatch) {
    return Number(maxMatch[1]);
  }
  return 0;
}
