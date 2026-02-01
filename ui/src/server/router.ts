import { createTRPCRouter } from "./trpc";
import { onboardRouter } from "./routers/onboard";
import { userRouter } from "./routers/user";
import { swapsRouter } from "./routers/swaps";

export const appRouter = createTRPCRouter({
  onboard: onboardRouter,
  user: userRouter,
  swaps: swapsRouter,
});

export type AppRouter = typeof appRouter;
