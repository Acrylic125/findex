import z from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { db } from "@/db";
import { usersTable } from "@/db/schema";
import { schools } from "@/lib/types";

export const onboardRouter = createTRPCRouter({
  onboard: publicProcedure
    .input(
      z.object({
        school: z.enum(schools),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      if (ctx.user.username === undefined) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Your telegram username is not set.",
        });
      }
      const user = await db
        .insert(usersTable)
        .values({
          userId: ctx.user.id,
          handle: ctx.user.username,
          school: input.school,
        })
        .returning({
          userId: usersTable.userId,
          handle: usersTable.handle,
          school: usersTable.school,
          joinDate: usersTable.joinDate,
        });
      if (user.length === 0) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to onboard user.",
        });
      }
      return {
        success: true,
        user: user[0],
      };
    }),
});
