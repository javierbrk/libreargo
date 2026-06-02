import type { NotifyApiClient, NotifyMessage } from "./NotifyApiClient";

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const seedMessages: readonly NotifyMessage[] = [
  {
    id: "mock-ntfy-001",
    time: Math.floor(Date.now() / 1000) - 300,
    event: "message",
    topic: "moni-mock",
    message: "[T] temperature too low: 19.97",
    title: "Alerta temperatura",
  },
  {
    id: "mock-ntfy-002",
    time: Math.floor(Date.now() / 1000) - 120,
    event: "message",
    topic: "moni-mock",
    message: "[H] Humidity too low: 35.65 min:55 max:60",
    title: "Alerta humedad",
  },
];

export function createMockNotifyApiClient(): NotifyApiClient {
  return {
    async pollMessages(
      _topic: string,
      since?: string
    ): Promise<readonly NotifyMessage[]> {
      await delay(80);
      if (!since) {
        return seedMessages;
      }
      const sinceTime = Number(since);
      if (!Number.isFinite(sinceTime)) {
        return seedMessages;
      }
      return seedMessages.filter((m) => m.time > sinceTime);
    },
  };
}
