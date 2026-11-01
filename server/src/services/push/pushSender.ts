/** A push notification addressed to one device. */
export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}

/** Outcome for one message, in the same order as the messages sent. */
export type PushResult = { ok: true } | { ok: false; deviceNotRegistered: boolean; message: string };

/**
 * Sends push notifications. Injected into the app (like the token verifier) so tests can use a
 * fake. Throws when the whole request fails (network, HTTP error, timeout).
 */
export interface PushSender {
  send(messages: PushMessage[]): Promise<PushResult[]>;
}

/** Android notification channel created by the app; must match src/notifications on the client. */
export const BUDGET_ALERTS_CHANNEL_ID = "budget-alerts";
