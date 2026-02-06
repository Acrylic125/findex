import z from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { db } from "@/db";
import {
  courseIndexTable,
  coursesTable,
  swapperTable,
  swapperWantTable,
  usersTable,
} from "@/db/schema";
import { and, count, eq, inArray, or, sql } from "drizzle-orm";
import { CurrentAcadYear } from "@/lib/acad";
import { alias } from "drizzle-orm/pg-core";
import { bot } from "@/telegram/telegram";
import crypto from "crypto";
import { env } from "@/lib/env";

const IV_LENGTH = 16;

function getUserEncryptionSecret(userId: number) {
  const key = crypto
    .createHash("sha256")
    .update(`${env.ENCRYPTION_KEY}-${userId}`)
    .digest()
    .subarray(0, 32);
  return key;
}

function encryptId(userId: number, id: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    getUserEncryptionSecret(userId),
    iv
  );
  let encryptedId = cipher.update(id, "utf8", "hex");
  encryptedId += cipher.final("hex");
  // Prepend IV to encrypted data (IV is 16 bytes = 32 hex chars)
  return iv.toString("hex") + encryptedId;
}

function decryptId(userId: number, encryptedId: string): string {
  // Extract IV from the beginning (IV is 16 bytes = 32 hex chars)
  const iv = Buffer.from(encryptedId.substring(0, IV_LENGTH * 2), "hex");
  const encrypted = encryptedId.substring(IV_LENGTH * 2);
  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    getUserEncryptionSecret(userId),
    iv
  );
  return decipher.update(encrypted, "hex", "utf8") + decipher.final("utf8");
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
  status?: "pending" | "completed" | "cancelled";
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
        wantIndexes: z.array(z.string()).min(1).max(16),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const currentWantIndexes = await db
        .select({
          index: swapperWantTable.wantIndex,
        })
        .from(swapperWantTable)
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
      return {
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
  getAllRequestsAndMatches: protectedProcedure.query(async ({ ctx }) => {
    const [currentlyHave, requests, directPotentialMatches] = await Promise.all(
      [
        db
          .select({
            courseId: swapperTable.courseId,
            index: swapperTable.index,
          })
          .from(swapperTable)
          .where(eq(swapperTable.telegramUserId, ctx.user.id)),
        db
          .select({
            courseId: coursesTable.id,
            courseName: coursesTable.name,
            courseCode: coursesTable.code,
            index: courseIndexTable.index,
            requestedAt: swapperWantTable.requestedAt,
          })
          .from(swapperWantTable)
          .innerJoin(
            courseIndexTable,
            and(
              eq(swapperWantTable.courseId, courseIndexTable.courseId),
              eq(swapperWantTable.wantIndex, courseIndexTable.index)
            )
          )
          .innerJoin(
            coursesTable,
            eq(courseIndexTable.courseId, coursesTable.id)
          )
          .where(
            and(
              eq(swapperWantTable.telegramUserId, ctx.user.id),
              eq(coursesTable.ay, CurrentAcadYear.ay),
              eq(coursesTable.semester, CurrentAcadYear.semester)
            )
          ),
        db
          .select({
            // id: swapperWantTable.id,
            _id: sql<string>`${swapperWantTable.courseId}::text || '-' || ${otherSwapper.telegramUserId}::text`,
            courseId: swapperWantTable.courseId,
            wantIndex: swapperWantTable.wantIndex,
            requestedAt: swapperWantTable.requestedAt,
            telegramUserId: otherSwapper.telegramUserId,
            username: usersTable.handle, // may not be up to date
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
              // Wanted by me.
              eq(swapperWantTable.courseId, otherSwapper.courseId),
              eq(swapperWantTable.telegramUserId, ctx.user.id),
              // The other swapper has the index I want.
              // Whether or not the other swapper has the index I have will
              // prioritised later.
              eq(otherSwapper.index, swapperWantTable.wantIndex)
            )
          ),
      ]
    );

    const currentlyHaveMap = new Map<number, string>(
      currentlyHave.map((item) => [item.courseId, item.index])
    );
    const potentialMatchesMap = new Map<
      number,
      (typeof directPotentialMatches)[number][]
    >();
    for (const match of directPotentialMatches) {
      if (!potentialMatchesMap.has(match.courseId)) {
        potentialMatchesMap.set(match.courseId, []);
      }
      potentialMatchesMap.get(match.courseId)!.push(match);
    }

    // Out of the potential matches, filter out the ones where the other swapper
    // wants an index that I have.
    const otherSwapperWantMatches = await db
      .select({
        _id: sql<string>`${swapperWantTable.courseId}::text || '-' || ${otherSwapper.telegramUserId}::text`,
        courseId: swapperWantTable.courseId,
        // wantIndex: swapperWantTable.wantIndex,
      })
      .from(swapperWantTable)
      .where(
        and(
          inArray(
            sql<string>`${swapperWantTable.courseId}::text || '-' || ${swapperWantTable.telegramUserId}::text`,
            directPotentialMatches.map((match) => match._id)
          ),
          or(
            ...Array.from(currentlyHaveMap.entries()).map(([courseId, index]) =>
              and(
                eq(swapperWantTable.courseId, courseId),
                eq(swapperWantTable.wantIndex, index)
              )
            )
          )
        )
      );
    const otherSwapperWantMatchesMap = new Map<
      number,
      (typeof otherSwapperWantMatches)[number][]
    >();
    for (const match of otherSwapperWantMatches) {
      if (!otherSwapperWantMatchesMap.has(match.courseId)) {
        otherSwapperWantMatchesMap.set(match.courseId, []);
      }
      otherSwapperWantMatchesMap.get(match.courseId)!.push(match);
    }

    // Collate the matches.
    const matchesMap = new Map<
      number,
      {
        perfectMatches: MatchIndexResponse[];
        otherMatches: MatchIndexResponse[];
      }
    >();

    for (const [courseId, matches] of Array.from(
      potentialMatchesMap.entries()
    )) {
      const otherSwapperWantMatches = otherSwapperWantMatchesMap.get(courseId);
      if (!otherSwapperWantMatches) {
        matchesMap.set(courseId, {
          perfectMatches: [],
          otherMatches: matches.map((match) => {
            const encryptedId = encryptId(ctx.user.id, match._id);
            return {
              numberOfRequests: 0,
              isVerified: true,
              isPerfectMatch: false,
              id: encryptedId,
              index: match.wantIndex,
              requestedAt: match.requestedAt,
            };
          }),
        });
        continue;
      }
      const perfectMatches: MatchIndexResponse[] = [];
      const otherMatches: MatchIndexResponse[] = [];
      for (const match of matches) {
        const encryptedId = encryptId(ctx.user.id, match._id);
        if (
          otherSwapperWantMatches.some(
            (otherMatch) => otherMatch._id === match._id
          )
        ) {
          perfectMatches.push({
            // by: deduceBy(match),
            numberOfRequests: 0,
            isVerified: true,
            isPerfectMatch: true,
            id: encryptedId,
            index: match.wantIndex,
            requestedAt: match.requestedAt,
          });
        } else {
          otherMatches.push({
            // by: deduceBy(match),
            numberOfRequests: 0,
            isVerified: true,
            isPerfectMatch: false,
            id: encryptedId,
            index: match.wantIndex,
            requestedAt: match.requestedAt,
          });
        }
      }

      matchesMap.set(courseId, {
        perfectMatches,
        otherMatches,
      });
    }

    // Group by course
    const groupedRequests = requests.reduce(
      (acc, request) => {
        if (!acc[request.courseId]) {
          const haveIndex = currentlyHaveMap.get(request.courseId);
          // Skip if user does not have this course
          if (!haveIndex) {
            return acc;
          }
          const matchesGrouped = matchesMap.get(request.courseId);

          const matches = [
            ...(matchesGrouped?.perfectMatches.sort(
              (a, b) => b.requestedAt.getTime() - a.requestedAt.getTime()
            ) ?? []),
            ...(matchesGrouped?.otherMatches.sort(
              (a, b) => b.requestedAt.getTime() - a.requestedAt.getTime()
            ) ?? []),
          ];

          acc[request.courseId] = {
            course: {
              id: request.courseId,
              code: request.courseCode,
              name: request.courseName,
              haveIndex: haveIndex,
            },
            wantIndexes: [],
            matches: matches.slice(0, 5),
            hasMoreMatches: matches.length > 5,
          };
        }
        acc[request.courseId].wantIndexes.push({
          index: request.index,
          requestedAt: request.requestedAt,
        });
        return acc;
      },
      {} as Record<
        number,
        {
          course: {
            id: number;
            code: string;
            name: string;
            haveIndex: string;
          };
          wantIndexes: { index: string; requestedAt: Date }[];
          matches: MatchIndexResponse[];
          hasMoreMatches: boolean;
        }
      >
    );

    return Object.values(groupedRequests);
  }),
  requestSwap: protectedProcedure
    .input(
      z.object({
        id: z.string(),
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

      const swap = await db
        .select()
        .from(swapperTable)
        .where(
          and(
            eq(swapperTable.courseId, courseId),
            eq(swapperTable.telegramUserId, otherSwapperId)
          )
        );

      if (swap.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Swap request not found, please report this!",
        });
      }

      await bot.sendMessage(
        otherSwapperId,
        `Requesting swap for ${courseId} ${otherSwapperId} ${decryptedId}`
        // `Requesting swap for ${input.courseId} ${input.index}`
      );
      return { success: true };
    }),
});
