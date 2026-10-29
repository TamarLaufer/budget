import { BUDGET_ALERTS_CHANNEL_ID, type PushMessage, type PushResult, type PushSender } from "./pushSender.js";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
/** Expo accepts at most 100 messages per request. */
const BATCH_SIZE = 100;
const REQUEST_TIMEOUT_MS = 5_000;

interface ExpoTicket {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

/**
 * Sends through the Expo push service, which forwards to FCM using the FCM V1 credentials
 * uploaded to EAS. `accessToken` is required only when "enhanced push security" is enabled.
 *
 * Only push *tickets* are checked. Delivery receipts would need a delayed job and are out of scope;
 * stale tokens are also replaced whenever the app re-registers on start.
 */
export function createExpoPushSender(options: { accessToken?: string; fetchImpl?: typeof fetch } = {}): PushSender {
  const fetchImpl = options.fetchImpl ?? fetch;

  async function sendBatch(batch: PushMessage[]): Promise<PushResult[]> {
    const response = await fetchImpl(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
      },
      body: JSON.stringify(
        batch.map((m) => ({ ...m, channelId: BUDGET_ALERTS_CHANNEL_ID, priority: "high", sound: "default" })),
      ),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Expo push request failed with status ${response.status}`);
    }
    const payload = (await response.json()) as { data?: ExpoTicket[] };
    const tickets = payload.data ?? [];
    return batch.map((_, i): PushResult => {
      const ticket = tickets[i];
      if (ticket?.status === "ok") return { ok: true };
      return {
        ok: false,
        deviceNotRegistered: ticket?.details?.error === "DeviceNotRegistered",
        message: ticket?.message ?? "Missing push ticket",
      };
    });
  }

  return {
    async send(messages) {
      const results: PushResult[] = [];
      for (let i = 0; i < messages.length; i += BATCH_SIZE) {
        results.push(...(await sendBatch(messages.slice(i, i + BATCH_SIZE))));
      }
      return results;
    },
  };
}
