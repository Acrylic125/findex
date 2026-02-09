import { NextResponse } from "next/server";
import { z } from "zod";
import { bot } from "@/telegram/telegram";
import {
  handleAcceptCallback,
  handleAlreadySwappedCallback,
} from "@/server/telegram-callback";
import { env } from "@/lib/env";
import crypto from "crypto";
import { redis } from "@/db/upstash";
import { Lock } from "@upstash/lock";
import { COMMAND_PREFIX, getAction } from "@/telegram/callbacks";

const telegramUpdateSchema = z.object({
  update_id: z.number(),
  callback_query: z
    .object({
      id: z.string(),
      from: z.object({
        id: z.number(),
        is_bot: z.boolean().optional(),
        first_name: z.string().optional(),
        username: z.string().optional(),
      }),
      message: z
        .object({
          message_id: z.number(),
          chat: z.object({ id: z.number() }),
        })
        .optional(),
      data: z.string().optional(),
    })
    .optional(),
});

function handleCallback(
  action: string,
  callback: {
    id: string;
    data: string;
  },
  from: {
    id: number;
    username: string;
  }
) {
  if (action === COMMAND_PREFIX.ACCEPT) {
    return handleAcceptCallback(callback.data, from);
  } else if (action === COMMAND_PREFIX.ALREADY_SWAPPED) {
    return handleAlreadySwappedCallback(callback.data, from);
  }
  return { ok: false, error: "Invalid callback data" };
}

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = telegramUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const callback = parsed.data.callback_query;
  if (!callback?.data || typeof callback.from?.id !== "number") {
    return NextResponse.json({ ok: true });
  }

  const action = getAction(callback.data);
  if (!action) {
    return NextResponse.json({ ok: true });
  }

  /** Check if the request has already been processed. */
  const lock = new Lock({
    id: `findex:tg_wh:${action.id}`,
    lease: 5000,
    redis: redis,
  });

  if (await lock.acquire()) {
    try {
      const lockKey = `telegram:webhook:${action.id}`;
      const lockValue = await redis.get(lockKey);
      if (lockValue) {
        return NextResponse.json({ ok: true });
      }

      const result = await handleCallback(
        action.action,
        {
          id: callback.id,
          data: callback.data,
        },
        {
          id: callback.from.id,
          username: callback.from.username ?? "???",
        }
      );

      if (result.ok) {
        await bot.answerCallbackQuery(callback.id).catch(() => {});
        const msg = callback.message;
        if (msg?.chat?.id != null && msg?.message_id != null) {
          await bot
            .editMessageReplyMarkup(
              { inline_keyboard: [] },
              { chat_id: msg.chat.id, message_id: msg.message_id }
            )
            .catch(() => {});
        }
        await redis.set(lockKey, "1", { ex: 60 * 5 });
      } else {
        console.error(`Error handling callback ${callback.id}:`, result.error);
        await bot
          .answerCallbackQuery(callback.id, {
            show_alert: true,
            text: result.error,
          })
          .catch(() => {});
      }
    } catch (error) {
      console.error(`Error handling callback ${callback.id}:`, error);
    } finally {
      await lock.release();
    }
  }

  return NextResponse.json({ ok: true });
}
