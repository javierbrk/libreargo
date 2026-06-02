import { mockRecommendations } from "../../mocks/recommendations";
import type { Recommendation } from "../../types";
import type { RecommendationsApiClient } from "./RecommendationsApiClient";

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createMockRecommendationsApiClient(): RecommendationsApiClient {
  return {
    async getLatest(limit: number): Promise<readonly Recommendation[]> {
      await delay(150);
      return [...mockRecommendations]
        .sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        )
        .slice(0, limit);
    },
    async submitQuery(_text: string): Promise<void> {
      await delay(80);
    },
  };
}
