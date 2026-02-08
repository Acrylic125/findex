import { NextResponse } from "next/server";
import { bot } from "@/telegram/telegram";
import { handleSwapCallback } from "@/server/telegram-callback";
import { env } from "@/lib/env";
import crypto from "crypto";

type TelegramUpdate = {
  update_id: number;
  callback_query?: {
    id: string;
    from: {
      id: number;
      is_bot?: boolean;
      first_name?: string;
      username?: string;
    };
    message?: unknown;
    data?: string;
  };
};

/** Constant-time comparison to avoid timing attacks. */
function secureCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(request: Request) {
  const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (!secret || !secureCompare(secret, env.TELEGRAM_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: TelegramUpdate;
  try {
    body = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const callback = body.callback_query;
  if (!callback?.data || typeof callback.from?.id !== "number") {
    return NextResponse.json({ ok: true });
  }

  const result = await handleSwapCallback(callback.data, callback.from.id);

  if (result.ok) {
    await bot.answerCallbackQuery(callback.id).catch(() => {});
  } else {
    await bot
      .answerCallbackQuery(callback.id, {
        show_alert: true,
        text: result.error,
      })
      .catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
