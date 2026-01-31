import z from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { db } from "@/db";
import { emailVerificationCodesTable, usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { schools } from "@/lib/types";
import { SendSmtpEmail } from "@getbrevo/brevo";
import { emailAPI } from "@/email/brevo";

export const onboardRouter = createTRPCRouter({
  verifyEmail: publicProcedure
    .input(
      z.object({
        email: z.email().refine((email) => email.endsWith("@e.ntu.edu.sg"), {
          message: "Email must end in @e.ntu.edu.sg",
        }),
        school: z.enum(schools),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { email } = input;
      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      if (ctx.user.username === undefined) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Username is required",
        });
      }
      const user = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.userId, ctx.user.id))
        .limit(1);

      if (user.length === 0) {
        await db.insert(usersTable).values({
          userId: ctx.user.id,
          email: email,
          handle: ctx.user.username,
          school: input.school,
        });
      } else {
        // Check if the user is already verified
        if (user[0].verifiedAt !== null) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "User already verified",
          });
        }
        await db
          .update(usersTable)
          .set({
            email: email,
            school: input.school,
          })
          .where(eq(usersTable.userId, ctx.user.id));
      }

      const verificationCodeInt = Math.floor(Math.random() * 999999);
      const verificationCode = verificationCodeInt.toString().padStart(6, "0");

      await db
        .insert(emailVerificationCodesTable)
        .values({
          code: verificationCode,
          userId: ctx.user.id,
          expiresAt: new Date(Date.now() + 1000 * 60 * 5),
        })
        .onConflictDoUpdate({
          target: [emailVerificationCodesTable.userId],
          set: {
            code: verificationCode,
            expiresAt: new Date(Date.now() + 1000 * 60 * 15),
          },
        });

      let message = new SendSmtpEmail();
      message.subject = "FIndex Onboarding Verification";
      message.htmlContent = `
      <div>
      <h1>Hey ${ctx.user.username}! 👋</h1>
      <p>Your onboarding verification code is <strong>${verificationCode}</strong>. It will expire in 15 minutes.</p>
      </div>
      `;
      message.sender = { name: "Onboarding", email: "onboarding@benapps.dev" };
      message.to = [{ email: email, name: ctx.user.username }];

      const result = await emailAPI.sendTransacEmail(message);
      if (result.response.statusCode !== 201) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to send email",
        });
      }

      return {
        success: true,
      };
    }),
});
