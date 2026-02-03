import { createTRPCRouter, publicProcedure } from "../trpc";
import { db } from "@/db";
import { usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";

export const userRouter = createTRPCRouter({
  verifySelf: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) {
      return null;
    }
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
