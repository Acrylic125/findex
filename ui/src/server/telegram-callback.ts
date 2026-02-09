import { db } from "@/db";
import { coursesTable, swapperTable } from "@/db/schema";
import { and, eq, or } from "drizzle-orm";
import { bot } from "@/telegram/telegram";
import {
  deserializeAccept,
  deserializeAlreadySwapped,
} from "@/telegram/callbacks";

function escapeMarkdown(text: string): string {
  return text.replace(/([_*`[\]()~])/g, "\\$1");
}

export async function handleAcceptCallback(
  callbackData: string,
  from: {
    id: number;
    username: string;
  }
) {
  const req = deserializeAccept(callbackData);
  if (!req) {
    return { ok: false, error: `Invalid callback data: ${callbackData}` };
  }

  const fromTelegramUserId = from.id;
  const { courseId, swapper1, swapper2 } = req;
  const thisSwapper = fromTelegramUserId === swapper1 ? swapper1 : swapper2;
  const otherSwapper = fromTelegramUserId === swapper1 ? swapper2 : swapper1;

  // Security: only the two swappers involved in this request can act
  if (fromTelegramUserId !== swapper1 && fromTelegramUserId !== swapper2) {
    return { ok: false, error: "Not a participant in this swap request" };
  }

  const [courseRow] = await db
    .select({ code: coursesTable.code, name: coursesTable.name })
    .from(coursesTable)
    .where(eq(coursesTable.id, courseId))
    .limit(1);

  if (!courseRow) {
    return { ok: false, error: "Course not found" };
  }

  const courseLabel = `${courseRow.code} ${courseRow.name}`;

  await db
    .update(swapperTable)
    .set({ hasSwapped: true })
    .where(
      and(
        eq(swapperTable.courseId, courseId),
        or(
          eq(swapperTable.telegramUserId, thisSwapper),
          eq(swapperTable.telegramUserId, otherSwapper)
        )
      )
    );

  await bot
    .sendMessage(
      thisSwapper,
      `*Swap confirmed for ${escapeMarkdown(courseLabel)}*.\n@${escapeMarkdown(from.username)} has accepted your swap request, they may get in touch with you, please make sure your DMs are open.\n \nThis request is now marked as "Swapped". If this falls through, you may re-enable this request *My Swaps > ${escapeMarkdown(courseLabel)} > Uncheck "Have Swapped"*.`,
      { parse_mode: "Markdown" }
    )
    .catch(() => {});
  await bot
    .sendMessage(
      otherSwapper,
      `*Successfully sent swap request*\nPlease message @${escapeMarkdown(from.username)} to proceed with the swap. We have reminded them to open their DMs.\n \nThis request is now marked as "Swapped". If this falls through, you may re-enable this request *My Swaps > ${escapeMarkdown(courseLabel)} > Uncheck "Have Swapped"*.`,
      { parse_mode: "Markdown" }
    )
    .catch(() => {});

  return { ok: true };
}

export async function handleAlreadySwappedCallback(
  callbackData: string,
  from: {
    id: number;
    username: string;
  }
) {
  const req = deserializeAlreadySwapped(callbackData);
  if (!req) {
    return { ok: false, error: `Invalid callback data: ${callbackData}` };
  }

  const { courseId, swapper1, swapper2 } = req;
  const thisSwapper = from.id === swapper1 ? swapper1 : swapper2;
  // const otherSwapper = from.id === swapper1 ? swapper2 : swapper1;

  const [courseRow] = await db
    .select({ code: coursesTable.code, name: coursesTable.name })
    .from(coursesTable)
    .where(eq(coursesTable.id, courseId))
    .limit(1);

  if (!courseRow) {
    return { ok: false, error: "Course not found" };
  }

  const courseLabel = `${courseRow.code} ${courseRow.name}`;

  await db
    .update(swapperTable)
    .set({ hasSwapped: true })
    .where(
      and(
        eq(swapperTable.courseId, courseId),
        eq(swapperTable.telegramUserId, thisSwapper)
      )
    );

  await bot
    .sendMessage(
      thisSwapper,
      `*Marked ${escapeMarkdown(courseLabel)} as already swapped*.\nIf you still want to swap for this course, you may re-enable this request *My Swaps > ${escapeMarkdown(courseLabel)} > Uncheck "Have Swapped"*.`,
      { parse_mode: "Markdown" }
    )
    .catch(() => {});
  return { ok: true };
}
