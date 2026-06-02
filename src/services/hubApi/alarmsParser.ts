import type { Alarm, AlarmDataType, SensorData } from "../../types";

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
 * - asigna `dataType` según la categoría del array (temperature/humidity/...);
 * - extrae `currentValue` del primer número que sigue al primer ":" del texto;
 * - extrae `alertValue` de `min:` o `max:` cuando aparece;
 * - usa el timestamp del hub como id estable (`<dataType>-<timestamp>`).
 *
 * Las categorías `wifi`, `sensors` y `rotation` no se exponen como alarmas
 * porque el modelo `AlarmDataType` cubre sólo mediciones.
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

  // Ordenar por timestamp descendente (más recientes primero).
  return alarms.slice().sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function parseEntry(raw: string, dataType: AlarmDataType): Alarm | undefined {
  const lastComma = raw.lastIndexOf(",");
  const message = lastComma >= 0 ? raw.slice(0, lastComma).trim() : raw.trim();
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
