import { initTRPC, TRPCError } from "@trpc/server";
import { cache } from "react";
import { isValid, parse } from "@tma.js/init-data-node";
import { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";

export const createTRPCContext = cache(
  async ({ req: request }: FetchCreateContextFnOptions) => {
    /**
     * @see: https://trpc.io/docs/server/context
     */
    const authorization = request.headers.get("Authorization");
    if (!authorization) {
      return {
        auth: null,
      };
    }
    if (!isValid(authorization, process.env.BOT_KEY!)) {
      return {
        auth: null,
      };
    }
    return {
      auth: parse(authorization),
    };
  }
);

type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create();

const isAuthed = t.middleware(({ next, ctx }) => {
  if (!ctx.auth?.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      auth: ctx.auth,
    },
  });
});

/**
 * Export reusable router and procedure helpers
 * that can be used throughout the router
 */
export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthed);

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure;
