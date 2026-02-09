import z from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { db } from "@/db";
import {
  courseIndexTable,
  coursesTable,
  swapperTable,
  swapperWantTable,
  swapRequestsTable,
  usersTable,
} from "@/db/schema";
import { and, count, eq, inArray, max, ne, not, or, sql } from "drizzle-orm";
import { CurrentAcadYear } from "@/lib/acad";
import { alias } from "drizzle-orm/pg-core";
import { bot } from "@/telegram/telegram";
import crypto from "crypto";
import { env } from "@/lib/env";
import { serializeAccept, serializeAlreadySwapped } from "@/telegram/callbacks";
import {
  handleAcceptCallback,
  handleAlreadySwappedCallback,
} from "../telegram-callback";

function escapeMarkdown(text: string): string {
  // Escape special characters for Telegram Markdown parse mode
  return text.replace(/([_*`[\]()~])/g, "\\$1");
}

function buildFStarsUrl(
  courseCode: string,
  index: string,
  ay: string,
  semester: string
): string {
  return `https://fstars.benapps.dev/preview?ay=${encodeURIComponent(ay)}&s=${encodeURIComponent(semester)}&c=${encodeURIComponent(courseCode)}:${encodeURIComponent(index)}`;
}

const IV_LENGTH = 16;
const TAG_LENGTH = 32; // HMAC-SHA256

function getUserKeys(userId: number) {
  const master = Buffer.from(process.env.ENCRYPTION_KEY!, "utf8");

  const encKey = crypto
    .createHmac("sha256", master)
    .update("enc:" + userId)
    .digest(); // 32 bytes

  const macKey = crypto
    .createHmac("sha256", master)
    .update("mac:" + userId)
    .digest(); // 32 bytes

  return { encKey, macKey };
}

function encryptId(userId: number, id: string): string {
  const { encKey, macKey } = getUserKeys(userId);
  const plaintext = Buffer.from(id, "utf8");

  // Synthetic IV = HMAC(macKey, plaintext)
  const iv = crypto
    .createHmac("sha256", macKey)
    .update(plaintext)
    .digest()
    .subarray(0, IV_LENGTH);

  // Encrypt with AES-256-CTR (deterministic given same IV)
  const cipher = crypto.createCipheriv("aes-256-ctr", encKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  // MAC = HMAC(macKey, iv || ciphertext)
  const tag = crypto
    .createHmac("sha256", macKey)
    .update(Buffer.concat([iv, ciphertext]))
    .digest();

  // Output: iv | tag | ciphertext
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

function decryptId(userId: number, data: string): string {
  const buf = Buffer.from(data, "base64");

  if (buf.length < IV_LENGTH + TAG_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid ID, please report this!",
    });
  }

  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);

  const { encKey, macKey } = getUserKeys(userId);

  // Verify MAC first (constant-time)
  const expectedTag = crypto
    .createHmac("sha256", macKey)
    .update(Buffer.concat([iv, ciphertext]))
    .digest();

  if (!crypto.timingSafeEqual(tag, expectedTag)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid ID, please report this!",
    });
  }

  // Decrypt
  const decipher = crypto.createDecipheriv("aes-256-ctr", encKey, iv);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}

const otherSwapper = alias(swapperTable, "other_swapper");

type MatchIndexResponse = {
  id: string;
  // Null if the user has never mark as match.
  // Username
  // by: string | null;
  numberOfRequests: number;
  isPerfectMatch: boolean;
  index: string;
  requestedAt: Date;
  isVerified: boolean;
  isSelfInitiated: boolean;
  status?: "pending" | "swapped";
  revealedBy?: string;
};

