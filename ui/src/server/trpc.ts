import { initTRPC, TRPCError } from "@trpc/server";
import { cache } from "react";
import { isValid, parse } from "@tma.js/init-data-node";
import { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import superjson from "superjson";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const createTRPCContext = cache(
  async ({ req: request }: FetchCreateContextFnOptions) => {
    const session = await getServerSession(authOptions);

    console.log("session", session);

    /**
     * @see: https://trpc.io/docs/server/context
     */
    const authorization = request.headers.get("Authorization");
    if (!authorization) {
      return {
        user: null,
        auth: null,
      };
    }
    if (!isValid(authorization, process.env.BOT_KEY!)) {
      return {
        user: null,
        auth: null,
      };
    }
    const auth = parse(authorization);
    if (auth.user === undefined) {
      return {
        user: null,
        auth: null,
      };
    }
    return {
      user: auth.user,
      auth: auth,
    };
  }
);

type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

const isAuthed = t.middleware(({ next, ctx }) => {
  if (!(ctx.user && ctx.auth)) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      user: ctx.user,
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
