import type { Recommendation } from "../../types";

/**
 * Contrato tentativo confirmado por cliente:
 *   - GET  /messages?limit=N → últimos N mensajes (default 10).
 *   - POST /messages         → encola una query asíncrona; la respuesta
 *                              aparece más tarde en el GET.
 */
export interface RecommendationsApiClient {
  getLatest(limit: number, hubHash?: string): Promise<readonly Recommendation[]>;
  submitQuery(text: string): Promise<void>;
}

export type RecommendationsBackend = "mock" | "http" | "influx";