export const swapsRouter = createTRPCRouter({
  getCourseIndexes: publicProcedure
    .input(
      z.object({
        courseId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const indexes = await db
        .select({
          id: courseIndexTable.id,
          index: courseIndexTable.index,
        })
        .from(courseIndexTable)
        .innerJoin(coursesTable, eq(courseIndexTable.courseId, coursesTable.id))
        .where(
          and(
            eq(courseIndexTable.courseId, input.courseId),
            eq(coursesTable.ay, CurrentAcadYear.ay),
            eq(coursesTable.semester, CurrentAcadYear.semester)
          )
        );
      return indexes;
    }),
  setRequest: protectedProcedure
    .input(
      z.object({
        courseId: z.number(),
        haveIndex: z.string(),
        wantIndexes: z.array(z.string()).min(0).max(16),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const currentWantIndexes = await db
        .select({
          index: swapperWantTable.wantIndex,
          courseCode: coursesTable.code,
        })
        .from(swapperWantTable)
        .innerJoin(coursesTable, eq(swapperWantTable.courseId, coursesTable.id))
        .where(
          and(
            eq(swapperWantTable.telegramUserId, ctx.user.id),
            eq(swapperWantTable.courseId, input.courseId)
          )
        );

      const wantIndexesSet = new Set(input.wantIndexes);

      const toDeleteIndexes = currentWantIndexes.filter(
        (index) => !wantIndexesSet.has(index.index)
      );
      const toInsertIndexes = input.wantIndexes.filter(
        (index) => !currentWantIndexes.some((i) => i.index === index)
      );

      await db.transaction(async (tx) => {
        // First insert the swapper.
        await tx
          .insert(swapperTable)
          .values({
            telegramUserId: ctx.user.id,
            courseId: input.courseId,
            index: input.haveIndex,
          })
          .onConflictDoUpdate({
            target: [swapperTable.telegramUserId, swapperTable.courseId],
            set: {
              index: input.haveIndex,
            },
          });

        // Then insert what the swapper wants.
        if (toInsertIndexes.length > 0) {
          await tx.insert(swapperWantTable).values(
            toInsertIndexes.map((index) => ({
              telegramUserId: ctx.user.id,
              courseId: input.courseId,
              wantIndex: index,
              requestedAt: new Date(),
            }))
          );
          // .onConflictDoNothing();
        }

        // Then delete what the swapper no longer wants.
        if (toDeleteIndexes.length > 0) {
          await tx.delete(swapperWantTable).where(
            inArray(
              swapperWantTable.wantIndex,
              toDeleteIndexes.map((index) => index.index)
            )
          );
        }
      });

      const [course] = await db
        .select({ code: coursesTable.code })
        .from(coursesTable)
        .where(eq(coursesTable.id, input.courseId))
        .limit(1);

      return {
        courseCode: course?.code ?? null,
        success: true,
      };
    }),
  getRequestForCourse: protectedProcedure
    .input(
      z.object({
        courseId: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const [have, request] = await Promise.all([
        db
          .select({
            indexId: courseIndexTable.id,
            index: swapperTable.index,
          })
          .from(swapperTable)
          .innerJoin(
            courseIndexTable,
            and(
              eq(swapperTable.index, courseIndexTable.index),
              eq(swapperTable.courseId, courseIndexTable.courseId)
            )
          )
          .where(
            and(
              eq(swapperTable.telegramUserId, ctx.user.id),
              eq(swapperTable.courseId, input.courseId)
            )
          )
          .limit(1),
        db
          .select({
            indexId: courseIndexTable.id,
            index: swapperWantTable.wantIndex,
          })
          .from(swapperWantTable)
          .innerJoin(
            courseIndexTable,
            and(
              eq(swapperWantTable.wantIndex, courseIndexTable.index),
              eq(swapperWantTable.courseId, courseIndexTable.courseId)
            )
          )
          .where(
            and(
              eq(swapperWantTable.courseId, input.courseId),
              eq(swapperWantTable.telegramUserId, ctx.user.id)
            )
          ),
      ]);

      return {
        have: have.length > 0 ? have[0] : null,
        want: request.map((request) => ({
          indexId: request.indexId,
          index: request.index,
        })),
      };
    }),
  getAllRequests: protectedProcedure.query(async ({ ctx }) => {
    const [requests, matchCounts, pendingRequestCounts] = await Promise.all([
      db
        .select({
          courseId: swapperTable.courseId,
          courseName: coursesTable.name,
          courseCode: coursesTable.code,
          hasSwapped: swapperTable.hasSwapped,
        })
        .from(swapperTable)
        .innerJoin(coursesTable, eq(swapperTable.courseId, coursesTable.id))
        .where(eq(swapperTable.telegramUserId, ctx.user.id)),
      db
        .select({
          count: count(),
          courseId: swapperWantTable.courseId,
        })
        .from(swapperWantTable)
        // Other swapper
        .innerJoin(
          otherSwapper,
          eq(swapperWantTable.courseId, otherSwapper.courseId)
        )
        .innerJoin(
          usersTable,
          eq(otherSwapper.telegramUserId, usersTable.userId)
        )
        .where(
          and(
            eq(otherSwapper.hasSwapped, false),
            // Wanted by me.
            // eq(swapperWantTable.courseId, .courseId),
            eq(swapperWantTable.telegramUserId, ctx.user.id),
            // The other swapper has the index I want.
            // Whether or not the other swapper has the index I have will
            // prioritised later.
            eq(otherSwapper.index, swapperWantTable.wantIndex),
            // Exclude myself.
            not(eq(otherSwapper.telegramUserId, ctx.user.id))
          )
        )
        .groupBy(swapperWantTable.courseId),
      db
        .select({
          count: count(),
          courseId: swapRequestsTable.courseId,
        })
        .from(swapRequestsTable)
        // Swapper 1 is the user.
        .innerJoin(
          swapperTable,
          and(
            eq(swapperTable.courseId, swapRequestsTable.courseId),
            eq(swapperTable.telegramUserId, swapRequestsTable.swapper1)
          )
        )
        // Swapper 2 is the other swapper.
        .innerJoin(
          otherSwapper,
          and(
            eq(otherSwapper.courseId, swapRequestsTable.courseId),
            eq(otherSwapper.telegramUserId, swapRequestsTable.swapper2)
          )
        )
        .where(
          and(
            or(
              eq(swapRequestsTable.swapper1, ctx.user.id),
              eq(swapRequestsTable.swapper2, ctx.user.id)
            ),
            eq(swapperTable.hasSwapped, false),
            eq(otherSwapper.hasSwapped, false)
          )
        )
        .groupBy(swapRequestsTable.courseId),
    ]);

    const matchCountsMap = new Map<number, number>(
      matchCounts.map((matchCount) => [matchCount.courseId, matchCount.count])
    );
    const pendingRequestCountsMap = new Map<number, number>(
      pendingRequestCounts.map((pendingRequestCount) => [
        pendingRequestCount.courseId,
        pendingRequestCount.count,
      ])
    );

    return requests.map((request) => ({
      course: {
        id: request.courseId,
        code: request.courseCode,
        name: request.courseName,
      },
      hasSwapped: request.hasSwapped,
      matchCount: matchCountsMap.get(request.courseId) ?? 0,
      pendingRequestCount: pendingRequestCountsMap.get(request.courseId) ?? 0,
    }));
  }),
  getCourseRequestAndMatches: protectedProcedure
    .input(
      z.object({
        courseId: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const [
        _currentlyHave,
        directPotentialMatches,
        wantIndexes,
        pendingRequestsForEachSwapper,
      ] = await Promise.all([
        db
          .select({
            courseId: swapperTable.courseId,
            index: swapperTable.index,
            hasSwapped: swapperTable.hasSwapped,
            haveIndex: swapperTable.index,
          })
          .from(swapperTable)
          .innerJoin(coursesTable, eq(swapperTable.courseId, coursesTable.id))
          .where(
            and(
              eq(swapperTable.telegramUserId, ctx.user.id),
              eq(swapperTable.courseId, input.courseId)
            )
          )
          .limit(1),
        db
          .select({
            _id: sql<string>`${swapperWantTable.courseId}::text || '-' || ${swapperTable.telegramUserId}::text`,
            courseId: swapperWantTable.courseId,
            wantIndex: swapperWantTable.wantIndex,
            requestedAt: swapperWantTable.requestedAt,
            telegramUserId: swapperTable.telegramUserId,
            hasSwapped: swapperTable.hasSwapped,
            userRequestedAt: swapRequestsTable.requestedAt,
            initiator: swapRequestsTable.initiator,
            swapperHandle: usersTable.handle,
          })
          .from(swapperWantTable)
          .innerJoin(
            swapperTable,
            eq(swapperWantTable.courseId, swapperTable.courseId)
          )
          .innerJoin(
            usersTable,
            eq(swapperTable.telegramUserId, usersTable.userId)
          )
          .leftJoin(
            swapRequestsTable,
            and(
              eq(swapperTable.courseId, swapRequestsTable.courseId),
              // and(
              //   sql`MAX(${swapperTable.telegramUserId}::number, ${ctx.user.id}::number) = ${swapRequestsTable.swapper1}::number`,
              //   sql`MIN(${swapperTable.telegramUserId}::number, ${ctx.user.id}::number) = ${swapRequestsTable.swapper2}::number`
              //   // eq(max(swapRequestsTable.swapper1, swapRequestsTable.swapper2), ctx.user.id),
              // )
              or(
                and(
                  eq(swapRequestsTable.swapper1, ctx.user.id),
                  eq(swapRequestsTable.swapper2, swapperTable.telegramUserId)
                ),
                and(
                  eq(swapRequestsTable.swapper1, swapperTable.telegramUserId),
                  eq(swapRequestsTable.swapper2, ctx.user.id)
                )
              )
            )
          )
          .where(
            and(
              // Wanted by me.
              eq(swapperWantTable.courseId, input.courseId),
              eq(swapperWantTable.telegramUserId, ctx.user.id),
              // The other swapper has the index I want.
              // Whether or not the other swapper has the index I have will
              // prioritised later.
              eq(swapperTable.index, swapperWantTable.wantIndex),
              not(eq(swapperTable.telegramUserId, ctx.user.id))
            )
          ),
        db
          .select({
            wantIndex: swapperWantTable.wantIndex,
          })
          .from(swapperWantTable)
          .where(
            and(
              eq(swapperWantTable.courseId, input.courseId),
              eq(swapperWantTable.telegramUserId, ctx.user.id)
            )
          ),
        db
          .select({
            count: count(),
            telegramUserId: swapperTable.telegramUserId,
          })
          .from(swapperTable)
          .innerJoin(
            swapRequestsTable,
            and(
              eq(swapperTable.courseId, swapRequestsTable.courseId),
              not(eq(swapRequestsTable.initiator, swapperTable.telegramUserId)),
              or(
                eq(swapperTable.telegramUserId, swapRequestsTable.swapper1),
                eq(swapperTable.telegramUserId, swapRequestsTable.swapper2)
              )
            )
          )
          .where(eq(swapperTable.courseId, input.courseId))
          .groupBy(swapperTable.telegramUserId),
      ]);

      if (_currentlyHave.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You have not set your index for this course.",
        });
      }
      const currentlyHave = _currentlyHave[0];
      const haveIndex = currentlyHave.index;

      let numberOfRequestsBySwapper = new Map<number, number>(
        pendingRequestsForEachSwapper.map((pendingRequest) => [
          pendingRequest.telegramUserId,
          pendingRequest.count,
        ])
      );

      // Among direct potential matches, find where the other swapper wants my index (perfect match).
      const otherSwapperWantMatches = await db
        .select({
          _id: sql<string>`${swapperWantTable.courseId}::text || '-' || ${swapperWantTable.telegramUserId}::text`,
          courseId: swapperWantTable.courseId,
        })
        .from(swapperWantTable)
        .where(
          and(
            inArray(
              sql<string>`${swapperWantTable.courseId}::text || '-' || ${swapperWantTable.telegramUserId}::text`,
              directPotentialMatches.map((match) => match._id)
            ),
            eq(swapperWantTable.courseId, input.courseId),
            eq(swapperWantTable.wantIndex, haveIndex)
          )
        );

      const otherSwapperWantMatchIds = new Set(
        otherSwapperWantMatches.map((m) => m._id)
      );

      const perfectMatches: MatchIndexResponse[] = [];
      const otherMatches: MatchIndexResponse[] = [];

      for (const match of directPotentialMatches) {
        // If the swapper has already swapped, we only show it if the user has requested.
        if (match.hasSwapped && match.userRequestedAt === null) {
          continue;
        }

        let status: "pending" | "swapped" | undefined = undefined;
        if (match.hasSwapped) {
          status = "swapped";
        } else if (match.userRequestedAt !== null) {
          status = "pending";
        }
        const isSelfInitiated = match.initiator === ctx.user.id;

        const encryptedId = encryptId(ctx.user.id, match._id);
        const isPerfect = otherSwapperWantMatchIds.has(match._id);
        const entry: MatchIndexResponse = {
          numberOfRequests:
            numberOfRequestsBySwapper.get(match.telegramUserId) ?? 0,
          isVerified: false,
          isPerfectMatch: isPerfect,
          id: encryptedId,
          index: match.wantIndex,
          requestedAt: match.requestedAt,
          status,
          isSelfInitiated,
          revealedBy:
            !isSelfInitiated && status === "pending"
              ? match.swapperHandle
              : undefined,
        };
        if (isPerfect) {
          perfectMatches.push(entry);
        } else {
          otherMatches.push(entry);
        }
      }

      const sortByRequestedAt = (
        a: MatchIndexResponse,
        b: MatchIndexResponse
      ) => b.requestedAt.getTime() - a.requestedAt.getTime();
      perfectMatches.sort(sortByRequestedAt);
      otherMatches.sort(sortByRequestedAt);

      const matchesMap = new Map<
        number,
        {
          perfectMatches: MatchIndexResponse[];
          otherMatches: MatchIndexResponse[];
        }
      >();
      matchesMap.set(input.courseId, {
        perfectMatches,
        otherMatches,
      });

      const matches = [
        ...(perfectMatches.sort(
          (a, b) => b.requestedAt.getTime() - a.requestedAt.getTime()
        ) ?? []),
        ...(otherMatches.sort(
          (a, b) => b.requestedAt.getTime() - a.requestedAt.getTime()
        ) ?? []),
      ];
      const courseMatches = {
        course: {
          id: currentlyHave.courseId,
          haveIndex: haveIndex,
          hasSwapped: currentlyHave.hasSwapped,
        },
        wantIndexes: wantIndexes.map((index) => index.wantIndex),
        matches: matches,
        // hasMoreMatches: matches.length > 5,
      };

      return courseMatches;
    }),
  toggleSwapRequest: protectedProcedure
    .input(
      z.object({
        courseId: z.number(),
        hasSwapped: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await db
        .update(swapperTable)
        .set({ hasSwapped: input.hasSwapped })
        .where(
          and(
            eq(swapperTable.courseId, input.courseId),
            eq(swapperTable.telegramUserId, ctx.user.id)
          )
        );
      return { success: true, toggledTo: input.hasSwapped };
    }),
  requestSwap: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const username = ctx.user.username;
      const userId = ctx.user.id;
      if (!username) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Your username is not set, please set one under your Telegram settings.",
        });
      }

      const decryptedId = decryptId(ctx.user.id, input.id);

      const split = decryptedId.split("-");
      if (split.length !== 2) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid ID, please report this!",
        });
      }
      const courseId = parseInt(split[0]);
      const otherSwapperId = parseInt(split[1]);
      if (isNaN(courseId) || isNaN(otherSwapperId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Invalid ID, course ID or other swapper ID is not valid, please report this!",
        });
      }

      const [_otherSwapper, _course, _mySwapper, existingRequest] =
        await Promise.all([
          db
            .select({
              courseId: swapperTable.courseId,
              index: swapperTable.index,
              telegramUserId: swapperTable.telegramUserId,
              hasSwapped: swapperTable.hasSwapped,
            })
            .from(swapperTable)
            .where(
              and(
                eq(swapperTable.courseId, courseId),
                eq(swapperTable.telegramUserId, otherSwapperId)
              )
            )
            .limit(1),
          db
            .select({
              id: coursesTable.id,
              code: coursesTable.code,
              name: coursesTable.name,
              ay: coursesTable.ay,
              semester: coursesTable.semester,
            })
            .from(coursesTable)
            .where(eq(coursesTable.id, courseId))
            .limit(1),
          db
            .select({
              index: swapperTable.index,
            })
            .from(swapperTable)
            .where(
              and(
                eq(swapperTable.telegramUserId, userId),
                eq(swapperTable.courseId, courseId)
              )
            )
            .limit(1),
          db
            .select({
              requestedAt: swapRequestsTable.requestedAt,
            })
            .from(swapRequestsTable)
            .where(
              and(
                eq(
                  swapRequestsTable.swapper1,
                  Math.max(userId, otherSwapperId)
                ),
                eq(
                  swapRequestsTable.swapper2,
                  Math.min(userId, otherSwapperId)
                ),
                eq(swapRequestsTable.courseId, courseId)
              )
            )
            .limit(1),
        ]);

      if (_otherSwapper.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Swap request not found, please report this!",
        });
      }
      const otherSwapper = _otherSwapper[0];

      // Check if the other swapper is visible.
      if (otherSwapper.hasSwapped) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `The swapper is no longer looking to swap.`,
        });
      }

      if (_course.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Course not found, please report this!",
        });
      }
      const course = _course[0];

      if (_mySwapper.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "You have not set your index, please set one under your Telegram settings.",
        });
      }
      const mySwapper = _mySwapper[0];

      if (existingRequest.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You have already requested a swap for this course.",
        });
      }

      await db
        .insert(swapRequestsTable)
        .values({
          swapper1: Math.max(userId, otherSwapper.telegramUserId),
          swapper2: Math.min(userId, otherSwapper.telegramUserId),
          courseId: courseId,
          initiator: userId,
          requestedAt: new Date(),
        })
        .onConflictDoNothing();

      const myIndexUrl = buildFStarsUrl(
        course.code,
        mySwapper.index,
        course.ay,
        course.semester
      );
      const otherIndexUrl = buildFStarsUrl(
        course.code,
        otherSwapper.index,
        course.ay,
        course.semester
      );

      const swapper1 = Math.max(userId, otherSwapper.telegramUserId);
      const swapper2 = Math.min(userId, otherSwapper.telegramUserId);
      const acceptPayload = serializeAccept(courseId, swapper1, swapper2);
      const alreadySwappedPayload = serializeAlreadySwapped(
        courseId,
        swapper1,
        swapper2
      );

      try {
        await bot.sendMessage(
          otherSwapperId,
          `*${escapeMarkdown(course.code)} ${escapeMarkdown(course.name)} Swap Request*\n@${escapeMarkdown(username)} wants to swap with you!\n \nThey have: [${escapeMarkdown(mySwapper.index)}](${myIndexUrl})\nYou have: [${escapeMarkdown(otherSwapper.index)}](${otherIndexUrl}).\n \nTap "Accept" to confirm the swap, or "Already Swapped" if you've swapped elsewhere.`,
          {
            parse_mode: "Markdown",
            disable_web_page_preview: true,
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "Accept", callback_data: acceptPayload },
                  {
                    text: "Already Swapped",
                    callback_data: alreadySwappedPayload,
                  },
                ],
              ],
            },
          }
        );
      } catch (error) {
        console.error(error);
      }

      return { success: true };
    }),
  handleSwapRequestCallback: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        action: z.enum(["accept", "already_swapped"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const decryptedId = decryptId(ctx.user.id, input.id);
      const split = decryptedId.split("-");
      if (split.length !== 2) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid ID, please report this!",
        });
      }
      const courseId = parseInt(split[0]);
      const otherSwapperId = parseInt(split[1]);
      if (isNaN(courseId) || isNaN(otherSwapperId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Invalid ID, course ID or other swapper ID is not valid, please report this!",
        });
      }

      if (input.action === "accept") {
        return handleAcceptCallback(
          serializeAccept(courseId, ctx.user.id, otherSwapperId),
          {
            id: ctx.user.id,
            username: ctx.user.username ?? "???",
          }
        );
      } else if (input.action === "already_swapped") {
        return handleAlreadySwappedCallback(
          serializeAlreadySwapped(courseId, ctx.user.id, otherSwapperId),
          {
            id: ctx.user.id,
            username: ctx.user.username ?? "???",
          }
        );
      }

      return { success: true };
    }),
});
