import { db } from "@/db";
import { coursesTable, swapperTable } from "@/db/schema";
import { and, eq, or } from "drizzle-orm";
import { bot } from "@/telegram/telegram";

function escapeMarkdown(text: string): string {
  return text.replace(/([_*`[\]()~])/g, "\\$1");
}

/**
 * Parse callback_data for swap buttons.
 * Format: "a:courseId:swapper1:swapper2" (accept) or "s:courseId:swapper1:swapper2" (already swapped).
 * Returns null if invalid.
 */
function parseSwapCallbackData(data: string): {
  action: "accept" | "already_swapped";
  courseId: number;
  swapper1: number;
  swapper2: number;
} | null {
  const parts = data.split(":");
  if (parts.length !== 4) return null;
  const [actionChar, courseIdStr, swapper1Str, swapper2Str] = parts;
  if (actionChar !== "a" && actionChar !== "s") return null;
  const courseId = parseInt(courseIdStr, 10);
  const swapper1 = parseInt(swapper1Str, 10);
  const swapper2 = parseInt(swapper2Str, 10);
  if (
    isNaN(courseId) ||
    isNaN(swapper1) ||
    isNaN(swapper2) ||
    swapper1 < swapper2
  )
    return null;
  return {
    action: actionChar === "a" ? "accept" : "already_swapped",
    courseId,
    swapper1,
    swapper2,
  };
}

export async function handleSwapCallback(
  callbackData: string,
  from: {
    id: number;
    username: string;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = parseSwapCallbackData(callbackData);
  if (!parsed) {
    return { ok: false, error: "Invalid callback data" };
  }

  const fromTelegramUserId = from.id;

  const { action, courseId, swapper1, swapper2 } = parsed;
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

  if (action === "accept") {
    // Both swappers: set hasSwapped = true for this course (two rows)
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
        `*Swap confirmed for ${escapeMarkdown(courseLabel)}*.\n@${escapeMarkdown(from.username)} has accepted your swap request, they may get in touch with you, please make sure your DMs are open.\n \nYour request for ${escapeMarkdown(courseLabel)} is now marked as "Swapped". If this falls through, consider re-enabling the swap request.`,
        { parse_mode: "Markdown" }
      )
      .catch(() => {});
    await bot
      .sendMessage(
        otherSwapper,
        `*Successfully sent swap request*\nPlease message @${escapeMarkdown(from.username)} to proceed with the swap. We have reminded them to open their DMs.\n \nYour request for ${escapeMarkdown(courseLabel)} is now marked as "Swapped". If this falls through, consider re-enabling the swap request.`,
        { parse_mode: "Markdown" }
      )
      .catch(() => {});
  } else {
    // Already swapped: only the clicker's hasSwapped = true
    await db
      .update(swapperTable)
      .set({ hasSwapped: true })
      .where(
        and(
          eq(swapperTable.courseId, courseId),
          eq(swapperTable.telegramUserId, fromTelegramUserId)
        )
      );

    await bot
      .sendMessage(
        thisSwapper,
        `*Marked ${escapeMarkdown(courseLabel)} as already swapped*.\nIf you still want to swap for this course, consider re-enabling the swap request.`,
        { parse_mode: "Markdown" }
      )
      .catch(() => {});
    await bot
      .sendMessage(
        otherSwapper,
        `The other party marked *${escapeMarkdown(courseLabel)}* as already swapped.`,
        { parse_mode: "Markdown" }
      )
      .catch(() => {});
  }

  return { ok: true };
}
