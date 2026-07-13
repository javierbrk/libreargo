import {
  HubApiInvalidResponseError,
  HubApiNetworkError,
} from "../hubApi/errors";

/**
 * Capa de acceso a InfluxDB 1.x (servidor Grafana de LibreAgro).
 *
 * El hub publica telemetría (`medicionesCO2`) y recomendaciones (`recomendaciones`)
 * a `http://grafana.altermundi.net:8086`, db `cto`. Las LECTURAS no requieren auth
 * (verificado), así que el cliente NO embebe ningún token: solo hace `GET /query`.
 * La escritura (que la app no hace) sí usa token, pero eso vive en el firmware.
 */

const DEFAULT_BASE_URL = "http://grafana.altermundi.net:8086";
const DEFAULT_DB = "cto";
const DEFAULT_TIMEOUT_MS = 10000;

export type InfluxValue = string | number | boolean | null;

export interface InfluxSeries {
  readonly name: string;
  /** Presente cuando la query usa GROUP BY <tag> (ej. GROUP BY "sensor"). */
  readonly tags?: Readonly<Record<string, string>>;
  readonly columns: readonly string[];
  readonly values: readonly (readonly InfluxValue[])[];
}

interface InfluxStatementResult {
  readonly series?: readonly InfluxSeries[];
  readonly error?: string;
}

interface InfluxQueryResponse {
  readonly results?: readonly InfluxStatementResult[];
}

interface FetchLikeResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

function normalizeEnv(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

export function getInfluxBaseUrl(): string {
  const base =
    normalizeEnv(process.env.EXPO_PUBLIC_INFLUX_BASE_URL) ??
    normalizeEnv(process.env.INFLUX_BASE_URL) ??
    DEFAULT_BASE_URL;
  return base.replace(/\/+$/, "");
}

export function getInfluxDb(): string {
  return (
    normalizeEnv(process.env.EXPO_PUBLIC_INFLUX_DB) ??
    normalizeEnv(process.env.INFLUX_DB) ??
    DEFAULT_DB
  );
}

/**
 * Ejecuta una query InfluxQL y devuelve las series del primer statement.
 * `epoch=s` → timestamps en segundos Unix (número en la columna `time`).
 */
// IP v4 actual de grafana.altermundi.net. Fallback para teléfonos cuyo DNS
// de sistema no resuelve el hostname (caso real: Chrome carga la URL pero el
// fetch de la app falla — Chrome usa su propio resolvedor DoH, OkHttp usa el
// del sistema). Si la IP del servidor cambia, actualizar junto con la infra.
const INFLUX_FALLBACK_IP = "138.255.88.25";

function describeError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error);
}

async function fetchWithTimeout(url: string): Promise<FetchLikeResponse> {
  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : undefined;
  const timer = controller
    ? setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)
    : undefined;
  try {
    return (await fetch(url, {
      method: "GET",
      signal: controller?.signal,
    })) as unknown as FetchLikeResponse;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function urlWithFallbackHost(url: string): string | null {
  const base = getInfluxBaseUrl();
  const host = base.replace(/^https?:\/\//, "").split(":")[0];
  // Solo tiene sentido reintentar si la base usa hostname (no una IP literal).
  if (!host || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return null;
  }
  return url.replace(host, INFLUX_FALLBACK_IP);
}

export async function queryInflux(
  q: string,
  epoch: string = "s"
): Promise<readonly InfluxSeries[]> {
  const url =
    `${getInfluxBaseUrl()}/query` +
    `?db=${encodeURIComponent(getInfluxDb())}` +
    `&epoch=${encodeURIComponent(epoch)}` +
    `&q=${encodeURIComponent(q)}`;

  let response: FetchLikeResponse;
  try {
    response = await fetchWithTimeout(url);
  } catch (primaryError: unknown) {
    const fallbackUrl = urlWithFallbackHost(url);
    if (!fallbackUrl) {
      throw new HubApiNetworkError(
        `No se pudo conectar con InfluxDB (${describeError(primaryError)})`
      );
    }
    try {
      response = await fetchWithTimeout(fallbackUrl);
    } catch {
      // Reportamos la causa del intento primario (hostname), que es la más
      // diagnóstica: "Unable to resolve host" delata DNS, "timeout" delata red.
      throw new HubApiNetworkError(
        `No se pudo conectar con InfluxDB (${describeError(primaryError)})`
      );
    }
  }

  if (!response.ok) {
    throw new HubApiNetworkError(
      `InfluxDB respondió con estado ${response.status}`
    );
  }

  let body: InfluxQueryResponse;
  try {
    body = (await response.json()) as InfluxQueryResponse;
  } catch {
    throw new HubApiInvalidResponseError("InfluxDB devolvió una respuesta no-JSON");
  }

  const result = body.results?.[0];
  if (!result) {
    throw new HubApiInvalidResponseError();
  }
  if (result.error) {
    throw new HubApiInvalidResponseError(`InfluxDB: ${result.error}`);
  }
  return result.series ?? [];
}

/** Convierte una serie en filas-objeto indexadas por nombre de columna. */
export function seriesRows(
  series: InfluxSeries | undefined
): ReadonlyArray<Record<string, InfluxValue>> {
  if (!series) {
    return [];
  }
  return series.values.map((row) => {
    const obj: Record<string, InfluxValue> = {};
    series.columns.forEach((col, index) => {
      obj[col] = row[index] ?? null;
    });
    return obj;
  });
}

/** Escapa una comilla simple para usar un valor en un WHERE de InfluxQL. */
export function escapeInfluxTag(value: string): string {
  return value.replace(/'/g, "\\'");
}

/** Identidad del hub en InfluxDB: tag `device` = `moni-<hash>`. */
export function deviceTagForHash(hash: string): string {
  return `moni-${hash}`;
}
