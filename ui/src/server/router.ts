import { createTRPCRouter } from "./trpc";
import { onboardRouter } from "./routers/onboard";

export const appRouter = createTRPCRouter({
  onboard: onboardRouter,
});

export type AppRouter = typeof appRouter;
