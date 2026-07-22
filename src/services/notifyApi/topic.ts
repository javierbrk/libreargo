import type { Hub } from "../../types";

const NTFY_TOPIC_REGEX = /^moni-[a-fA-F0-9]{8,}$/;

export function getHubNotifyTopic(hub: Hub): string {
  const name = hub.name.trim();
  if (NTFY_TOPIC_REGEX.test(name)) {
    return name;
  }
  return getHubNotifyTopicFromHash(hub.hash);
}

export function getHubNotifyTopicFromHash(hash: string): string {
  const trimmed = hash.trim();
  if (NTFY_TOPIC_REGEX.test(trimmed)) {
    return trimmed;
  }
  return `moni-${trimmed.toLowerCase()}`;
}
