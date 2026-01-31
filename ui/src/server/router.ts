import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "./trpc";

export const appRouter = createTRPCRouter({
  test: publicProcedure.query(({ ctx }) => {
    console.log(ctx.auth);
    return {
      message: "Hello, world!",
    };
  }),
});

export type AppRouter = typeof appRouter;
