import { createTRPCRouter } from "./trpc";
import { onboardRouter } from "./routers/onboard";
import { userRouter } from "./routers/user";

export const appRouter = createTRPCRouter({
  onboard: onboardRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
