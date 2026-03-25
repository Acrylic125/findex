/**
 * Deprecated: webhook callback handling moved to Convex HTTP action
 * (`convex/actions.ts` -> `telegramWebhook`) with Convex DB writes.
 *
 * Keep these wrappers only for legacy callers.
 */

export async function handleAcceptCallback(
  _callbackData: string,
  from: {
    id: number;
    username: string;
  }
) {
  return {
    ok: false as const,
    error:
      "handleAcceptCallback is deprecated. Use Convex HTTP action /telegram/webhook.",
  };
}

export async function handleAlreadySwappedCallback(
  _callbackData: string,
  from: {
    id: number;
    username: string;
  }
) {
  return {
    ok: false as const,
    error:
      "handleAlreadySwappedCallback is deprecated. Use Convex HTTP action /telegram/webhook.",
  };
}
