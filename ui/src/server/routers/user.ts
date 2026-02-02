import z from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { db } from "@/db";
import { usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { schools } from "@/lib/types";
import { SendSmtpEmail } from "@getbrevo/brevo";
import { emailAPI } from "@/email/brevo";

export const userRouter = createTRPCRouter({
  verifySelf: protectedProcedure.query(async ({ ctx }) => {
    const user = await db
      .select({
        userId: usersTable.userId,
        handle: usersTable.handle,
        // email: usersTable.email,
        school: usersTable.school,
        joinDate: usersTable.joinDate,
        // verifiedAt: usersTable.verifiedAt,
      })
      .from(usersTable)
      .where(eq(usersTable.userId, ctx.user.id))
      .limit(1);
    if (user.length === 0) {
      return null;
    }
    return user[0];
  }),
});
