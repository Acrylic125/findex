import z from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { db } from "@/db";
import {
  courseIndexTable,
  coursesTable,
  emailVerificationCodesTable,
  swapperTable,
  swapperWantTable,
  usersTable,
} from "@/db/schema";
import { and, count, eq, inArray } from "drizzle-orm";
import { CurrentAcadYear } from "@/lib/acad";

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
          await tx
            .insert(swapperWantTable)
            .values(
              toInsertIndexes.map((index) => ({
                telegramUserId: ctx.user.id,
                courseId: input.courseId,
                wantIndex: index,
                requestedAt: new Date(),
              }))
            )
            .onConflictDoNothing();
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

      console.log(have, request);
      return {
        have: have.length > 0 ? have[0] : null,
        want: request.map((request) => ({
          indexId: request.indexId,
          index: request.index,
        })),
      };
    }),
  getAllRequests: protectedProcedure.query(async ({ ctx }) => {
    const currentlyHave = await db
      .select({
        courseId: swapperTable.courseId,
        index: swapperTable.index,
      })
      .from(swapperTable)
      .where(eq(swapperTable.telegramUserId, ctx.user.id));

    const currentlyHaveMap = new Map<number, string>(
      currentlyHave.map((item) => [item.courseId, item.index])
    );

    const requests = await db
      .select({
        courseId: coursesTable.id,
        courseName: coursesTable.name,
        courseCode: coursesTable.code,
        index: courseIndexTable.index,
        requestedAt: swapperWantTable.requestedAt,
        // ay: coursesTable.ay,
        semester: coursesTable.semester,
      })
      .from(swapperWantTable)
      .innerJoin(
        courseIndexTable,
        eq(swapperWantTable.courseId, courseIndexTable.courseId)
      )
      .innerJoin(coursesTable, eq(courseIndexTable.courseId, coursesTable.id))
      .where(
        and(
          eq(swapperWantTable.telegramUserId, ctx.user.id),
          eq(coursesTable.ay, CurrentAcadYear.ay),
          eq(coursesTable.semester, CurrentAcadYear.semester)
        )
      );

    // Group by course
    const groupedRequests = requests.reduce(
      (acc, request) => {
        if (!acc[request.courseId]) {
          const haveIndex = currentlyHaveMap.get(request.courseId)?.toString();
          // Skip if user does not have this course
          if (!haveIndex) {
            return acc;
          }
          acc[request.courseId] = {
            course: {
              id: request.courseId,
              code: request.courseCode,
              name: request.courseName,
              haveIndex: haveIndex,
            },
            indexes: [],
          };
        }
        acc[request.courseId].indexes.push({
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
          indexes: { index: string; requestedAt: Date }[];
        }
      >
    );

    return groupedRequests;
  }),
});
