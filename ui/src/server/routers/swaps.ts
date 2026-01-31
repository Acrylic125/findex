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
import { and, eq } from "drizzle-orm";
import { schools } from "@/lib/types";
import { SendSmtpEmail } from "@getbrevo/brevo";
import { emailAPI } from "@/email/brevo";
import { CurrentAcadYear } from "@/lib/acad";

export const swapsRouter = createTRPCRouter({
  newRequest: protectedProcedure
    .input(
      z.object({
        courseId: z.number(),
        index: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await db.insert(swapperWantTable).values({
        telegramUserId: ctx.user.id,
        courseId: input.courseId,
        wantIndex: input.index,
      });
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
